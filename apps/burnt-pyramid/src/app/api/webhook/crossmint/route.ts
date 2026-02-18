import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { addMember, isMember } from "@/lib/db";
import { kv } from "@vercel/kv";

/**
 * Crossmint Webhook Handler
 *
 * Receives webhook events when NFT purchases/mints complete.
 *
 * With the self-claim approach:
 * 1. Crossmint mints NFT to user's wallet
 * 2. Webhook records in local DB for tracking
 * 3. User clicks "Claim Membership" in frontend which calls contract
 * 4. Contract verifies NFT ownership and distributes funds
 *
 * Expected events:
 * - orders.payment.succeeded - Payment confirmed
 * - purchase.succeeded - NFT minted (v2)
 * - orders.delivery.completed - NFT delivered (v3)
 *
 * Security:
 * - HMAC signature verification using X-Crossmint-Signature header
 * - Timestamp validation to prevent replay attacks (5 minute window)
 */

// Maximum age for webhook requests (5 minutes in milliseconds)
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Verifies the Crossmint webhook signature using HMAC-SHA256
 * @param rawBody - The raw request body as a string
 * @param signature - The signature header value (format: "t=timestamp,v1=signature")
 * @param secret - The webhook secret from Crossmint
 * @returns Object with isValid boolean and optional error message
 */
function verifyWebhookSignature(
    rawBody: string,
    signature: string | null,
    secret: string
): { isValid: boolean; error?: string; timestamp?: number } {
    if (!signature) {
        return { isValid: false, error: "Missing signature header" };
    }

    // Parse signature header (format: "t=timestamp,v1=signature")
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
        return { isValid: false, error: "Invalid signature format" };
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    const providedSignature = signaturePart.slice(3);

    if (isNaN(timestamp)) {
        return { isValid: false, error: "Invalid timestamp in signature" };
    }

    // Check timestamp to prevent replay attacks
    const now = Date.now();
    const webhookAge = now - timestamp * 1000; // Convert seconds to milliseconds

    if (webhookAge > MAX_WEBHOOK_AGE_MS) {
        return {
            isValid: false,
            error: `Webhook too old: ${Math.round(webhookAge / 1000)}s (max: ${MAX_WEBHOOK_AGE_MS / 1000}s)`,
            timestamp,
        };
    }

    if (webhookAge < -MAX_WEBHOOK_AGE_MS) {
        // Timestamp is in the future (clock skew protection)
        return {
            isValid: false,
            error: "Webhook timestamp is in the future",
            timestamp,
        };
    }

    // Compute expected signature
    // Crossmint uses: HMAC-SHA256(timestamp + "." + rawBody)
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

    // Constant-time comparison to prevent timing attacks
    try {
        const providedBuffer = Buffer.from(providedSignature, "hex");
        const expectedBuffer = Buffer.from(expectedSignature, "hex");

        if (providedBuffer.length !== expectedBuffer.length) {
            return { isValid: false, error: "Signature length mismatch", timestamp };
        }

        const isValid = timingSafeEqual(providedBuffer, expectedBuffer);
        return { isValid, timestamp, error: isValid ? undefined : "Signature mismatch" };
    } catch {
        return { isValid: false, error: "Invalid signature encoding", timestamp };
    }
}

interface CrossmintWebhookPayload {
    type: string;
    data: {
        orderId?: string;
        status?: string;
        recipient?: {
            walletAddress?: string;
        };
        metadata?: {
            referrer?: string;
            recipient?: string;
        };
        lineItems?: Array<{
            callData?: {
                recipient?: string;
                referrer?: string;
            };
        }>;
    };
}

export async function POST(request: NextRequest) {
    // Get the webhook secret
    const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("SECURITY: CROSSMINT_WEBHOOK_SECRET is not configured");
        return NextResponse.json(
            { error: "Webhook not configured" },
            { status: 500 }
        );
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    // Get signature header
    const signature = request.headers.get("X-Crossmint-Signature");

    // Verify signature
    const verification = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!verification.isValid) {
        console.error(
            `SECURITY: Webhook signature verification failed - ${verification.error}`,
            {
                timestamp: verification.timestamp,
                remoteIp: request.headers.get("x-forwarded-for") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
            }
        );
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        // Parse the body after signature verification
        const payload: CrossmintWebhookPayload = JSON.parse(rawBody);

        console.log("Crossmint webhook received (verified):", JSON.stringify(payload, null, 2));

        // Handle purchase/payment success events
        const isPaymentEvent =
            payload.type === "purchase.succeeded" ||
            payload.type === "orders.payment.succeeded" ||
            payload.type === "orders.delivery.completed";

        if (!isPaymentEvent) {
            console.log(`Ignoring event type: ${payload.type}`);
            return NextResponse.json({ success: true, ignored: true });
        }

        // Deduplicate by orderId to prevent double-processing
        const orderId = payload.data.orderId;
        if (orderId) {
            const dedupKey = `webhook_order:${orderId}`;
            const alreadyProcessed = await kv.setnx(dedupKey, Date.now());
            if (!alreadyProcessed) {
                console.log(`Duplicate webhook for orderId: ${orderId} - skipping`);
                return NextResponse.json({ success: true, duplicate: true });
            }
            // Set 24h TTL on the dedup key
            await kv.expire(dedupKey, 86400);
        }

        // Extract recipient address from various possible locations
        const recipientAddress =
            payload.data.recipient?.walletAddress ||
            payload.data.metadata?.recipient ||
            payload.data.lineItems?.[0]?.callData?.recipient;

        // Extract referrer from metadata
        const referrerAddress =
            payload.data.metadata?.referrer ||
            payload.data.lineItems?.[0]?.callData?.referrer ||
            null;

        if (!recipientAddress) {
            console.error("No recipient address in webhook payload");
            return NextResponse.json({ error: "No recipient address" }, { status: 400 });
        }

        // Validate XION address format
        const XION_ADDRESS_REGEX = /^xion1[a-z0-9]{38,58}$/;
        if (!XION_ADDRESS_REGEX.test(recipientAddress)) {
            console.error(`Invalid recipient address format: ${recipientAddress}`);
            return NextResponse.json({ error: "Invalid recipient address format" }, { status: 400 });
        }

        // Validate referrer address format and membership - use null if invalid
        let validatedReferrer: string | null = null;
        if (referrerAddress) {
            if (!XION_ADDRESS_REGEX.test(referrerAddress)) {
                console.warn(`Invalid referrer address format: ${referrerAddress} - ignoring`);
            } else {
                // Also verify referrer is actually a member (prevents referrer spoofing)
                const referrerIsMember = await isMember(referrerAddress);
                if (referrerIsMember) {
                    validatedReferrer = referrerAddress;
                } else {
                    console.warn(`Referrer is not a member: ${referrerAddress} - ignoring`);
                }
            }
        }

        // Check if already in local DB
        const existingMember = await isMember(recipientAddress);
        if (existingMember) {
            console.log(`Member already exists in DB: ${recipientAddress}`);
            return NextResponse.json({ success: true, alreadyMember: true });
        }

        console.log(`Recording payment: ${recipientAddress}, referrer: ${validatedReferrer}`);

        // Record in local DB for tracking
        // Note: User still needs to call Claim in frontend to activate on-chain membership
        await addMember({
            walletAddress: recipientAddress,
            referrerAddress: validatedReferrer,
            transactionHash: null,
            paymentMethod: "crossmint",
        });

        console.log(`Payment recorded in DB: ${recipientAddress}`);

        return NextResponse.json({
            success: true,
            member: recipientAddress,
            referrer: referrerAddress,
            note: "User should claim membership via frontend",
        });
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}

// Vercel requires GET for health checks
export async function GET() {
    return NextResponse.json({
        status: "active",
    });
}

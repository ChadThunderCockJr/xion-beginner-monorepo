import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Crossmint Webhook Handler for Gammon Token Pack purchases.
 *
 * Flow:
 * 1. User buys a token pack via Crossmint checkout (credit card)
 * 2. Crossmint mints CW721 NFT to user's wallet
 * 3. This webhook records the purchase for tracking
 * 4. User later burns the NFT (transfers to dev address) to receive Gammon tokens
 *
 * Security:
 * - HMAC-SHA256 signature verification (X-Crossmint-Signature header)
 * - Timestamp validation to prevent replay attacks (5-minute window)
 */

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

// In-memory dedup set (sufficient for single-instance webhook handler)
const processedOrders = new Set<string>();

function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): { isValid: boolean; error?: string; timestamp?: number } {
  if (!signature) {
    return { isValid: false, error: "Missing signature header" };
  }

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

  const now = Date.now();
  const webhookAge = now - timestamp * 1000;

  if (webhookAge > MAX_WEBHOOK_AGE_MS) {
    return {
      isValid: false,
      error: `Webhook too old: ${Math.round(webhookAge / 1000)}s`,
      timestamp,
    };
  }

  if (webhookAge < -MAX_WEBHOOK_AGE_MS) {
    return {
      isValid: false,
      error: "Webhook timestamp is in the future",
      timestamp,
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

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
      packAmount?: string;
      recipient?: string;
    };
    lineItems?: Array<{
      callData?: {
        recipient?: string;
        packAmount?: string;
      };
    }>;
  };
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CROSSMINT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("SECURITY: CROSSMINT_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Crossmint-Signature");

  const verification = verifyWebhookSignature(rawBody, signature, webhookSecret);

  if (!verification.isValid) {
    console.error(
      `SECURITY: Webhook signature verification failed - ${verification.error}`,
      {
        timestamp: verification.timestamp,
        remoteIp: request.headers.get("x-forwarded-for") || "unknown",
      }
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload: CrossmintWebhookPayload = JSON.parse(rawBody);

    console.log("Crossmint webhook received (verified):", JSON.stringify(payload, null, 2));

    const isPaymentEvent =
      payload.type === "purchase.succeeded" ||
      payload.type === "orders.payment.succeeded" ||
      payload.type === "orders.delivery.completed";

    if (!isPaymentEvent) {
      console.log(`Ignoring event type: ${payload.type}`);
      return NextResponse.json({ success: true, ignored: true });
    }

    // Deduplicate by orderId
    const orderId = payload.data.orderId;
    if (orderId) {
      if (processedOrders.has(orderId)) {
        console.log(`Duplicate webhook for orderId: ${orderId} - skipping`);
        return NextResponse.json({ success: true, duplicate: true });
      }
      processedOrders.add(orderId);
    }

    const recipientAddress =
      payload.data.recipient?.walletAddress ||
      payload.data.metadata?.recipient ||
      payload.data.lineItems?.[0]?.callData?.recipient;

    if (!recipientAddress) {
      console.error("No recipient address in webhook payload");
      return NextResponse.json({ error: "No recipient address" }, { status: 400 });
    }

    const XION_ADDRESS_REGEX = /^xion1[a-z0-9]{38,58}$/;
    if (!XION_ADDRESS_REGEX.test(recipientAddress)) {
      console.error(`Invalid recipient address format: ${recipientAddress}`);
      return NextResponse.json({ error: "Invalid recipient address format" }, { status: 400 });
    }

    const packAmount =
      payload.data.metadata?.packAmount ||
      payload.data.lineItems?.[0]?.callData?.packAmount ||
      null;

    console.log(
      `Token pack purchase recorded: recipient=${recipientAddress}, pack=${packAmount}, orderId=${orderId}`
    );

    return NextResponse.json({
      success: true,
      recipient: recipientAddress,
      packAmount,
      note: "User should burn NFT to receive Gammon tokens",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "active" });
}

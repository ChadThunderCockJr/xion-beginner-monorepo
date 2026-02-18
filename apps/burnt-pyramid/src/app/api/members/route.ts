import { NextRequest, NextResponse } from "next/server";
import { isMember, addMember, getMember, updateMemberUsername, isTransactionHashUsed, markTransactionHashUsed } from "@/lib/db";
import { generateSuggestion } from "@/lib/username";
import { rateLimit, RateLimits } from "@/lib/rateLimit";
import { verifyTransaction } from "@/lib/xion";
import { verifyRequestAuth } from "@/lib/auth";

// Internal header used by Crossmint webhook to bypass payment verification
const INTERNAL_WEBHOOK_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

// XION address validation regex - must start with 'xion1' followed by 38 alphanumeric chars
const XION_ADDRESS_REGEX = /^xion1[a-z0-9]{38,58}$/;

/**
 * Validates a XION address format
 */
function isValidXionAddress(address: string): boolean {
    return XION_ADDRESS_REGEX.test(address);
}

/**
 * Verifies that the request is from an internal trusted source (webhook)
 */
function isInternalRequest(request: NextRequest): boolean {
    if (!INTERNAL_WEBHOOK_SECRET) {
        console.warn("INTERNAL_WEBHOOK_SECRET not configured - internal requests disabled");
        return false;
    }
    const internalHeader = request.headers.get("x-internal-secret");
    return internalHeader === INTERNAL_WEBHOOK_SECRET;
}

/**
 * Validates a transaction hash format (basic hex string validation)
 */
function isValidTransactionHash(hash: string): boolean {
    // Transaction hashes are typically 64 character hex strings
    return /^[A-Fa-f0-9]{64}$/.test(hash);
}

/**
 * Validates a username: alphanumeric and underscores, 3-20 chars,
 * no leading/trailing underscores, no consecutive underscores.
 */
function isValidUsername(username: string): boolean {
    if (!username || typeof username !== "string") return false;
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9_]{1,18}[a-zA-Z0-9])?$/.test(username);
}

// GET - Check if address is a member
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    // Validate address format
    if (!isValidXionAddress(address)) {
        return NextResponse.json({ error: "Invalid XION address format" }, { status: 400 });
    }

    const member = await getMember(address);

    // Auto-generate username for members missing one
    if (member && !member.username) {
        try {
            const newUsername = generateSuggestion();
            await updateMemberUsername(address, newUsername);
            return NextResponse.json({
                isMember: true,
                username: newUsername,
            });
        } catch (error) {
            console.error("Failed to generate username for member:", error);
            // Still return as member, just without username
        }
    }

    return NextResponse.json({
        isMember: member !== null,
        username: member?.username || null,
    });
}

// POST - Add a new member after successful payment
// SECURITY: This endpoint requires either:
// 1. Internal webhook secret (from Crossmint webhook)
// 2. Valid transaction hash for on-chain verification
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, referrerAddress, transactionHash, username } = body;

        if (!walletAddress) {
            return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
        }

        // Validate wallet address format
        if (!isValidXionAddress(walletAddress)) {
            return NextResponse.json(
                { error: "Invalid wallet address format. Must be a valid XION address (xion1...)" },
                { status: 400 }
            );
        }

        // Validate username format if provided
        if (username && !isValidUsername(username)) {
            return NextResponse.json(
                { error: "Invalid username. Must be 3-20 characters, alphanumeric and underscores only." },
                { status: 400 }
            );
        }

        // Validate referrer address format if provided
        if (referrerAddress && !isValidXionAddress(referrerAddress)) {
            return NextResponse.json(
                { error: "Invalid referrer address format. Must be a valid XION address (xion1...)" },
                { status: 400 }
            );
        }

        // SECURITY: Validate that referrer is actually a member (prevent referrer spoofing)
        // We only grant rewards if the referrer is a verified member
        let validatedReferrer: string | null = null;
        if (referrerAddress) {
            const referrerIsMember = await isMember(referrerAddress);
            if (referrerIsMember) {
                validatedReferrer = referrerAddress;
            } else {
                // Log but don't fail - just ignore invalid referrer
                console.warn(`Invalid referrer address (not a member): ${referrerAddress}`);
            }
        }

        // SECURITY CHECK: Require payment proof
        const isInternal = isInternalRequest(request);

        if (!isInternal) {
            // Require valid transaction hash format
            if (!transactionHash || !isValidTransactionHash(transactionHash)) {
                return NextResponse.json(
                    {
                        error: "Payment verification required. Provide a valid transaction hash or use the payment flow.",
                        code: "PAYMENT_VERIFICATION_REQUIRED"
                    },
                    { status: 403 }
                );
            }

            // Check if transaction hash was already used (prevent reuse)
            const txUsed = await isTransactionHashUsed(transactionHash);
            if (txUsed) {
                return NextResponse.json(
                    { error: "Transaction hash has already been used for registration", code: "TX_ALREADY_USED" },
                    { status: 409 }
                );
            }

            // Verify transaction on-chain
            const txResult = await verifyTransaction(transactionHash, walletAddress);
            if (!txResult.valid) {
                return NextResponse.json(
                    { error: `Transaction verification failed: ${txResult.reason}`, code: "TX_VERIFICATION_FAILED" },
                    { status: 403 }
                );
            }
        }

        // Rate limiting
        const rateLimitResult = await rateLimit(
            `member:${walletAddress}`,
            RateLimits.MEMBER_REGISTRATION
        );

        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
            return NextResponse.json(
                {
                    error: "Too many registration attempts. Please try again later.",
                    retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": retryAfter.toString(),
                    },
                }
            );
        }

        // Check if already a member
        const existingMember = await getMember(walletAddress);
        if (existingMember) {
            // If member exists but has no username and one is provided, update it
            if (username && (!existingMember.username || existingMember.username.trim() === "")) {
                try {
                    const updatedMember = await updateMemberUsername(walletAddress, username);
                    return NextResponse.json({
                        success: true,
                        message: "Username updated",
                        isNew: false,
                        member: {
                            walletAddress: updatedMember.walletAddress,
                            username: updatedMember.username,
                        },
                    });
                } catch (updateError) {
                    console.error("Failed to update username for existing member:", updateError);
                }
            }
            return NextResponse.json({
                success: true,
                message: "Already a member",
                isNew: false,
                member: {
                    walletAddress: existingMember.walletAddress,
                    username: existingMember.username,
                },
            });
        }

        // Add new member - use validated referrer only
        const member = await addMember({
            walletAddress,
            username, // Optional, will auto-generate if missing
            referrerAddress: validatedReferrer, // Use server-validated referrer
            transactionHash: transactionHash || null,
            paymentMethod: transactionHash ? "usdc" : "crossmint",
        });

        // Mark transaction hash as used (prevent reuse)
        if (transactionHash) {
            await markTransactionHashUsed(transactionHash, walletAddress);
        }

        return NextResponse.json({
            success: true,
            message: "Member added",
            isNew: true,
            member: {
                walletAddress: member.walletAddress,
                username: member.username,
                joinedAt: member.joinedAt,
            },
        });
    } catch (error) {
        console.error("Failed to add member:", error);
        // Handle username taken error specifically
        if (error instanceof Error && error.message.includes("taken")) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }
}

// PATCH - Update member username
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress, username } = body;

        if (!walletAddress || !username) {
            return NextResponse.json({ error: "Wallet address and username required" }, { status: 400 });
        }

        if (!isValidUsername(username)) {
            return NextResponse.json(
                { error: "Invalid username. Must be 3-20 characters, alphanumeric and underscores only." },
                { status: 400 }
            );
        }

        if (!isValidXionAddress(walletAddress)) {
            return NextResponse.json(
                { error: "Invalid wallet address format" },
                { status: 400 }
            );
        }

        const member = await updateMemberUsername(walletAddress, username);

        return NextResponse.json({
            success: true,
            message: "Username updated",
            member: {
                walletAddress: member.walletAddress,
                username: member.username,
            }
        });
    } catch (error) {
        console.error("Failed to update username:", error);
        if (error instanceof Error && error.message.includes("taken")) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to update username" }, { status: 500 });
    }
}

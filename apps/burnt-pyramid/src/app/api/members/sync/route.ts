import { NextRequest, NextResponse } from "next/server";
import { getMember, addMember } from "@/lib/db";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { PYRAMID_CONTRACT, XION_RPC } from "@/lib/xion";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// XION address validation regex
const XION_ADDRESS_REGEX = /^xion1[a-z0-9]{38,58}$/;

function isValidXionAddress(address: string): boolean {
    return XION_ADDRESS_REGEX.test(address);
}

/**
 * Verify membership on-chain by querying the contract
 */
async function verifyOnChainMembership(address: string): Promise<boolean> {
    if (!PYRAMID_CONTRACT) {
        console.warn("PYRAMID_CONTRACT not configured - cannot verify on-chain");
        return false;
    }

    try {
        const client = await CosmWasmClient.connect(XION_RPC);
        const result = await client.queryContractSmart(PYRAMID_CONTRACT, {
            member: { address }
        });
        return result?.is_member === true;
    } catch (error) {
        console.error("Failed to verify on-chain membership:", error);
        return false;
    }
}

/**
 * POST - Sync a member from blockchain to database
 *
 * This endpoint is called when the blockchain contract shows a user as a member
 * but the database doesn't have their record. This can happen if:
 * - The webhook failed during initial registration
 * - There was a network error during DB write
 * - The user joined through a different path
 *
 * SECURITY: This endpoint verifies on-chain membership before creating a DB record.
 * This is secure because we verify the blockchain (source of truth) before sync.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { walletAddress } = body;

        if (!walletAddress) {
            return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
        }

        // Rate limiting
        const rateLimitResult = await rateLimit(`sync:${walletAddress}`, RateLimits.MEMBER_REGISTRATION);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        // Validate address format
        if (!isValidXionAddress(walletAddress)) {
            return NextResponse.json({ error: "Invalid XION address format" }, { status: 400 });
        }

        // Check if already exists in database
        const existingMember = await getMember(walletAddress);
        if (existingMember) {
            return NextResponse.json({
                success: true,
                message: "Already synced",
                username: existingMember.username,
            });
        }

        // SECURITY: Verify membership on-chain before creating DB record
        const isOnChainMember = await verifyOnChainMembership(walletAddress);
        if (!isOnChainMember) {
            return NextResponse.json(
                { error: "Not a member on-chain. Payment required." },
                { status: 403 }
            );
        }

        // Create a new member record (recovered from blockchain)
        // Note: We don't have referrer info from the blockchain, so it's null
        const member = await addMember({
            walletAddress,
            referrerAddress: null,
            transactionHash: null,
            paymentMethod: "usdc", // Assume USDC since they're on-chain
        });

        return NextResponse.json({
            success: true,
            message: "Member synced from blockchain",
            username: member.username,
        });
    } catch (error) {
        console.error("Failed to sync member:", error);
        return NextResponse.json({ error: "Failed to sync member" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { isMember, getUsernameByAddress } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

/** Truncate a wallet address for public display */
function redactAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return addr.slice(0, 8) + "..." + addr.slice(-4);
}

const PRESENCE_PREFIX = "presence:";
const PRESENCE_TTL = 60; // 60 seconds

// POST /api/presence - Update presence heartbeat
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { address } = body;

        if (!address || typeof address !== "string") {
            return NextResponse.json(
                { success: false, error: "Invalid address" },
                { status: 400 }
            );
        }

        // Check membership
        const membershipStatus = await isMember(address);
        if (!membershipStatus) {
            return NextResponse.json(
                { success: false, error: "Only members can update presence" },
                { status: 403 }
            );
        }

        // Update presence with TTL
        const timestamp = Date.now();
        await kv.set(`${PRESENCE_PREFIX}${address}`, timestamp, {
            ex: PRESENCE_TTL,
        });

        return NextResponse.json({
            success: true,
            timestamp,
        });
    } catch (error) {
        console.error("Failed to update presence:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update presence" },
            { status: 500 }
        );
    }
}

// GET /api/presence?viewer=xion1... - Get online members
export async function GET(req: NextRequest) {
    try {
        // Rate limit
        const rateLimitResult = await rateLimit("presence:global", RateLimits.GENERAL_READ);
        if (!rateLimitResult.success) {
            return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
        }

        const viewer = req.nextUrl.searchParams.get("viewer") || "";

        // Get all presence keys
        const keys = await kv.keys(`${PRESENCE_PREFIX}*`);

        if (!keys || keys.length === 0) {
            return NextResponse.json({
                success: true,
                online: [],
                count: 0,
            });
        }

        // Extract addresses from keys
        const addresses = keys.map((key) => key.replace(PRESENCE_PREFIX, ""));

        // Get timestamps for validation (optional, since TTL handles expiry)
        const now = Date.now();
        const onlineMembers: Array<{ address: string; username: string | null; isYou: boolean }> = [];

        for (const address of addresses) {
            const timestamp = await kv.get<number>(`${PRESENCE_PREFIX}${address}`);
            // Only include if timestamp is recent (within 60s)
            if (timestamp && now - timestamp < PRESENCE_TTL * 1000) {
                const username = await getUsernameByAddress(address);
                onlineMembers.push({
                    address: redactAddress(address),
                    username,
                    isYou: address === viewer,
                });
            }
        }

        return NextResponse.json({
            success: true,
            online: onlineMembers,
            count: onlineMembers.length,
        });
    } catch (error) {
        console.error("Failed to get presence:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get presence" },
            { status: 500 }
        );
    }
}

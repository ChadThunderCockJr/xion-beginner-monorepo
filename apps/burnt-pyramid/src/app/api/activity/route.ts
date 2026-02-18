import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RateLimits } from "@/lib/rateLimit";
import { kv } from "@vercel/kv";

// Types
interface Member {
    walletAddress: string;
    username: string;
    referrerAddress: string | null;
    joinedAt: Date;
}

interface Earning {
    id: string;
    memberAddress: string;
    referredAddress: string;
    amount: string;
    createdAt: Date;
}

export interface ActivityEvent {
    id: string;
    type: "join" | "recruit";
    actorAddress: string;
    actorUsername: string;
    targetAddress?: string;
    targetUsername?: string;
    amount?: string;
    timestamp: string;
}

/** Truncate a wallet address for public display */
function redactAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return addr.slice(0, 8) + "..." + addr.slice(-4);
}

const MEMBERS_SET = "members";
const MEMBER_PREFIX = "member:";
const EARNINGS_PREFIX = "earnings:";

// GET - Get recent activity events
export async function GET(req: NextRequest) {
    try {
        // Rate limit
        const rateLimitResult = await rateLimit("activity:global", RateLimits.GENERAL_READ);
        if (!rateLimitResult.success) {
            return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
        }
        const addresses = await kv.smembers(MEMBERS_SET);
        const events: ActivityEvent[] = [];
        const usernameCache: Record<string, string> = {};

        // Helper to get username (cached)
        const getUsername = async (address: string): Promise<string> => {
            if (usernameCache[address]) return usernameCache[address];
            const member = await kv.get<Member>(`${MEMBER_PREFIX}${address}`);
            const username = member?.username || address.slice(0, 8);
            usernameCache[address] = username;
            return username;
        };

        // Collect all events
        for (const address of addresses) {
            const member = await kv.get<Member>(`${MEMBER_PREFIX}${address}`);
            if (!member) continue;

            // Add join event
            const joinDate = new Date(member.joinedAt);
            events.push({
                id: `join-${address}-${joinDate.getTime()}`,
                type: "join",
                actorAddress: redactAddress(address),
                actorUsername: member.username || redactAddress(address),
                timestamp: joinDate.toISOString(),
            });

            // Add recruit events (from earnings)
            const earnings = await kv.get<Earning[]>(`${EARNINGS_PREFIX}${address}`);
            if (earnings && earnings.length > 0) {
                for (const earning of earnings) {
                    const targetUsername = await getUsername(earning.referredAddress);
                    const earnDate = new Date(earning.createdAt);
                    events.push({
                        id: `recruit-${earning.id}`,
                        type: "recruit",
                        actorAddress: redactAddress(address),
                        actorUsername: member.username || redactAddress(address),
                        targetAddress: redactAddress(earning.referredAddress),
                        targetUsername,
                        amount: earning.amount,
                        timestamp: earnDate.toISOString(),
                    });
                }
            }
        }

        // Sort by timestamp, newest first
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Return last 20 events
        return NextResponse.json({
            success: true,
            events: events.slice(0, 20),
            total: events.length,
        });
    } catch (error) {
        console.error("Failed to get activity:", error);
        return NextResponse.json({ success: false, events: [], total: 0 });
    }
}

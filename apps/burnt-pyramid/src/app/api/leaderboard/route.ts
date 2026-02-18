import { NextRequest, NextResponse } from "next/server";
import { getTopRecruiters } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

/** Truncate a wallet address for public display */
function redactAddress(addr: string): string {
    if (addr.length <= 12) return addr;
    return addr.slice(0, 8) + "..." + addr.slice(-4);
}

// GET /api/leaderboard - Get top recruiters
export async function GET(req: NextRequest) {
    try {
        // Rate limit
        const rateLimitResult = await rateLimit("leaderboard:global", RateLimits.GENERAL_READ);
        if (!rateLimitResult.success) {
            return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
        }
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "5");

        const recruiters = await getTopRecruiters(Math.min(limit, 10));

        // Redact full addresses from public response
        const redactedRecruiters = recruiters.map((r) => ({
            ...r,
            address: redactAddress(r.address),
        }));

        return NextResponse.json({
            success: true,
            recruiters: redactedRecruiters,
        });
    } catch (error) {
        console.error("Failed to get leaderboard:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get leaderboard" },
            { status: 500 }
        );
    }
}

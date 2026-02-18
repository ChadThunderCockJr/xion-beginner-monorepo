import { NextResponse } from "next/server";
import { queryStats, formatUSDC } from "@/lib/xion";
import { getStats, recalculateStats } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// GET - Get global pyramid stats
export async function GET() {
    try {
        // Rate limit
        const rateLimitResult = await rateLimit("stats:global", RateLimits.GENERAL_READ);
        if (!rateLimitResult.success) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }
        // Get local DB stats (source of truth for now)
        let stats = await getStats();

        // Auto-heal: If we have members but 0 paid out, it's likely desynced.
        // (Unless 2 members joined without referrer, which is rare/unlikely in this design)
        if (stats.totalMembers > 0 && stats.totalPaidOut === "0.00") {
            console.log("Stats desync detected. Recalculating...");
            stats = await recalculateStats();
        }

        return NextResponse.json({
            members: stats.totalMembers,
            totalPaidOut: stats.totalPaidOut,
        });
    } catch (error) {
        console.error("Failed to get stats:", error);
        return NextResponse.json({
            members: 0,
            totalPaidOut: "0.00",
        });
    }
}

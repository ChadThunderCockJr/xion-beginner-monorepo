import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { isAdmin } from "@/lib/auth";

// POST /api/admin/recalculate-stats - Recalculate stats from actual data
export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        // Get all members from the set
        const memberAddresses = await kv.smembers("members");
        const totalMembers = memberAddresses.length;

        // Calculate total paid out from earnings
        let totalPaidOut = 0;
        for (const address of memberAddresses) {
            const earnings = await kv.get<any[]>(`earnings:${address}`);
            if (earnings && Array.isArray(earnings)) {
                totalPaidOut += earnings.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
            }
        }

        // Update stats
        await kv.set("stats", {
            totalMembers,
            totalPaidOut: totalPaidOut.toFixed(2),
        });

        return NextResponse.json({
            success: true,
            stats: {
                totalMembers,
                totalPaidOut: totalPaidOut.toFixed(2),
            },
            message: "Stats recalculated from earnings data",
        });
    } catch (error) {
        console.error("Failed to recalculate stats:", error);
        return NextResponse.json(
            { success: false, error: "Failed to recalculate stats" },
            { status: 500 }
        );
    }
}

// GET /api/admin/recalculate-stats - View current stats for comparison
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const stats = await kv.get<any>("stats");
        const memberAddresses = await kv.smembers("members");

        return NextResponse.json({
            success: true,
            currentStats: stats || { totalMembers: 0, totalPaidOut: "0.00" },
            actualMemberCount: memberAddresses.length,
        });
    } catch (error) {
        console.error("Failed to get stats:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get stats" },
            { status: 500 }
        );
    }
}

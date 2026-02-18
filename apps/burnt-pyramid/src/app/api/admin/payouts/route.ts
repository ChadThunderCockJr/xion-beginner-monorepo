import { NextResponse } from "next/server";
import { getAllPendingPayouts } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

// GET /api/admin/payouts - List all pending payouts
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const pendingPayouts = await getAllPendingPayouts();

        // Calculate total pending amount
        const totalPending = pendingPayouts.reduce(
            (sum, p) => sum + parseFloat(p.amount),
            0
        );

        return NextResponse.json({
            success: true,
            payouts: pendingPayouts,
            count: pendingPayouts.length,
            totalPending: totalPending.toFixed(2),
        });
    } catch (error) {
        console.error("Failed to get pending payouts:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get pending payouts" },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { markEarningPaid, getAllPendingPayouts } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

// POST /api/admin/payouts/[id]/mark-paid - Mark a payout as paid
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const params = await context.params;
        const earningId = params.id;

        if (!earningId) {
            return NextResponse.json(
                { success: false, error: "Earning ID is required" },
                { status: 400 }
            );
        }

        // Find the earning in pending payouts
        const pendingPayouts = await getAllPendingPayouts();
        const earning = pendingPayouts.find((p) => p.id === earningId);

        if (!earning) {
            return NextResponse.json(
                { success: false, error: "Earning not found or already paid" },
                { status: 404 }
            );
        }

        // Mark as paid
        await markEarningPaid(earning.memberAddress, earningId);

        return NextResponse.json({
            success: true,
            message: "Payout marked as paid",
            earningId,
        });
    } catch (error) {
        console.error("Failed to mark payout as paid:", error);
        return NextResponse.json(
            { success: false, error: "Failed to mark payout as paid" },
            { status: 500 }
        );
    }
}

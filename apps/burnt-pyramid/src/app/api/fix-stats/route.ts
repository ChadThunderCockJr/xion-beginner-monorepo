import { NextResponse } from "next/server";
import { recalculateStats } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

/**
 * Recalculate pyramid stats
 * Requires: Authorization header with Bearer <ADMIN_API_KEY>
 */
export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const stats = await recalculateStats();
        return NextResponse.json({ success: true, stats });
    } catch (error) {
        return NextResponse.json({ error: "Failed to recalculate stats" }, { status: 500 });
    }
}

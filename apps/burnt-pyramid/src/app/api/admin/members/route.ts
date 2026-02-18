import { NextRequest, NextResponse } from "next/server";
import { getAllMembers } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

// GET /api/admin/members - Get member stats
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const members = await getAllMembers();

        const withUsername = members.filter(m => m.username && m.username.trim() !== "");
        const withoutUsername = members.filter(m => !m.username || m.username.trim() === "");

        return NextResponse.json({
            success: true,
            total: members.length,
            withUsername: withUsername.length,
            withoutUsername: withoutUsername.length,
            membersWithoutUsername: withoutUsername.map(m => ({
                walletAddress: m.walletAddress,
                joinedAt: m.joinedAt,
            })),
        });
    } catch (error) {
        console.error("Failed to get member stats:", error);
        return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
    }
}

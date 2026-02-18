import { NextRequest, NextResponse } from "next/server";
import { getChatCredits, isMember, initializeCredits } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// GET /api/credits - Get chat credits for a member
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const address = searchParams.get("address");

        if (!address) {
            return NextResponse.json(
                { success: false, error: "Address is required" },
                { status: 400 }
            );
        }

        // Rate limit
        const rateLimitResult = await rateLimit(`credits:${address}`, RateLimits.GENERAL_READ);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, error: "Too many requests" },
                { status: 429 }
            );
        }

        // Check if user is a member
        const memberStatus = await isMember(address);
        if (!memberStatus) {
            return NextResponse.json(
                { success: false, error: "Not a member" },
                { status: 403 }
            );
        }

        // Get credits, auto-initialize if missing (handles older members)
        let credits = await getChatCredits(address);
        if (credits.total === 0 && credits.used === 0) {
            // Member has no credits record - initialize with starting credits
            await initializeCredits(address);
            credits = await getChatCredits(address);
        }

        return NextResponse.json({
            success: true,
            credits,
        });
    } catch (error) {
        console.error("Failed to get credits:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get credits" },
            { status: 500 }
        );
    }
}

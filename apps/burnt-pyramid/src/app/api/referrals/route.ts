import { NextRequest, NextResponse } from "next/server";
import { getReferralStats } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// GET - Get referral stats for a member
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    // Rate limit
    const rateLimitResult = await rateLimit(`referrals:${address}`, RateLimits.GENERAL_READ);
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const stats = await getReferralStats(address);
    return NextResponse.json(stats);
}

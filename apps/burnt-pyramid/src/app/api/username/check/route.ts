import { NextRequest, NextResponse } from "next/server";
import { isUsernameTaken } from "@/lib/db";
import { formatUsername, USERNAME_REGEX } from "@/lib/username";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get("username");

    if (!username) {
        return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    // Rate limit
    const rateLimitResult = await rateLimit("username-check:global", RateLimits.USERNAME_CHECK);
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Validate format
    const cleanUsername = username.replace(/^@/, '');
    if (!USERNAME_REGEX.test(cleanUsername)) {
        return NextResponse.json({
            available: false,
            error: "Invalid format. Use 3-20 characters: letters, numbers, underscores."
        });
    }

    try {
        const taken = await isUsernameTaken(formatUsername(cleanUsername));
        return NextResponse.json({
            available: !taken,
            username: formatUsername(cleanUsername)
        });
    } catch (error) {
        console.error("Failed to check username:", error);
        return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
    }
}

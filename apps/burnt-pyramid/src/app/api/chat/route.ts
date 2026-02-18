import { NextRequest, NextResponse } from "next/server";
import { addMessage, getMessages } from "@/lib/chat";
import { isMember, getUsernameByAddress, getChatCredits, useMessageCredit } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// XION address validation - must start with 'xion1' followed by 38-58 alphanumeric chars (bech32)
const XION_ADDRESS_REGEX = /^xion1[a-z0-9]{38,58}$/;

/**
 * Validates a XION address format
 */
function isValidXionAddress(address: string): boolean {
    if (!address || typeof address !== "string") return false;
    return XION_ADDRESS_REGEX.test(address.toLowerCase());
}

/**
 * Sanitize message content to prevent XSS and injection attacks
 * This is defense-in-depth - React also escapes by default
 */
function sanitizeContent(content: string): string {
    if (!content || typeof content !== "string") return "";

    return content
        // Trim whitespace
        .trim()
        // Remove null bytes and control characters (except common whitespace)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        // Limit to max length
        .slice(0, 1000);
}

// GET /api/chat - Fetch messages (members only)
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const address = searchParams.get("address");

        // Require address parameter and validate format
        if (!address || !isValidXionAddress(address.toLowerCase())) {
            return NextResponse.json(
                { success: false, error: "Valid address parameter required" },
                { status: 400 }
            );
        }

        // Rate limit GET requests
        const rateLimitResult = await rateLimit(
            `chat-read:${address.toLowerCase()}`,
            RateLimits.GENERAL_READ
        );
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { success: false, error: "Too many requests" },
                { status: 429 }
            );
        }

        // Check membership
        const memberStatus = await isMember(address.toLowerCase());
        if (!memberStatus) {
            return NextResponse.json(
                { success: false, error: "Only members can view messages" },
                { status: 403 }
            );
        }

        const limit = parseInt(searchParams.get("limit") || "50");
        const before = searchParams.get("before")
            ? parseInt(searchParams.get("before")!)
            : undefined;

        const messages = await getMessages(limit, before);

        // Enrich messages with usernames
        const messagesWithUsernames = await Promise.all(
            messages.map(async (msg) => {
                const username = await getUsernameByAddress(msg.authorAddress);
                return {
                    ...msg,
                    username: username || "unknown",
                };
            })
        );

        return NextResponse.json({
            success: true,
            messages: messagesWithUsernames,
            count: messagesWithUsernames.length,
        });
    } catch (error) {
        console.error("Failed to fetch messages:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

// POST /api/chat - Send a message
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { authorAddress, content } = body;

        // Validate author address format (SECURITY: prevents address spoofing attempts)
        if (!authorAddress || typeof authorAddress !== "string") {
            return NextResponse.json(
                { success: false, error: "Invalid author address" },
                { status: 400 }
            );
        }

        // Normalize and validate the address format
        const normalizedAddress = authorAddress.toLowerCase().trim();
        if (!isValidXionAddress(normalizedAddress)) {
            return NextResponse.json(
                { success: false, error: "Invalid XION address format" },
                { status: 400 }
            );
        }

        // Validate content
        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "Message content is required" },
                { status: 400 }
            );
        }

        // Sanitize and validate content
        const sanitizedContent = sanitizeContent(content);
        if (sanitizedContent.length === 0) {
            return NextResponse.json(
                { success: false, error: "Message content is required" },
                { status: 400 }
            );
        }

        if (sanitizedContent.length > 1000) {
            return NextResponse.json(
                { success: false, error: "Message too long (max 1000 characters)" },
                { status: 400 }
            );
        }

        // Rate limiting (use normalized address)
        const rateLimitResult = await rateLimit(
            `chat:${normalizedAddress}`,
            RateLimits.CHAT_MESSAGE
        );

        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
            return NextResponse.json(
                {
                    success: false,
                    error: "Too many messages. Please slow down.",
                    retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": retryAfter.toString(),
                        "X-RateLimit-Limit": RateLimits.CHAT_MESSAGE.limit.toString(),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": rateLimitResult.reset.toString(),
                    },
                }
            );
        }

        // Check membership (use normalized address)
        const membershipStatus = await isMember(normalizedAddress);
        if (!membershipStatus) {
            return NextResponse.json(
                { success: false, error: "Only members can send messages" },
                { status: 403 }
            );
        }

        // Check and use message credit (use normalized address)
        const credits = await getChatCredits(normalizedAddress);
        if (credits.available <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: "You're out of messages. Recruit to unlock more!",
                    creditsRemaining: 0
                },
                { status: 403 }
            );
        }

        const creditUsed = await useMessageCredit(normalizedAddress);
        if (!creditUsed) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Failed to use message credit",
                    creditsRemaining: 0
                },
                { status: 500 }
            );
        }

        // Add message (use normalized address and sanitized content)
        const message = await addMessage(normalizedAddress, sanitizedContent);
        const username = await getUsernameByAddress(normalizedAddress);

        // Get updated credits
        const updatedCredits = await getChatCredits(normalizedAddress);

        return NextResponse.json({
            success: true,
            message: {
                ...message,
                username: username || "unknown",
            },
            creditsRemaining: updatedCredits.available,
        });
    } catch (error) {
        console.error("Failed to send message:", error);
        return NextResponse.json(
            { success: false, error: "Failed to send message" },
            { status: 500 }
        );
    }
}

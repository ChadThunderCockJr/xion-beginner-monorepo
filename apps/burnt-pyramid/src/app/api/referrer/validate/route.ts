import { NextRequest, NextResponse } from "next/server";
import { isMember, getMember } from "@/lib/db";
import { rateLimit, RateLimits } from "@/lib/rateLimit";

// Validation constants
const XION_ADDRESS_PREFIX = "xion1";
const XION_ADDRESS_LENGTH = 43; // Standard bech32 XION address length

/**
 * Sanitize and validate a XION address format
 * Returns null if invalid, normalized address if valid
 */
function sanitizeAddress(address: string | null | undefined): string | null {
    if (!address || typeof address !== "string") {
        return null;
    }

    // Trim whitespace and convert to lowercase
    const normalized = address.trim().toLowerCase();

    // Validate prefix
    if (!normalized.startsWith(XION_ADDRESS_PREFIX)) {
        return null;
    }

    // Validate length (bech32 addresses have consistent length)
    if (normalized.length !== XION_ADDRESS_LENGTH) {
        return null;
    }

    // Validate characters (bech32 uses specific charset)
    const bech32Regex = /^xion1[02-9ac-hj-np-z]+$/;
    if (!bech32Regex.test(normalized)) {
        return null;
    }

    return normalized;
}

/**
 * POST /api/referrer/validate
 * Validates that a referrer address is a real member
 * Returns validation result with optional username
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const rawAddress = body.address;

        // Sanitize first so we can use the address as rate limit key
        const addressForRateLimit = sanitizeAddress(rawAddress);
        if (!addressForRateLimit) {
            return NextResponse.json({
                valid: false,
                error: "Invalid address format"
            });
        }

        // Rate limiting keyed on address to prevent enumeration attacks
        const rateLimitResult = await rateLimit(
            `referrer-validate:${addressForRateLimit}`,
            RateLimits.REFERRER_VALIDATE
        );

        if (!rateLimitResult.success) {
            const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
            return NextResponse.json(
                { valid: false, error: "Too many validation requests" },
                {
                    status: 429,
                    headers: { "Retry-After": retryAfter.toString() }
                }
            );
        }

        const address = addressForRateLimit;

        // Check if the address is a member
        const memberExists = await isMember(address);

        if (!memberExists) {
            return NextResponse.json({
                valid: false,
                error: "Referrer is not a member"
            });
        }

        // Get member details for username
        const member = await getMember(address);

        return NextResponse.json({
            valid: true,
            address: address, // Return the sanitized address
            username: member?.username || null
        });
    } catch (error) {
        console.error("Referrer validation error:", error);
        return NextResponse.json(
            { valid: false, error: "Validation failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/referrer/validate?address=...
 * Convenience GET method for referrer validation
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const rawAddress = searchParams.get("address");

    // Sanitize the address
    const address = sanitizeAddress(rawAddress);

    if (!address) {
        return NextResponse.json({
            valid: false,
            error: "Invalid address format"
        });
    }

    // Rate limiting keyed on address
    const rateLimitResult = await rateLimit(
        `referrer-validate:${address}`,
        RateLimits.REFERRER_VALIDATE
    );

    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return NextResponse.json(
            { valid: false, error: "Too many validation requests" },
            {
                status: 429,
                headers: { "Retry-After": retryAfter.toString() }
            }
        );
    }

    // Check membership
    const memberExists = await isMember(address);

    if (!memberExists) {
        return NextResponse.json({
            valid: false,
            error: "Referrer is not a member"
        });
    }

    const member = await getMember(address);

    return NextResponse.json({
        valid: true,
        address: address,
        username: member?.username || null
    });
}

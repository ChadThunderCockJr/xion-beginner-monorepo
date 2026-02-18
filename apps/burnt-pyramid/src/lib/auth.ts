/**
 * Shared authentication utilities
 *
 * - Timing-safe admin auth (replaces copy-pasted isAdmin across routes)
 * - Session management for wallet ownership verification
 */

import { kv } from "@vercel/kv";
import { randomBytes, timingSafeEqual } from "crypto";

// ============================================================================
// ADMIN AUTH
// ============================================================================

const ADMIN_KEY = process.env.ADMIN_API_KEY;

/**
 * Verify admin authorization using timing-safe comparison.
 * Replaces the `===` comparison previously copy-pasted across 7+ routes.
 */
export function isAdmin(authHeader: string | null): boolean {
    if (!ADMIN_KEY) {
        return false;
    }
    if (!authHeader) {
        return false;
    }
    const expected = `Bearer ${ADMIN_KEY}`;
    if (authHeader.length !== expected.length) {
        return false;
    }
    try {
        return timingSafeEqual(
            Buffer.from(authHeader, "utf-8"),
            Buffer.from(expected, "utf-8"),
        );
    } catch {
        return false;
    }
}

// ============================================================================
// SESSION MANAGEMENT (for wallet ownership verification)
// ============================================================================

const SESSION_PREFIX = "session:";
const SESSION_TTL = 60 * 60 * 24; // 24 hours
const SESSION_COOKIE_NAME = "bp_session";

export interface Session {
    address: string;
    createdAt: number;
}

/**
 * Create a new session for a verified wallet address.
 * Returns the session token.
 */
export async function createSession(address: string): Promise<string> {
    const token = randomBytes(32).toString("hex");
    const session: Session = {
        address: address.toLowerCase(),
        createdAt: Date.now(),
    };
    await kv.set(`${SESSION_PREFIX}${token}`, session, { ex: SESSION_TTL });
    return token;
}

/**
 * Verify a session token and return the associated address.
 * Returns null if invalid or expired.
 */
export async function verifySession(token: string): Promise<string | null> {
    if (!token || typeof token !== "string") return null;
    try {
        const session = await kv.get<Session>(`${SESSION_PREFIX}${token}`);
        if (!session) return null;
        return session.address;
    } catch {
        return null;
    }
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
    await kv.del(`${SESSION_PREFIX}${token}`);
}

/**
 * Extract session token from request cookie.
 */
export function getSessionToken(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
}

/**
 * Verify that the request has a valid session for the claimed address.
 * Returns { verified: true, address } if valid, { verified: false } otherwise.
 *
 * When requireSession is false (default), returns verified:true if no session
 * is present (backwards-compatible). When true, requires a valid session.
 */
export async function verifyRequestAuth(
    cookieHeader: string | null,
    claimedAddress: string,
    requireSession: boolean = false,
): Promise<{ verified: boolean; address?: string }> {
    const token = getSessionToken(cookieHeader);

    if (!token) {
        if (requireSession) {
            return { verified: false };
        }
        // Backwards-compatible: allow requests without session
        // TODO: Set requireSession=true once client supports sessions
        return { verified: true, address: claimedAddress.toLowerCase() };
    }

    const sessionAddress = await verifySession(token);
    if (!sessionAddress) {
        return { verified: false };
    }

    // Verify the session address matches the claimed address
    if (sessionAddress !== claimedAddress.toLowerCase()) {
        return { verified: false };
    }

    return { verified: true, address: sessionAddress };
}

export const SESSION_COOKIE_OPTIONS = `${SESSION_COOKIE_NAME}={token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`;
export { SESSION_COOKIE_NAME };

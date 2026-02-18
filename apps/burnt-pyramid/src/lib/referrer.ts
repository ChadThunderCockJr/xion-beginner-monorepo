// Referrer Attribution Utility
// Handles persistent storage of referrer across sessions and navigation
// SECURITY: All referrer addresses must be validated server-side before use

const REFERRER_KEY = "burnt_pyramid_referrer";
const REFERRER_TIMESTAMP_KEY = "burnt_pyramid_referrer_ts";
const REFERRER_VALIDATED_KEY = "burnt_pyramid_referrer_validated";
const REFERRER_COOKIE_NAME = "bp_ref";
const EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Validation constants
const XION_ADDRESS_PREFIX = "xion1";
const XION_ADDRESS_LENGTH = 43; // Standard bech32 XION address length

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
    return typeof window !== "undefined";
}

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
    if (!isBrowser()) return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Set cookie with expiration
 */
function setCookie(name: string, value: string, days: number): void {
    if (!isBrowser()) return;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

/**
 * Delete cookie
 */
function deleteCookie(name: string): void {
    if (!isBrowser()) return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/**
 * Check if the stored referrer has expired
 */
function isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > EXPIRATION_MS;
}

/**
 * Sanitize a potential referrer address (client-side pre-validation)
 * Returns null if obviously invalid, sanitized address otherwise
 * IMPORTANT: This is NOT a substitute for server-side validation
 */
export function sanitizeReferrerAddress(address: string | null | undefined): string | null {
    if (!address || typeof address !== "string") {
        return null;
    }

    // Trim whitespace and convert to lowercase
    const normalized = address.trim().toLowerCase();

    // Empty after trim
    if (!normalized) {
        return null;
    }

    // Validate prefix
    if (!normalized.startsWith(XION_ADDRESS_PREFIX)) {
        return null;
    }

    // Validate length (bech32 addresses have consistent length)
    if (normalized.length !== XION_ADDRESS_LENGTH) {
        return null;
    }

    // Validate characters (bech32 uses specific charset: excludes 1, b, i, o)
    const bech32Regex = /^xion1[02-9ac-hj-np-z]+$/;
    if (!bech32Regex.test(normalized)) {
        return null;
    }

    return normalized;
}

/**
 * Save referrer to localStorage and cookie
 * Called when user arrives via referral link
 */
export function saveReferrer(address: string): void {
    if (!isBrowser() || !address) return;

    const timestamp = Date.now();

    // Save to localStorage
    try {
        localStorage.setItem(REFERRER_KEY, address);
        localStorage.setItem(REFERRER_TIMESTAMP_KEY, timestamp.toString());
    } catch {
        // localStorage might be disabled (private browsing on some browsers)
    }

    // Save to cookie as backup
    setCookie(REFERRER_COOKIE_NAME, `${address}|${timestamp}`, 7);
}

/**
 * Get referrer with priority: URL param > localStorage > cookie
 * Returns null if not found or expired
 * SECURITY: Always sanitizes the address format before returning
 */
export function getReferrer(urlParam?: string | null): string | null {
    // URL param takes highest priority
    if (urlParam) {
        const sanitized = sanitizeReferrerAddress(urlParam);
        if (sanitized) {
            return sanitized;
        }
    }

    if (!isBrowser()) return null;

    // Try localStorage first
    try {
        const storedAddress = localStorage.getItem(REFERRER_KEY);
        const storedTimestamp = localStorage.getItem(REFERRER_TIMESTAMP_KEY);

        if (storedAddress && storedTimestamp) {
            const timestamp = parseInt(storedTimestamp, 10);
            if (!isExpired(timestamp)) {
                // Sanitize stored address
                const sanitized = sanitizeReferrerAddress(storedAddress);
                if (sanitized) {
                    return sanitized;
                }
                // Invalid format - clear it
                clearReferrer();
                return null;
            }
            // Expired - clear it
            clearReferrer();
            return null;
        }
    } catch {
        // localStorage might be disabled
    }

    // Fallback to cookie
    const cookieValue = getCookie(REFERRER_COOKIE_NAME);
    if (cookieValue) {
        const [address, timestampStr] = cookieValue.split("|");
        const timestamp = parseInt(timestampStr, 10);

        if (address && !isNaN(timestamp) && !isExpired(timestamp)) {
            // Sanitize stored address
            const sanitized = sanitizeReferrerAddress(address);
            if (sanitized) {
                return sanitized;
            }
        }
        // Invalid or expired - clear it
        deleteCookie(REFERRER_COOKIE_NAME);
    }

    return null;
}

/**
 * Clear referrer from all storage
 * Call after successful membership registration
 */
export function clearReferrer(): void {
    if (!isBrowser()) return;

    try {
        localStorage.removeItem(REFERRER_KEY);
        localStorage.removeItem(REFERRER_TIMESTAMP_KEY);
    } catch {
        // Ignore localStorage errors
    }

    deleteCookie(REFERRER_COOKIE_NAME);
}

/**
 * Save validated referrer flag
 * Called after server-side validation confirms the referrer
 */
export function markReferrerValidated(address: string): void {
    if (!isBrowser()) return;

    try {
        localStorage.setItem(REFERRER_VALIDATED_KEY, address);
    } catch {
        // localStorage might be disabled
    }
}

/**
 * Check if a referrer has been validated by the server
 */
export function isReferrerValidated(address: string): boolean {
    if (!isBrowser()) return false;

    try {
        const validated = localStorage.getItem(REFERRER_VALIDATED_KEY);
        return validated === address;
    } catch {
        return false;
    }
}

/**
 * Validate that a referrer address is a real member via server-side API
 * Returns validation result with optional username and sanitized address
 * SECURITY: This performs server-side validation which is required before using a referrer
 */
export async function validateReferrer(address: string): Promise<{
    valid: boolean;
    address?: string; // Server-sanitized address
    username?: string;
    error?: string;
}> {
    // Client-side pre-validation
    const sanitized = sanitizeReferrerAddress(address);
    if (!sanitized) {
        return { valid: false, error: "Invalid address format" };
    }

    try {
        // Use the dedicated server-side validation endpoint
        const response = await fetch("/api/referrer/validate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ address: sanitized }),
        });

        if (response.status === 429) {
            return { valid: false, error: "Too many requests. Please wait." };
        }

        if (!response.ok) {
            return { valid: false, error: "Failed to validate referrer" };
        }

        const data = await response.json();

        if (data.valid && data.address) {
            // Store the validated state
            markReferrerValidated(data.address);

            return {
                valid: true,
                address: data.address, // Use server-sanitized address
                username: data.username || undefined,
            };
        }

        return { valid: false, error: data.error || "Referrer is not a member" };
    } catch {
        return { valid: false, error: "Failed to validate referrer" };
    }
}

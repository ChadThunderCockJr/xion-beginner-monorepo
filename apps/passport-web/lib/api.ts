// API client for Paywall Passport
// Updated to use query params for reliability

export interface SessionResponse {
    sessionId: string;
    reclaimSessionId: string;
    requestUrl: string;
    statusUrl: string;
    expiresAt: number;
}

export interface SessionStatus {
    status: 'pending' | 'verified' | 'expired';
    verified21: boolean;
    adEligibility: {
        verified_21: number;
        proof_type?: string;
        exp?: number;
        issuer?: string;
    };
    debug?: {
        reclaimStatus: string;
        reclaimStatusV2: string;
        proofsCount: number;
    };
}

export interface NetworkInfo {
    lanIp: string;
    frontendUrl: string;
    isProduction: boolean;
}

/**
 * Create a new session for TV verification
 */
export async function createSession(): Promise<SessionResponse> {
    const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to create session');
    }

    // Update statusUrl to match new format
    const data = await res.json();
    return data;
}

/**
 * Get the status of a session using Reclaim's session ID
 */
export async function getSessionStatus(reclaimSessionId: string, sessionId?: string): Promise<SessionStatus> {
    let url = `/api/session-status?reclaimSessionId=${reclaimSessionId}`;
    if (sessionId) {
        url += `&sessionId=${sessionId}`;
    }
    const res = await fetch(url, {
        cache: 'no-store'
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to get session status');
    }

    return res.json();
}

/**
 * Demo mode verification
 */
export async function demoVerify(sessionId: string): Promise<void> {
    const res = await fetch(`/api/demo-verify?sessionId=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || 'Demo verification failed');
    }
}

/**
 * Get network info for LAN IP (mobile QR code)
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
    const res = await fetch('/api/network');

    if (!res.ok) {
        throw new Error('Failed to get network info');
    }

    return res.json();
}

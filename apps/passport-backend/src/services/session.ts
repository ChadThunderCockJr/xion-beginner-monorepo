// Session management service
import { v4 as uuidv4 } from 'uuid';
import type { Session, ProofData } from '../types/index.js';

// In-memory session store (use Redis for production)
const sessions = new Map<string, Session>();

// Session expiration time: 15 minutes
const SESSION_TTL_MS = 15 * 60 * 1000;

/**
 * Create a new session
 */
export function createSession(requestUrl: string): Session {
    const id = uuidv4();
    const now = Date.now();

    const session: Session = {
        id,
        status: 'pending',
        verified21: false,
        requestUrl,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
    };

    sessions.set(id, session);

    // Schedule cleanup
    setTimeout(() => {
        const s = sessions.get(id);
        if (s && s.status === 'pending') {
            s.status = 'expired';
        }
    }, SESSION_TTL_MS);

    return session;
}

/**
 * Get a session by ID
 */
export function getSession(id: string): Session | undefined {
    const session = sessions.get(id);

    if (session && Date.now() > session.expiresAt && session.status === 'pending') {
        session.status = 'expired';
    }

    return session;
}

/**
 * Update session with verification result
 */
export function verifySession(id: string, proofData: ProofData): boolean {
    const session = sessions.get(id);

    if (!session) {
        console.error(`Session not found: ${id}`);
        return false;
    }

    if (session.status === 'expired') {
        console.error(`Session expired: ${id}`);
        return false;
    }

    session.status = 'verified';
    session.verified21 = proofData.isVerified21Plus;
    session.proofData = proofData;

    console.log(`Session ${id} verified: 21+ = ${proofData.isVerified21Plus}`);

    return true;
}

/**
 * Get all active sessions (for debugging)
 */
export function getAllSessions(): Session[] {
    return Array.from(sessions.values());
}

/**
 * Delete a session
 */
export function deleteSession(id: string): boolean {
    return sessions.delete(id);
}

// Session management service using Redis (via ioredis)
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface Session {
    id: string;
    status: 'pending' | 'verified' | 'expired';
    verified21: boolean;
    requestUrl: string;
    reclaimSessionId?: string;
    createdAt: number;
    expiresAt: number;
    proofData?: ProofData;
}

export interface ProofData {
    provider: string;
    timestamp: number;
    proofType: string;
    isVerified21Plus: boolean;
}

export interface ReclaimProof {
    identifier: string;
    claimData: {
        provider: string;
        parameters: string;
        context: string;
        timestampS?: number;
    };
    signatures: string[];
    witnesses: {
        id: string;
        url: string;
    }[];
}

const SESSION_TTL_SECONDS = 900; // 15 minutes

const redis = new Redis(process.env.REDIS_URL!);

function sessionKey(id: string): string {
    return `session:${id}`;
}

export async function createSession(requestUrl: string): Promise<Session> {
    const id = uuidv4();
    const now = Date.now();

    const session: Session = {
        id,
        status: 'pending',
        verified21: false,
        requestUrl,
        createdAt: now,
        expiresAt: now + SESSION_TTL_SECONDS * 1000,
    };

    await redis.set(sessionKey(id), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return session;
}

export async function getSession(id: string): Promise<Session | null> {
    const data = await redis.get(sessionKey(id));
    if (!data) return null;
    return JSON.parse(data) as Session;
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
    const session = await getSession(id);
    if (!session) return null;

    const updated = { ...session, ...updates };
    await redis.set(sessionKey(id), JSON.stringify(updated), 'EX', SESSION_TTL_SECONDS);
    return updated;
}

export async function verifySession(id: string, proofData: ProofData): Promise<boolean> {
    const session = await getSession(id);

    if (!session) {
        console.error(`Session not found: ${id}`);
        return false;
    }

    if (session.status === 'expired') {
        console.error(`Session expired: ${id}`);
        return false;
    }

    await updateSession(id, {
        status: 'verified',
        verified21: proofData.isVerified21Plus,
        proofData,
    });

    console.log(`Session ${id} verified: 21+ = ${proofData.isVerified21Plus}`);
    return true;
}

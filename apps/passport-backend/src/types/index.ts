// TypeScript types for Paywall Passport

export interface Session {
    id: string;
    status: 'pending' | 'verified' | 'expired';
    verified21: boolean;
    requestUrl: string;
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

export interface CreateSessionResponse {
    sessionId: string;
    requestUrl: string;
    statusUrl: string;
    expiresAt: number;
}

export interface SessionStatusResponse {
    status: 'pending' | 'verified' | 'expired';
    verified21: boolean;
    adEligibility: {
        verified_21: 0 | 1;
        proof_type?: string;
        exp?: number;
        issuer?: string;
    };
}

export interface ReclaimProof {
    claimData: {
        provider: string;
        parameters: string;
        context: string;
        identifier: string;
        epoch: number;
        timestampS: number;
    };
    signatures: string[];
    witnesses: Array<{
        id: string;
        url: string;
    }>;
}

export interface VerificationResult {
    isVerified21Plus: boolean;
    metadata: {
        provider: string;
        timestamp: number;
        proofType: string;
    };
}

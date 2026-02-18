// Reclaim Protocol integration for Vercel
import { ReclaimProofRequest, verifyProof, type Proof } from '@reclaimprotocol/js-sdk';
import type { ReclaimProof } from './session';

export async function createProofRequest(sessionId: string): Promise<{ requestUrl: string; reclaimSessionId: string }> {
    const appId = process.env.RECLAIM_APP_ID;
    const appSecret = process.env.RECLAIM_APP_SECRET;
    const providerId = process.env.RECLAIM_PROVIDER_ID;

    if (!appId || !appSecret || !providerId) {
        throw new Error('Missing Reclaim configuration. Set RECLAIM_APP_ID, RECLAIM_APP_SECRET, RECLAIM_PROVIDER_ID');
    }

    // Get base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

    const reclaimProofRequest = await ReclaimProofRequest.init(
        appId,
        appSecret,
        providerId,
        { log: process.env.NODE_ENV === 'development' }
    );

    // Set context for this TV session
    reclaimProofRequest.addContext(
        `0x${sessionId.replace(/-/g, '').padStart(40, '0').slice(0, 40)}`,
        'CTV age verification for Paywall Passport'
    );

    // Configure callback URL for proof verification
    reclaimProofRequest.setAppCallbackUrl(
        `${baseUrl}/api/verify/callback?sessionId=${sessionId}`
    );

    // Get Reclaim's session ID first so we can include it in redirect
    const reclaimSessionId = reclaimProofRequest.getSessionId();

    // Set redirect URL after proof submission - use submitted=true to indicate polling needed
    // Do NOT use status=success here as proof may still be pending when redirect happens
    reclaimProofRequest.setRedirectUrl(
        `${baseUrl}/verify?sessionId=${sessionId}&reclaimSessionId=${reclaimSessionId}&submitted=true`
    );

    const requestUrl = await reclaimProofRequest.getRequestUrl();

    console.log(`Created proof request for session ${sessionId}, Reclaim session: ${reclaimSessionId}`);

    return { requestUrl, reclaimSessionId };
}

export async function verifyCreditKarmaProof(proof: ReclaimProof): Promise<{ isVerified21Plus: boolean; metadata: { provider: string; timestamp: number; proofType: string } }> {
    const minScore = parseInt(process.env.MIN_CREDIT_SCORE_FOR_21 || '600', 10);

    try {
        const { claimData } = proof;
        let creditScore: number | null = null;

        // Try to extract from parameters
        try {
            const params = JSON.parse(claimData.parameters);
            creditScore = params.score || params.creditScore || params.credit_score;
        } catch { /* not JSON */ }

        // Try context if not found
        if (!creditScore && claimData.context) {
            try {
                const context = JSON.parse(claimData.context);
                creditScore = context.score || context.creditScore || context.credit_score;
            } catch { /* not JSON */ }
        }

        // Regex fallback
        if (!creditScore) {
            const scoreMatch = (claimData.parameters + claimData.context).match(/(\d{3})/);
            if (scoreMatch) {
                const potentialScore = parseInt(scoreMatch[1], 10);
                if (potentialScore >= 300 && potentialScore <= 850) {
                    creditScore = potentialScore;
                }
            }
        }

        const isVerified21Plus = creditScore !== null && creditScore > minScore;
        console.log(`Credit verification: ${isVerified21Plus ? 'PASS' : 'FAIL'} (threshold: ${minScore})`);

        return {
            isVerified21Plus,
            metadata: {
                provider: 'credit_karma',
                timestamp: claimData.timestampS || Date.now(),
                proofType: 'zktls',
            },
        };
    } catch (error) {
        console.error('Failed to verify Credit Karma proof:', error);
        return {
            isVerified21Plus: false,
            metadata: {
                provider: 'credit_karma',
                timestamp: Date.now(),
                proofType: 'zktls',
            },
        };
    }
}

export async function validateProofSignature(proof: ReclaimProof): Promise<boolean> {
    if (!proof.claimData || !proof.signatures || proof.signatures.length === 0) {
        console.error('Proof missing required fields (claimData or signatures)');
        return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const proofTime = proof.claimData.timestampS || 0;
    const fiveMinutes = 5 * 60;

    if (now - proofTime > fiveMinutes) {
        console.warn('Proof timestamp is too old');
        return false;
    }

    // Use Reclaim SDK to verify the cryptographic signature
    // This ensures the proof is actually valid, not just structurally correct
    try {
        const isValid = await verifyProof(proof as unknown as Proof);
        if (!isValid) {
            console.error('Reclaim proof signature verification failed');
        }
        return isValid;
    } catch (error) {
        console.error('Error verifying Reclaim proof:', error);
        return false;
    }
}

export interface ReclaimSessionStatus {
    message?: string;
    session?: {
        proofs?: unknown[];
        status?: string;
        statusV2?: string;
    };
}

export async function fetchReclaimSessionStatus(sessionId: string): Promise<ReclaimSessionStatus | null> {
    try {
        const response = await fetch(`https://api.reclaimprotocol.org/api/sdk/session/${sessionId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching Reclaim session status:', error);
        return null;
    }
}

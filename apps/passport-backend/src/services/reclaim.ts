// Reclaim Protocol integration service
import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
import type { ReclaimProof, VerificationResult } from '../types/index.js';

/**
 * Create a Reclaim proof request for Credit Karma verification
 */
export async function createProofRequest(sessionId: string): Promise<string> {
    const {
        RECLAIM_APP_ID,
        RECLAIM_APP_SECRET,
        RECLAIM_PROVIDER_ID,
        API_BASE_URL,
        FRONTEND_URL,
    } = process.env;

    if (!RECLAIM_APP_ID || !RECLAIM_APP_SECRET || !RECLAIM_PROVIDER_ID) {
        throw new Error('Missing Reclaim configuration');
    }

    const reclaimProofRequest = await ReclaimProofRequest.init(
        RECLAIM_APP_ID,
        RECLAIM_APP_SECRET,
        RECLAIM_PROVIDER_ID,
        {
            log: process.env.NODE_ENV === 'development',
        }
    );

    // Set context for this TV session
    reclaimProofRequest.addContext(
        `0x${sessionId.replace(/-/g, '').padStart(40, '0').slice(0, 40)}`,
        'CTV age verification for Paywall Passport'
    );

    // Configure callback URL for proof verification
    reclaimProofRequest.setAppCallbackUrl(
        `${API_BASE_URL}/api/verify/callback?sessionId=${sessionId}`
    );

    // Set redirect URL after proof submission
    reclaimProofRequest.setRedirectUrl(
        `${FRONTEND_URL}/verify?sessionId=${sessionId}&status=success`
    );

    // Get the request URL for QR code
    const requestUrl = await reclaimProofRequest.getRequestUrl();

    console.log(`Created proof request for session ${sessionId}`);

    return requestUrl;
}

/**
 * Verify Credit Karma proof and extract age verification status
 */
export async function verifyCreditKarmaProof(proof: ReclaimProof): Promise<VerificationResult> {
    const minScore = parseInt(process.env.MIN_CREDIT_SCORE_FOR_21 || '600', 10);

    try {
        // Extract data from proof
        const { claimData } = proof;

        // Parse the parameters/context to find credit score
        let creditScore: number | null = null;

        // Try to extract from parameters (JSON string)
        try {
            const params = JSON.parse(claimData.parameters);
            creditScore = params.score || params.creditScore || params.credit_score;
        } catch {
            // Parameters might not be JSON
        }

        // Try to extract from context if not found
        if (!creditScore && claimData.context) {
            try {
                const context = JSON.parse(claimData.context);
                creditScore = context.score || context.creditScore || context.credit_score;
            } catch {
                // Context might not be JSON
            }
        }

        // If we still don't have a score, try regex extraction
        if (!creditScore) {
            const scoreMatch = (claimData.parameters + claimData.context).match(/(\d{3})/);
            if (scoreMatch) {
                const potentialScore = parseInt(scoreMatch[1], 10);
                // Credit scores are typically 300-850
                if (potentialScore >= 300 && potentialScore <= 850) {
                    creditScore = potentialScore;
                }
            }
        }

        // Apply age verification logic: score > 600 = 21+
        const isVerified21Plus = creditScore !== null && creditScore > minScore;

        // IMPORTANT: Never log actual credit score in production
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

/**
 * Verify Reclaim proof signature (basic validation)
 */
export function validateProofSignature(proof: ReclaimProof): boolean {
    // Basic validation - check required fields exist
    if (!proof.claimData || !proof.signatures || proof.signatures.length === 0) {
        return false;
    }

    // Check timestamp is recent (within last 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const proofTime = proof.claimData.timestampS || 0;
    const fiveMinutes = 5 * 60;

    if (now - proofTime > fiveMinutes) {
        console.warn('Proof timestamp is too old');
        return false;
    }

    // In production, you'd verify the cryptographic signature here
    // using Reclaim's verification utilities

    return true;
}

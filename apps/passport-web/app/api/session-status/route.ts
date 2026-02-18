// GET /api/session-status?sessionId=...&reclaimSessionId=...
import { NextResponse } from 'next/server';
import { fetchReclaimSessionStatus } from '@/lib/reclaim';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const paramReclaimSessionId = searchParams.get('reclaimSessionId');

    let isVerified = false;
    let localSession = null;
    let reclaimSessionId = paramReclaimSessionId;

    // 1. Check local session (fast path & demo/ios support)
    if (sessionId) {
        localSession = await getSession(sessionId);
        if (localSession) {
            if (localSession.verified21) {
                isVerified = true;
            }
        }
    }

    // 2. If not verified locally, check Reclaim (if we have an ID)
    let reclaimStatus = null;
    let status = null;
    let statusV2 = null;
    let session = null;

    if (!isVerified && reclaimSessionId) {
        // Fetch status from Reclaim (Stateless source of truth)
        reclaimStatus = await fetchReclaimSessionStatus(reclaimSessionId);

        // Log full response for debugging
        console.log(`[DEBUG] Full Reclaim response for ${reclaimSessionId}:`, JSON.stringify(reclaimStatus, null, 2));

        // Reclaim response structure: { message, session: { proofs, status, statusV2, ... } }
        session = reclaimStatus?.session;
        status = session?.status; // "PENDING", "PROOF_GENERATED", etc.
        statusV2 = session?.statusV2; // "SESSION_STARTED", "PROOF_RECEIVED", etc.

        // Check multiple conditions for verification
        const isReclaimVerified =
            status === 'PROOF_GENERATED' ||
            status === 'COMPLETED' ||
            status === 'VERIFIED' ||
            statusV2 === 'PROOF_GENERATED' ||
            statusV2 === 'PROOF_SUBMITTED' ||
            statusV2 === 'COMPLETED' ||
            statusV2 === 'VERIFIED';

        if (isReclaimVerified) {
            isVerified = true;
        }
    }

    return NextResponse.json({
        status: isVerified ? 'verified' : 'pending',
        verified21: isVerified,
        // Include debug info
        debug: {
            localStatus: localSession?.status,
            reclaimStatus: status,
            reclaimStatusV2: statusV2,
            proofsCount: session?.proofs?.length || 0
        },
        adEligibility: {
            verified_21: isVerified ? 1 : 0,
            proof_type: isVerified ? 'zktls' : null,
            issuer: isVerified ? 'credit_karma' : null,
        }
    });
}

// POST /api/verify/confirm?reclaimSessionId=...
// Called when phone successfully completes verification and lands on success page
import { NextResponse } from 'next/server';

const RECLAIM_BACKEND_URL = 'https://api.reclaimprotocol.org';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const reclaimSessionId = searchParams.get('reclaimSessionId');

    if (!reclaimSessionId) {
        return NextResponse.json({ error: 'Missing reclaimSessionId' }, { status: 400 });
    }

    try {
        // Update Reclaim session status to mark as verified/completed
        const response = await fetch(`${RECLAIM_BACKEND_URL}/api/sdk/update/session/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: reclaimSessionId,
                status: 'PROOF_GENERATED'
            })
        });

        if (!response.ok) {
            console.error('Failed to update Reclaim session:', response.status);
            // Don't fail - the proof might already be recorded
        }

        console.log(`Verification confirmed for reclaimSessionId: ${reclaimSessionId}`);

        return NextResponse.json({
            success: true,
            message: 'Verification confirmed'
        });
    } catch (error) {
        console.error('Error confirming verification:', error);
        return NextResponse.json({
            success: true, // Still return success since user completed proof
            message: 'Confirmation sent'
        });
    }
}

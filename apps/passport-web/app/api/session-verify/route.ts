// POST /api/session-verify
// Used by Mobile App to report successful verification
import { NextResponse } from 'next/server';
import { verifySession, ProofData } from '@/lib/session';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sessionId, proofData } = body;

        if (!sessionId || !proofData) {
            return NextResponse.json({ error: 'Missing sessionId or proofData' }, { status: 400 });
        }

        console.log(`[session-verify] Attempting to verify session: ${sessionId}`);
        console.log(`[session-verify] ProofData:`, JSON.stringify(proofData));

        const success = await verifySession(sessionId, proofData as ProofData);
        console.log(`[session-verify] Result: ${success}`);

        if (!success) {
            return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Session verified' });
    } catch (e) {
        console.error('Verify session error', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

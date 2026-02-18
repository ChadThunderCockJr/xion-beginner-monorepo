// POST /api/demo-verify?sessionId=...
import { NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/session';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'expired') {
        return NextResponse.json({ error: 'Session expired' }, { status: 400 });
    }

    // Simulate successful verification
    await updateSession(sessionId, {
        status: 'verified',
        verified21: true,
        proofData: {
            provider: 'demo_mode',
            timestamp: Date.now(),
            proofType: 'demo',
            isVerified21Plus: true,
        },
    });

    console.log(`Demo verification for session: ${sessionId}`);

    return NextResponse.json({ success: true, message: 'Demo verification successful' });
}

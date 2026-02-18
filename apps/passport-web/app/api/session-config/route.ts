// GET /api/session-config?sessionId=...
// Used by App Clip to get Reclaim configuration/URL
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const session = await getSession(sessionId);

    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.requestUrl) {
        return NextResponse.json({ error: 'Session not ready' }, { status: 400 });
    }

    return NextResponse.json({
        sessionId: session.id,
        reclaimRequestUrl: session.requestUrl,
        // Add any other config needed by iOS SDK
    });
}

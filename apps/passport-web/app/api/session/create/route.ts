// POST /api/session/create - Create a new session
import { NextResponse } from 'next/server';
import { createSession, updateSession } from '@/lib/session';
import { createProofRequest } from '@/lib/reclaim';

export async function POST() {
    try {
        // Create a temporary session first
        const session = await createSession('');

        // Generate Reclaim proof request URL and get Reclaim's session ID
        const { requestUrl, reclaimSessionId } = await createProofRequest(session.id);

        // Update session with the request URL
        await updateSession(session.id, { requestUrl });

        console.log(`Session created: ${session.id}, Reclaim session: ${reclaimSessionId}`);

        return NextResponse.json({
            sessionId: session.id,
            reclaimSessionId, // This is what we use to poll Reclaim's status API
            requestUrl,
            statusUrl: `/api/session-status?reclaimSessionId=${reclaimSessionId}`,
            expiresAt: session.expiresAt,
        });
    } catch (error) {
        console.error('Failed to create session:', error);
        return NextResponse.json(
            {
                error: 'Failed to create session',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

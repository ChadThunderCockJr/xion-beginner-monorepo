// POST /api/verify/callback - Reclaim proof callback
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        // Handle potentially URL-encoded body
        let bodyText = await request.text();

        // If body starts with %, it's likely URL encoded
        if (bodyText.startsWith('%')) {
            try {
                bodyText = decodeURIComponent(bodyText);
            } catch (e) {
                console.warn('Failed to decode body URI component', e);
            }
        }

        const proof = JSON.parse(bodyText);

        console.log(`Received verification callback for session: ${sessionId}`);
        console.log('Proof received:', JSON.stringify(proof).slice(0, 200));

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        // Since Vercel is stateless, we don't validate local session.
        // Reclaim's backend handles proof validation.
        // We simply accept the callback and return success.
        // The TV will poll Reclaim's status API for the actual status.

        console.log(`Verification callback accepted for ${sessionId}`);

        return NextResponse.json({
            success: true,
            message: 'Proof received',
        });
    } catch (error) {
        console.error('Verification callback error:', error);
        return NextResponse.json(
            {
                error: 'Verification failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

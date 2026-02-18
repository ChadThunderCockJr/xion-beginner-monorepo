// Session management routes
import { Router } from 'express';
import { createSession, getSession } from '../services/session.js';
import { createProofRequest } from '../services/reclaim.js';
import type { CreateSessionResponse, SessionStatusResponse } from '../types/index.js';

const router = Router();

/**
 * POST /api/session/create
 * Create a new TV session with Reclaim proof request
 */
router.post('/create', async (req, res) => {
    try {
        // Create a temporary session first to get the ID
        const tempSession = createSession('');

        // Generate Reclaim proof request URL
        const requestUrl = await createProofRequest(tempSession.id);

        // Update session with the request URL
        tempSession.requestUrl = requestUrl;

        const response: CreateSessionResponse = {
            sessionId: tempSession.id,
            requestUrl,
            statusUrl: `/api/session/${tempSession.id}/status`,
            expiresAt: tempSession.expiresAt,
        };

        console.log(`Session created: ${tempSession.id}`);

        res.json(response);
    } catch (error) {
        console.error('Failed to create session:', error);
        res.status(500).json({
            error: 'Failed to create session',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * GET /api/session/:sessionId/status
 * Get the current status of a session
 */
router.get('/:sessionId/status', (req, res) => {
    const { sessionId } = req.params;

    const session = getSession(sessionId);

    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    const response: SessionStatusResponse = {
        status: session.status,
        verified21: session.verified21,
        adEligibility: {
            verified_21: session.verified21 ? 1 : 0,
            proof_type: session.proofData?.proofType,
            exp: session.expiresAt ? Math.floor(session.expiresAt / 1000) : undefined,
            issuer: session.proofData?.provider ? 'reclaim' : undefined,
        },
    };

    res.json(response);
});

/**
 * POST /api/session/:sessionId/demo-verify
 * Demo mode: Simulate successful verification
 */
router.post('/:sessionId/demo-verify', (req, res) => {
    const { sessionId } = req.params;

    const session = getSession(sessionId);

    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    if (session.status === 'expired') {
        res.status(400).json({ error: 'Session expired' });
        return;
    }

    // Simulate successful verification
    session.status = 'verified';
    session.verified21 = true;
    session.proofData = {
        provider: 'demo_mode',
        timestamp: Date.now(),
        proofType: 'demo',
        isVerified21Plus: true,
    };

    console.log(`Demo verification for session: ${sessionId}`);

    res.json({ success: true, message: 'Demo verification successful' });
});

export default router;

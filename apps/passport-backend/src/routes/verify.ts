// Verification callback routes
import { Router } from 'express';
import { getSession, verifySession } from '../services/session.js';
import { verifyCreditKarmaProof, validateProofSignature } from '../services/reclaim.js';
import type { ReclaimProof } from '../types/index.js';

const router = Router();

/**
 * POST /api/verify/callback
 * Receive proof from Reclaim Protocol
 */
router.post('/callback', async (req, res) => {
    try {
        const { sessionId } = req.query;
        const proof = req.body as ReclaimProof;

        console.log(`Received verification callback for session: ${sessionId}`);

        if (!sessionId || typeof sessionId !== 'string') {
            res.status(400).json({ error: 'Missing sessionId' });
            return;
        }

        const session = getSession(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        if (session.status === 'expired') {
            res.status(400).json({ error: 'Session expired' });
            return;
        }

        if (session.status === 'verified') {
            res.json({ success: true, message: 'Already verified' });
            return;
        }

        // Validate proof signature
        if (!validateProofSignature(proof)) {
            console.error('Invalid proof signature');
            res.status(400).json({ error: 'Invalid proof' });
            return;
        }

        // Verify Credit Karma proof and extract age verification
        const result = await verifyCreditKarmaProof(proof);

        // Update session
        const success = verifySession(sessionId, {
            ...result.metadata,
            isVerified21Plus: result.isVerified21Plus,
        });

        if (!success) {
            res.status(500).json({ error: 'Failed to update session' });
            return;
        }

        console.log(`Verification complete for ${sessionId}: 21+ = ${result.isVerified21Plus}`);

        res.json({
            success: true,
            verified21: result.isVerified21Plus,
        });
    } catch (error) {
        console.error('Verification callback error:', error);
        res.status(500).json({
            error: 'Verification failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;

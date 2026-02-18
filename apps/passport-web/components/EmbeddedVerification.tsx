'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { demoVerify, getSessionStatus } from '@/lib/api';

interface EmbeddedVerificationProps {
    sessionId: string;
    requestUrl: string;
    onSuccess: () => void;
    onError: (error: string) => void;
}

type Step = 'init' | 'qr' | 'waiting' | 'success' | 'error';

export default function EmbeddedVerification({
    sessionId,
    requestUrl,
    onSuccess,
    onError,
}: EmbeddedVerificationProps) {
    const [step, setStep] = useState<Step>('init');
    const [error, setError] = useState<string | null>(null);

    // Start verification - show QR code
    const startVerification = () => {
        setStep('qr');
    };

    // Demo mode for CES
    const handleDemoVerify = async () => {
        setStep('waiting');
        try {
            await demoVerify(sessionId);
            setTimeout(() => {
                setStep('success');
                onSuccess();
            }, 1500);
        } catch (err) {
            setError('Demo verification failed');
            setStep('error');
            onError('Demo verification failed');
        }
    };

    // Poll for verification status when showing QR
    useEffect(() => {
        if (step !== 'qr' && step !== 'waiting') return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await getSessionStatus(sessionId);
                if (status.verified21) {
                    setStep('success');
                    onSuccess();
                    clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('Status poll error:', err);
            }
        }, 1500);

        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
            if (step === 'qr' || step === 'waiting') {
                clearInterval(pollInterval);
                setError('Verification timed out');
                setStep('error');
                onError('Verification timed out');
            }
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
        };
    }, [step, sessionId, onSuccess, onError]);

    return (
        <div className="embedded-verification">
            {step === 'init' && (
                <div className="verification-options">
                    <button
                        className="btn btn-primary"
                        onClick={startVerification}
                    >
                        Verify with Credit Karma
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleDemoVerify}
                    >
                        Demo Mode (CES)
                    </button>
                </div>
            )}

            {step === 'qr' && (
                <div className="verification-qr">
                    <h3>Scan with your phone's camera</h3>
                    <p className="subtitle">Complete verification on your phone</p>

                    <div className="qr-wrapper">
                        <QRCodeSVG
                            value={requestUrl}
                            size={200}
                            level="M"
                            includeMargin={false}
                        />
                    </div>

                    <p className="waiting-text">
                        <span className="dot-animation">●</span>
                        Waiting for verification...
                    </p>

                    <button
                        className="btn btn-link"
                        onClick={() => setStep('init')}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {step === 'waiting' && (
                <div className="verification-waiting">
                    <div className="spinner large" />
                    <h3>Verifying...</h3>
                    <p>Creating zero-knowledge proof</p>
                </div>
            )}

            {step === 'success' && (
                <div className="verification-success">
                    <div className="success-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <h3>Verified! ✓</h3>
                    <p>You're verified as 21+</p>
                </div>
            )}

            {step === 'error' && (
                <div className="verification-error">
                    <div className="error-icon">✕</div>
                    <h3>Verification Failed</h3>
                    <p>{error || 'Something went wrong'}</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setError(null);
                            setStep('init');
                        }}
                    >
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}

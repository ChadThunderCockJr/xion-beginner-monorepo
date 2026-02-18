'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { demoVerify, getSessionStatus, SessionStatus } from '@/lib/api';

function VerificationContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    const reclaimSessionId = searchParams.get('reclaimSessionId');
    const requestUrl = searchParams.get('requestUrl');
    const statusParam = searchParams.get('status');

    const [step, setStep] = useState<'consent' | 'verifying' | 'success' | 'error'>('consent');
    const [error, setError] = useState<string | null>(null);
    const [lastStatus, setLastStatus] = useState<SessionStatus | null>(null);

    // After Reclaim redirect, start polling for actual verification status
    // Do NOT show success immediately - wait for backend to confirm proof is valid
    // Check for both 'submitted=true' (new) and 'status=success' (legacy) params
    useEffect(() => {
        const submittedParam = searchParams.get('submitted');
        if ((statusParam === 'success' || submittedParam === 'true') && step === 'consent') {
            setStep('verifying');  // Show "Verifying..." while we poll for backend confirmation
        }
    }, [statusParam, searchParams, step]);

    // Poll to check if verification completed (runs during consent or verifying steps)
    useEffect(() => {
        if ((step !== 'consent' && step !== 'verifying') || !sessionId) return;
        const checkStatus = async () => {
            try {
                // Use reclaimSessionId if available (preferred), otherwise sessionId (legacy)
                const idToCheck = reclaimSessionId || sessionId;
                const status = await getSessionStatus(idToCheck);
                setLastStatus(status); // Update debug info
                if (status.verified21) setStep('success');
            } catch (err) {
                console.error('Status check error:', err);
            }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 2000);
        return () => clearInterval(interval);
    }, [step, sessionId, reclaimSessionId]);

    const handleReclaimVerify = async () => {
        let targetUrl = requestUrl;
        if (!targetUrl && sessionId) {
            try {
                const res = await fetch(`/api/session-config?sessionId=${sessionId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.reclaimRequestUrl) targetUrl = data.reclaimRequestUrl;
                }
            } catch (e) {
                console.error('Failed to fetch config', e);
            }
        }
        if (!targetUrl) {
            setError('Missing verification URL. Please scan the QR code again.');
            setStep('error');
            return;
        }
        window.location.href = targetUrl;
    };

    const handleDemoVerify = async () => {
        if (!sessionId) {
            setError('Missing session ID');
            setStep('error');
            return;
        }
        setStep('verifying');
        try {
            await demoVerify(sessionId);
            setTimeout(() => setStep('success'), 1500);
        } catch (err) {
            setError('Verification failed. Please try again.');
            setStep('error');
        }
    };

    // No session - invalid access
    if (!sessionId) {
        return (
            <div className="verify-container">
                <div className="verify-card">
                    <div className="error-state">
                        <div className="error-icon-circle">
                            <span>?</span>
                        </div>
                        <h2>Invalid Session</h2>
                        <p>Please scan the QR code on your TV to start verification.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="verify-container">
            {/* Header */}
            <header className="verify-header">
                <img src="/paywall-passport-icon.png" alt="Paywall Passport" className="verify-logo" />
                <h1>Paywall Passport</h1>
            </header>

            {/* Main Content Card */}
            <main className="verify-main">
                {step === 'consent' && (
                    <>
                        <div className="verify-hero">
                            <h2>Skip the Wait</h2>
                            <p>Verify you're 21+ and watch just <strong>1 minute</strong> of ads instead of 10</p>
                        </div>

                        <div className="privacy-cards">
                            <div className="privacy-card shared">
                                <div className="card-header">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>What We Share</span>
                                </div>
                                <ul>
                                    <li>Your 21+ status only</li>
                                </ul>
                            </div>

                            <div className="privacy-card private">
                                <div className="card-header">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <span>What Stays Private</span>
                                </div>
                                <ul>
                                    <li>Your exact date of birth</li>
                                    <li>Your ID document images</li>
                                    <li>Your personal details</li>
                                </ul>
                            </div>
                        </div>

                        <footer className="verify-footer">
                            <button className="btn-primary" onClick={handleReclaimVerify}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4" />
                                    <circle cx="12" cy="12" r="10" />
                                </svg>
                                Verify Age
                            </button>
                            <button className="btn-secondary" onClick={handleDemoVerify}>
                                Demo Mode
                            </button>
                            <p className="footer-note">Powered by zero-knowledge proofs • Only your age status is shared</p>
                        </footer>
                    </>
                )}

                {step === 'verifying' && (
                    <div className="status-card">
                        <div className="spinner-large" />
                        <h2>Verifying...</h2>
                        <p>This will only take a moment</p>

                        {/* Debug Info for User Feedback */}
                        {lastStatus?.debug && (
                            <div className="debug-info">
                                <p>Reclaim Status: {lastStatus.debug.reclaimStatus || 'N/A'}</p>
                                <p>Status V2: {lastStatus.debug.reclaimStatusV2 || 'N/A'}</p>
                            </div>
                        )}
                    </div>
                )}

                {step === 'success' && (
                    <div className="status-card success">
                        <div className="success-icon-large">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h2>You're Verified!</h2>
                        <p>Your TV is now set for reduced ads.<br />You can close this page.</p>
                        <div className="success-badge">
                            <span>✓ 21+ Verified</span>
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="status-card error">
                        <div className="error-icon-large">!</div>
                        <h2>Something Went Wrong</h2>
                        <p>{error || 'Please try again'}</p>
                        <button className="btn-primary" onClick={() => setStep('consent')}>
                            Try Again
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="verify-container">
                <div className="status-card">
                    <div className="spinner-large" />
                </div>
            </div>
        }>
            <VerificationContent />
        </Suspense>
    );
}

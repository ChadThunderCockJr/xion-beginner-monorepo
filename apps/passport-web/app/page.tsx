'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createSession, getSessionStatus, SessionResponse, SessionStatus } from '@/lib/api';

export default function CTVDisplay() {
    const searchParams = useSearchParams();
    const forceSessionId = searchParams.get('sessionId');

    const [session, setSession] = useState<SessionResponse | null>(null);
    const [status, setStatus] = useState<SessionStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
    const [beerAdCountdown, setBeerAdCountdown] = useState(60); // 60 seconds for beer ad
    const [lanBaseUrl, setLanBaseUrl] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Determine base URL for QR code apiUrl parameter.
    // In production, use the current origin so the iOS app hits the same host the TV is on.
    // Only fetch LAN IP in local development (non-HTTPS) for mobile testing.
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
            setLanBaseUrl(window.location.origin);
            return;
        }
        const fetchNetworkInfo = async () => {
            try {
                const res = await fetch('/api/network');
                const data = await res.json();
                setLanBaseUrl(data.frontendUrl);
            } catch (err) {
                setLanBaseUrl(window.location.origin);
            }
        };
        fetchNetworkInfo();
    }, []);

    // Create session on mount (or use forced session ID)
    useEffect(() => {
        async function initSession() {
            try {
                // If a forced session ID is provided, use it (for testing sync)
                if (forceSessionId) {
                    console.log('[TV] Using forced session ID:', forceSessionId);
                    setSession({
                        sessionId: forceSessionId,
                        reclaimSessionId: '', // Not needed for polling with sessionId
                        requestUrl: '',
                        statusUrl: '',
                        expiresAt: Date.now() + 600000,
                    });
                    setError(null);
                    return;
                }

                const newSession = await createSession();
                setSession(newSession);
                setError(null);
            } catch (err) {
                console.error('Failed to create session:', err);
                setError('Failed to create session. Please refresh the page.');
            }
        }
        initSession();
    }, [forceSessionId]);

    // Poll for status updates
    useEffect(() => {
        if (!session) return;

        const pollInterval = setInterval(async () => {
            try {
                const newStatus = await getSessionStatus(session.reclaimSessionId, session.sessionId);

                // If verified, pause 2 seconds before updating the UI
                if (newStatus.verified21 && !status?.verified21) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                setStatus(newStatus);

                // If verified, reduce ad countdown to 1 minute (beer ad time)
                if (newStatus.verified21) {
                    setCountdown(prev => prev > 60 ? 60 : prev);
                }
            } catch (err) {
                console.error('Failed to get status:', err);
            }
        }, 1000);

        return () => clearInterval(pollInterval);
    }, [session]);

    // Main countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 0) return 0;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Beer ad countdown (only when verified)
    useEffect(() => {
        if (!status?.verified21) return;
        const timer = setInterval(() => {
            setBeerAdCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [status?.verified21]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const isVerified = status?.verified21 === true;
    const showBeerAd = isVerified && beerAdCountdown > 0;
    const adComplete = isVerified && beerAdCountdown <= 0;

    // Video URLs
    const genericAdVideo = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
    const beerAdVideo = "/heineken-ad.mp4";
    const currentVideoSrc = showBeerAd ? beerAdVideo : genericAdVideo;

    // Reload video when source changes (for browser compatibility)
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.src = currentVideoSrc;
            videoRef.current.load();
            videoRef.current.play().catch((err) => {
                // Video autoplay may be blocked by browser policy
                if (process.env.NODE_ENV === 'development') {
                    console.warn('Video autoplay blocked:', err);
                }
            });
        }
    }, [currentVideoSrc]);

    // Build the verification URL for QR code
    const baseUrl = lanBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    // Use custom scheme to open iOS app
    const verifyUrl = session
        ? `paywall-passport://verify?sessionId=${session.sessionId}&apiUrl=${encodeURIComponent(baseUrl)}`
        : '';

    return (
        <div className="tv-container">
            {/* Video/Image Player - Full Screen */}
            <div className="video-player">
                {/* Always show video - source changes based on verification status */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="video-element"
                />

                {/* Overlay gradient for better QR visibility */}
                <div className="video-overlay" />

                {/* Verified Badge - appears after verification */}
                {isVerified && (
                    <div className="verified-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Verified 21+</span>
                    </div>
                )}
            </div>

            {/* Side Panel with QR Code - Glassmorphism Style */}
            {!adComplete && (
                <div className={`qr-panel ${isVerified ? 'verified' : ''}`}>
                    <div className="qr-panel-content">
                        {/* Logo */}
                        <div className="panel-logo">
                            <img src="/paywall-passport-icon.png" alt="Paywall Passport" />
                        </div>

                        {error ? (
                            <>
                                <h2 className="panel-title error">Connection Error</h2>
                                <p className="panel-subtitle">{error}</p>
                                <button className="retry-btn" onClick={() => window.location.reload()}>
                                    Retry
                                </button>
                            </>
                        ) : !session ? (
                            <>
                                <h2 className="panel-title">Paywall Passport</h2>
                                <div className="spinner" />
                                <p className="panel-subtitle">Initializing...</p>
                            </>
                        ) : isVerified ? (
                            <>
                                <h2 className="panel-title">Paywall Passport</h2>
                                <div className="success-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <h2 className="panel-title success">Verified!</h2>
                                <p className="panel-subtitle">
                                    Enjoy your premium experience
                                </p>
                                <div className="beer-countdown">
                                    <span className="countdown-label">Ad ends in</span>
                                    <span className="countdown-time">{formatTime(beerAdCountdown)}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="panel-title">Skip the Wait</h2>
                                <p className="panel-subtitle">
                                    Scan to verify you're 21+ and watch just 1 minute of ads
                                </p>

                                <div className="qr-wrapper">
                                    <QRCodeSVG
                                        value={verifyUrl}
                                        size={160}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>

                                <p className="scan-instruction">
                                    Point your camera here
                                </p>

                                <div className="countdown-box">
                                    <span className="countdown-label">Ad break</span>
                                    <span className="countdown-time">{formatTime(countdown)}</span>
                                </div>

                                <p className="panel-branding">Paywall Passport</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

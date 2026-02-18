"use client";

import { useAbstraxionAccount } from "@burnt-labs/abstraxion";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { generateReferralLink } from "@/lib/xion";
import { getDisplayName, getInitials, getBadgeTier } from "@/lib/username";
import { useToast } from "@/contexts/ToastContext";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Confetti } from "@/components/ui/Confetti";
import { PyramidSpinner } from "@/components/ui/PyramidSpinner";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { useMembershipStatus } from "@/hooks/useMembershipStatus";

interface ReferralStats {
    totalEarnings: string;
    referralCount: number;
    referrals: Array<{
        walletAddress: string;
        username?: string;
        joinedAt: string;
        earning: string;
    }>;
}

// Cryptic messages for background
const crypticMessages = [
    "THE EYE SEES ALL",
    "ASCEND THE PYRAMID",
    "NOVUS ORDO SECLORUM",
    "AS ABOVE SO BELOW",
    "$5 PER SOUL",
    "THE ARCHITECTURE OF CONTROL",
    "TRUST THE ALGORITHM",
    "WEALTH FLOWS UPWARD",
    "ILLUMINATE YOUR PATH",
    "THE HIERARCHY IS ETERNAL",
    "PROFIT IS DIVINE",
    "ENTER THE ORDER",
    "THE CAPSTONE AWAITS",
    "ANNUIT COEPTIS",
    "BUILD YOUR EMPIRE",
    "THE NETWORK EXPANDS",
    "RECRUIT OR BE FORGOTTEN",
    "POWER IN NUMBERS",
    "THE SCHEME IS SACRED",
    "PROSPERITY THROUGH HIERARCHY"
];

export default function DashboardPage() {
    const { data: account, isConnected, isConnecting, login, logout } = useAbstraxionAccount();

    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [referralLink, setReferralLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Unified membership check (blockchain + database)
    const { isMember, username, isLoading: membershipLoading } = useMembershipStatus();

    // Combined loading state
    const loading = statsLoading || membershipLoading;

    // Celebration states
    const [showConfetti, setShowConfetti] = useState(false);
    const previousStatsRef = useRef<ReferralStats | null>(null);
    const { celebrate } = useToast();
    const celebrateRef = useRef(celebrate);
    const initialLoadRef = useRef(true);

    // Keep celebrate ref updated
    useEffect(() => { celebrateRef.current = celebrate; }, [celebrate]);

    const fetchStats = useCallback(async () => {
        if (!account?.bech32Address) return;

        try {
            const response = await fetch(`/api/referrals?address=${account.bech32Address}`);
            if (response.ok) {
                const data = await response.json();

                // Check for new recruits (only after initial load)
                if (previousStatsRef.current && !initialLoadRef.current) {
                    const prevCount = previousStatsRef.current.referralCount;
                    const newCount = data.referralCount;

                    if (newCount > prevCount) {
                        // New recruit detected!
                        const newRecruit = data.referrals[0];
                        setShowConfetti(true);
                        celebrateRef.current(
                            `${newRecruit?.username || "Someone"} joined your pyramid!`,
                            "+$5.00 earned"
                        );
                    }
                }

                initialLoadRef.current = false;
                previousStatsRef.current = data;
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        } finally {
            setStatsLoading(false);
        }
    }, [account?.bech32Address]);

    useEffect(() => {
        if (account?.bech32Address) {
            setReferralLink(generateReferralLink(account.bech32Address));
            fetchStats();

            // Poll for stats every 15 seconds to detect new recruits
            const interval = setInterval(fetchStats, 15000);
            return () => clearInterval(interval);
        }
    }, [account?.bech32Address, fetchStats]);

    // Track mouse position for spotlight effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const copyLink = async () => {
        if (referralLink) {
            await navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: "Join the Pyramid",
            text: "Enter the pyramid. $8 to join, earn $5 per recruit. △",
            url: referralLink,
        };

        // Try native share API first
        if (navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // User cancelled or share failed, fall back to copy
                if ((err as Error).name !== "AbortError") {
                    await copyLink();
                }
            }
        } else {
            // Fallback to copy
            await copyLink();
        }
    };

    if (!isConnected) {
        return (
            <>
                {/* Mouse spotlight effect */}
                <div
                    className="spotlight"
                    style={{
                        left: `${mousePosition.x}px`,
                        top: `${mousePosition.y}px`,
                    }}
                />

                {/* Background graffiti text */}
                <div className="graffiti-layer">
                    {crypticMessages.map((message, i) => {
                        const x = (i * 73 + 23) % 120 - 10;
                        const y = (i * 97 + 41) % 130 - 15;
                        const rotation = (i * 17) % 60 - 30;
                        const size = 0.8 + (i % 3) * 0.2;

                        const textX = (x / 100) * (typeof window !== 'undefined' ? window.innerWidth : 1920);
                        const textY = (y / 100) * (typeof window !== 'undefined' ? window.innerHeight : 1080);
                        const distance = Math.sqrt(
                            Math.pow(mousePosition.x - textX, 2) + Math.pow(mousePosition.y - textY, 2)
                        );
                        const maxDistance = 300;
                        const brightness = Math.max(0, 1 - distance / maxDistance);

                        return (
                            <span
                                key={i}
                                className="graffiti-text"
                                style={{
                                    left: `${x}%`,
                                    top: `${y}%`,
                                    transform: `rotate(${rotation}deg)`,
                                    fontSize: `${size}rem`,
                                    opacity: 0.02 + brightness * 0.15,
                                }}
                            >
                                {message}
                            </span>
                        );
                    })}
                </div>

                <nav className="navbar">
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="btn btn-ghost btn-sm opacity-50">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Backroom
                        </span>
                    </div>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center">
                        <h2 className="text-xl font-semibold mb-3">Access Denied</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Connect to view your headquarters.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => login()}
                            disabled={isConnecting}
                        >
                            {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Not a member - show locked state
    if (!loading && !isMember) {
        return (
            <>
                <nav className="navbar">
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
                            Logout
                        </button>
                    </div>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center">
                        <div className="mb-4 flex justify-center">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-3">Members Only</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Join the pyramid to access your dashboard and start earning.
                        </p>
                        <Link href="/join" className="btn btn-primary">
                            Join for $8
                        </Link>
                    </div>
                </div>
            </>
        );
    }

    // Get tier progress info
    const getTierProgress = () => {
        const count = stats?.referralCount || 0;
        const tiers = [
            { name: "Initiate", min: 0, max: 2 },
            { name: "Operator", min: 2, max: 5 },
            { name: "Architect", min: 5, max: 10 },
            { name: "Apex", min: 10, max: Infinity },
        ];

        const currentTierIndex = tiers.findIndex(t => count >= t.min && count < t.max);
        const currentTier = tiers[currentTierIndex] || tiers[0];
        const nextTier = tiers[currentTierIndex + 1];

        if (!nextTier) {
            return { progress: 100, toNext: 0, nextName: null };
        }

        const progressInTier = count - currentTier.min;
        const tierRange = nextTier.min - currentTier.min;
        const progress = (progressInTier / tierRange) * 100;
        const toNext = nextTier.min - count;

        return { progress: Math.min(progress, 100), toNext, nextName: nextTier.name };
    };

    const tierProgress = getTierProgress();

    return (
        <>
            {/* Celebration components */}
            <Confetti
                active={showConfetti}
                onComplete={() => setShowConfetti(false)}
            />

            <nav className="navbar">
                <Link href="/" className="navbar-brand">
                    <span>△</span>
                    <span>PYRAMID</span>
                </Link>
                <div className="flex items-center gap-3">
                    {isMember ? (
                        <Link href="/chat" className="btn btn-ghost btn-sm">
                            Backroom
                        </Link>
                    ) : (
                        <span className="btn btn-ghost btn-sm opacity-50">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            Backroom
                        </span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => logout()}>
                        Logout
                    </button>
                </div>
            </nav>

            <div className="dashboard-container" id="main-content">
                <div className="dashboard-header">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl font-semibold">Recruitment Headquarters</h1>
                        {stats && (
                            <span className={`badge ${getBadgeTier(stats.referralCount).class}`}>
                                {getBadgeTier(stats.referralCount).emoji} {getBadgeTier(stats.referralCount).name}
                            </span>
                        )}
                    </div>
                    <p className="text-primary mt-2 text-sm font-mono">
                        {username || (account?.bech32Address?.slice(0, 12) + "...")}
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-12 flex flex-col items-center">
                        <PyramidSpinner size="lg" />
                        <p className="text-muted-foreground mt-4 text-sm">Loading your headquarters...</p>
                    </div>
                ) : (
                    <>
                        <div className="dashboard-grid">
                            <div className="card dashboard-stat-card card-glow">
                                <div className="dashboard-stat-label">Total Earned</div>
                                <div className="dashboard-stat-value">
                                    <AnimatedCounter
                                        value={parseFloat(stats?.totalEarnings || "0")}
                                        format="currency"
                                        decimals={2}
                                    />
                                </div>
                                <p className="text-muted-foreground text-sm mt-2">
                                    Paid instantly to your account
                                </p>
                            </div>

                            <div className="card dashboard-stat-card card-glow">
                                <div className="dashboard-stat-label">Recruits</div>
                                <div className="dashboard-stat-value">
                                    <AnimatedCounter
                                        value={stats?.referralCount || 0}
                                        format="number"
                                    />
                                </div>
                                <p className="text-muted-foreground text-sm mt-2">
                                    $5 per head
                                </p>

                                {/* Tier progress bar */}
                                {tierProgress.nextName && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs mb-2">
                                            <span className="text-muted-foreground">Progress to {tierProgress.nextName}</span>
                                            <span className="text-primary">{tierProgress.toNext} more</span>
                                        </div>
                                        <div className="h-2 bg-[hsl(220,12%,16%)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full progress-shimmer rounded-full transition-all duration-500"
                                                style={{ width: `${tierProgress.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card card-glow mt-6">
                            <h3 className="font-semibold mb-3">Your Recruitment Link</h3>
                            <p className="text-muted-foreground text-sm mb-4">
                                Share this. Earn when they join. Keep it quiet.
                            </p>
                            <div className="referral-link-box">
                                <input
                                    type="text"
                                    className="input referral-link-input"
                                    value={referralLink}
                                    readOnly
                                />
                                <button
                                    className={`btn btn-primary ${copied ? "copied" : ""}`}
                                    onClick={copyLink}
                                >
                                    {copied ? "✓ Copied" : "Copy"}
                                </button>
                            </div>

                            <div className="flex gap-2 mt-4 flex-wrap">
                                <a
                                    href={`https://twitter.com/intent/tweet?text=Enter%20the%20pyramid.%20%248%20to%20join%2C%20earn%20%245%20per%20recruit.%20%E2%96%B3&url=${encodeURIComponent(referralLink)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm flex-1"
                                >
                                    X (Twitter)
                                </a>
                                <a
                                    href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Enter%20the%20pyramid.%20%248%20to%20join%2C%20earn%20%245%20per%20recruit.%20%E2%96%B3`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm flex-1"
                                >
                                    Telegram
                                </a>
                                <a
                                    href={`https://wa.me/?text=${encodeURIComponent(
                                        `Enter the pyramid. $8 to join, earn $5 per recruit. △\n\n${referralLink}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm flex-1"
                                >
                                    WhatsApp
                                </a>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                            <div className="card card-glow">
                                <h3 className="font-semibold mb-3">Your Recruits</h3>
                                {stats?.referrals && stats.referrals.length > 0 ? (
                                    <div className="space-y-2">
                                        {stats.referrals.slice(0, 5).map((r, i) => (
                                            <div
                                                key={i}
                                                className="flex justify-between items-center py-2 border-b border-border last:border-0"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {r.username ? (
                                                        <>
                                                            <span className="avatar-circle-sm">
                                                                {getInitials(r.username)}
                                                            </span>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-sm">
                                                                    {getDisplayName(r.username)}
                                                                </span>
                                                                <span className="text-muted-foreground text-xs">
                                                                    {new Date(r.joinedAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div>
                                                            <span className="font-mono text-sm">{r.walletAddress.slice(0, 8)}...</span>
                                                            <span className="text-muted-foreground text-xs ml-2">
                                                                {new Date(r.joinedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-primary font-semibold">+${r.earning}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-muted-foreground text-sm">No recruits yet</p>
                                        <p className="text-muted-foreground text-xs mt-1">
                                            Share your link to start earning
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="card card-glow">
                                <LiveActivityFeed maxItems={5} pollInterval={15000} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

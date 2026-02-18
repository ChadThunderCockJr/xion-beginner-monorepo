"use client";

import { useAbstraxionAccount } from "@burnt-labs/abstraxion";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { getInitials } from "@/lib/username";
import { Confetti } from "@/components/ui/Confetti";
import { useMembershipStatus } from "@/hooks/useMembershipStatus";

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

interface Message {
    id: string;
    authorName?: string; // Legacy
    authorAddress: string;
    username?: string;
    content: string;
    timestamp: Date;
    isEncrypted?: boolean;
}

interface Credits {
    total: number;
    used: number;
    available: number;
}

interface TopRecruiter {
    address: string;
    username: string;
    referralCount: number;
}

interface OnlineMember {
    address: string;
    username: string | null;
    isYou: boolean;
}

export default function ChatPage() {
    const { data: account, isConnected, isConnecting, login } = useAbstraxionAccount();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);

    // Unified membership check (blockchain + database)
    const { isMember, isLoading: checkingMembership } = useMembershipStatus();
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [onlineMembers, setOnlineMembers] = useState<OnlineMember[]>([]);
    const [credits, setCredits] = useState<Credits>({ total: 0, used: 0, available: 0 });
    const [topRecruiters, setTopRecruiters] = useState<TopRecruiter[]>([]);
    const [copied, setCopied] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [showConfetti, setShowConfetti] = useState(false);

    // Add chat-view class to html element to prevent page scroll
    useEffect(() => {
        if (isMember && isConnected) {
            document.documentElement.classList.add("chat-view");
            return () => {
                document.documentElement.classList.remove("chat-view");
            };
        }
    }, [isMember, isConnected]);

    // Close sidebar on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSidebarOpen) {
                setIsSidebarOpen(false);
            }
        };
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isSidebarOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fetch messages from API
    const fetchMessages = async () => {
        try {
            const response = await fetch("/api/chat?limit=50");
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.messages) {
                    // Convert timestamp strings to Date objects
                    const messagesWithDates = data.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp),
                    }));

                    // Merge with existing messages to prevent disappearing optimistic messages
                    setMessages((prevMessages) => {
                        // Create a map of existing messages by ID for quick lookup
                        const existingMap = new Map(prevMessages.map((m: Message) => [m.id, m]));

                        // Add all fetched messages to the map (overwrites if exists)
                        messagesWithDates.forEach((m: Message) => existingMap.set(m.id, m));

                        // Convert back to array and sort by timestamp
                        return Array.from(existingMap.values()).sort(
                            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                        );
                    });
                }
            } else {
                setError("Failed to load messages");
            }
        } catch (err) {
            console.error("Failed to fetch messages:", err);
            setError("Failed to load messages");
        } finally {
            setIsLoadingMessages(false);
        }
    };

    // Fetch online members
    const fetchOnlineMembers = async () => {
        try {
            const viewerParam = account?.bech32Address ? `?viewer=${account.bech32Address}` : "";
            const response = await fetch(`/api/presence${viewerParam}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.online) {
                    setOnlineMembers(data.online);
                }
            }
        } catch (err) {
            console.error("Failed to fetch online members:", err);
        }
    };

    // Send presence heartbeat
    const sendHeartbeat = async () => {
        if (!account?.bech32Address) return;

        try {
            await fetch("/api/presence", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    address: account.bech32Address,
                }),
            });
        } catch (err) {
            console.error("Failed to send heartbeat:", err);
        }
    };

    // Fetch user credits
    const fetchCredits = useCallback(async () => {
        if (!account?.bech32Address) return;

        try {
            const response = await fetch(`/api/credits?address=${account.bech32Address}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCredits(data.credits);
                }
            }
        } catch (err) {
            console.error("Failed to fetch credits:", err);
        }
    }, [account?.bech32Address]);

    // Fetch top recruiters leaderboard
    const fetchLeaderboard = async () => {
        try {
            const response = await fetch("/api/leaderboard");
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setTopRecruiters(data.recruiters);
                }
            }
        } catch (err) {
            console.error("Failed to fetch leaderboard:", err);
        }
    };

    // Copy referral link with fallback for older browsers
    const copyReferralLink = async () => {
        if (!account?.bech32Address) return;
        const link = `${window.location.origin}/?ref=${account.bech32Address}`;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(link);
            } else {
                // Fallback for older browsers
                const textarea = document.createElement("textarea");
                textarea.value = link;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        if (isMember && isConnected) {
            fetchMessages();
            fetchOnlineMembers();
            fetchCredits();
            fetchLeaderboard();

            // Poll messages every 3 seconds
            const messagesInterval = setInterval(fetchMessages, 3000);

            // Poll online members every 5 seconds
            const presenceInterval = setInterval(fetchOnlineMembers, 5000);

            // Refresh leaderboard every 30 seconds
            const leaderboardInterval = setInterval(fetchLeaderboard, 30000);

            return () => {
                clearInterval(messagesInterval);
                clearInterval(presenceInterval);
                clearInterval(leaderboardInterval);
            };
        }
    }, [isMember, isConnected, fetchCredits]);

    // Send presence heartbeat every 30 seconds
    useEffect(() => {
        if (isMember && isConnected && account?.bech32Address) {
            // Send immediately
            sendHeartbeat();

            // Then send every 30 seconds
            const heartbeatInterval = setInterval(sendHeartbeat, 30000);

            return () => clearInterval(heartbeatInterval);
        }
    }, [isMember, isConnected, account?.bech32Address]);

    // Track mouse position for spotlight effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);


    /**
     * Sanitize message content to prevent XSS and other injection attacks
     * Removes potentially dangerous characters while preserving safe content
     */
    const sanitizeMessageContent = (content: string): string => {
        if (!content || typeof content !== "string") {
            return "";
        }

        return content
            // Trim whitespace
            .trim()
            // Remove null bytes and other control characters (except newlines/tabs)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            // Limit to max length (server enforces 1000, but we can trim early)
            .slice(0, 1000);
    };

    // Process slash commands
    const processSlashCommand = (message: string): { content: string; triggerConfetti: boolean } => {
        const sanitized = sanitizeMessageContent(message);
        const trimmedLower = sanitized.toLowerCase();

        switch (trimmedLower) {
            case "/pyramid":
                return { content: "△", triggerConfetti: false };
            case "/shrug":
                return { content: "¯\\_(ツ)_/¯ △", triggerConfetti: false };
            case "/rain":
                return { content: "💰 Making it rain! 💰", triggerConfetti: true };
            case "/flex":
                return { content: `△ I have recruited ${credits.total / 5} pyramid members`, triggerConfetti: false };
            default:
                return { content: sanitized, triggerConfetti: false };
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !account?.bech32Address) return;

        // Check credits before sending
        if (credits.available <= 0) {
            setError("You're out of messages. Recruit to unlock more!");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            const { content: contentToSend, triggerConfetti } = processSlashCommand(newMessage);

            // Trigger confetti for /rain command
            if (triggerConfetti) {
                setShowConfetti(true);
            }

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    authorAddress: account.bech32Address,
                    content: contentToSend,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Optimistically add message to UI
                    const newMsg: Message = {
                        ...data.message,
                        timestamp: new Date(data.message.timestamp),
                    };
                    setMessages((prev) => [...prev, newMsg]);
                    setNewMessage("");
                    // Refresh credits after sending
                    fetchCredits();
                }
            } else {
                const errorData = await response.json();
                setError(errorData.error || "Failed to send message");
                // Refresh credits in case they changed
                fetchCredits();
            }
        } catch (err) {
            console.error("Failed to send message:", err);
            setError("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };



    const formatTimestamp = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    // Show loading skeleton while fetching initial messages
    if (isConnected && isMember && isLoadingMessages) {
        return (
            <>
                <nav className="navbar">
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="btn btn-ghost btn-sm text-primary">Backroom</span>
                        <Link href="/dashboard" className="btn btn-secondary btn-sm">
                            Headquarters
                        </Link>
                    </div>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <p className="text-muted-foreground">Loading messages...</p>
                </div>
            </>
        );
    }

    // Not connected
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
                        <span className="btn btn-ghost btn-sm text-primary">Backroom</span>
                    </div>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center">
                        <h2 className="text-xl font-semibold mb-3">Members Only</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Connect to access the backroom.
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

    // Loading membership check
    if (checkingMembership) {
        return (
            <>
                <nav className="navbar">
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <p className="text-muted-foreground">Checking access...</p>
                </div>
            </>
        );
    }

    // Not a member
    if (!isMember) {
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
                        <Link href="/join" className="btn btn-primary btn-sm">
                            Pledge
                        </Link>
                    </div>
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center">
                        <div className="text-4xl mb-4">△</div>
                        <h2 className="text-xl font-semibold mb-3">Access Locked</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            The backroom is for members only.
                            <br />
                            Pay $8 to unlock.
                        </p>
                        <Link href="/join" className="btn btn-primary">
                            Pledge Loyalty
                        </Link>
                    </div>
                </div>
            </>
        );
    }

    // Member - show chat
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

            {/* Confetti for /rain command */}
            <Confetti
                active={showConfetti}
                onComplete={() => setShowConfetti(false)}
                particleCount={60}
                duration={2000}
            />

            <nav className="navbar">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="sm:hidden btn btn-ghost btn-sm p-2"
                        aria-label="Open members list"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    <span className="btn btn-ghost btn-sm text-primary hidden sm:inline-flex">Backroom</span>
                    <Link href="/dashboard" className="btn btn-secondary btn-sm">
                        Headquarters
                    </Link>
                </div>
            </nav>

            {/* Mobile drawer backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 sm:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <div
                className={`fixed right-0 bottom-0 w-72 bg-background border-l border-border z-50 transition-transform duration-300 sm:hidden overflow-y-auto ${isSidebarOpen ? "translate-x-0" : "translate-x-full"
                    }`}
                style={{ top: '4rem' }}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-sm text-primary">
                            △ Connected
                        </h3>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="btn btn-ghost btn-sm p-1"
                            aria-label="Close members list"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Credits Display */}
                    <div className="mb-6 p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Messages</span>
                            <span className={`text-sm font-semibold ${credits.available === 0 ? "text-red-400" : credits.available === 1 ? "text-amber-400" : "text-primary"}`}>
                                {credits.available}
                            </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${credits.available === 0 ? "bg-red-400/70" : credits.available === 1 ? "bg-amber-400" : "progress-shimmer"}`}
                                style={{ width: `${credits.available === 0 ? 100 : credits.total > 0 ? (credits.available / credits.total) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-xs mt-2 text-muted-foreground">
                            {credits.available === 0 ? "Recruit to unlock more" : credits.available === 1 ? "Last message!" : `${credits.available} remaining`}
                        </p>
                    </div>

                    {/* Connected Members */}
                    <div className="members-list mb-6">
                        {onlineMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Waiting for others...
                            </p>
                        ) : (
                            onlineMembers.map((member) => {
                                const isYou = member.isYou;
                                const displayName = member.username || `${member.address.slice(0, 8)}...`;
                                return (
                                    <div key={member.address} className="member-item">
                                        <div className="member-status" />
                                        <span
                                            className={`text-sm ${isYou ? "text-primary" : ""}`}
                                        >
                                            {isYou ? `you (${displayName})` : displayName}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Top Recruiters */}
                    <div className="pt-6 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-3">Pyramid Elite</p>
                        {topRecruiters.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                Be the first recruiter
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {topRecruiters.slice(0, 5).map((recruiter, index) => (
                                    <div key={recruiter.address} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-primary font-mono">{index + 1}.</span>
                                            <span className="truncate max-w-[120px]">{recruiter.username}</span>
                                        </div>
                                        <span className="text-muted-foreground">{recruiter.referralCount} △</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recruit CTA */}
                    <div className="pt-6 mt-6 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Each recruit = 5 messages</p>
                        <button
                            onClick={copyReferralLink}
                            className="btn btn-primary btn-sm w-full"
                        >
                            {copied ? "Copied!" : "Copy Referral Link"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="chat-container" id="main-content">
                <div className="chat-main">
                    <div className="chat-messages" aria-live="polite" aria-label="Chat messages">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-500 text-sm">
                                {error}
                            </div>
                        )}
                        {messages.length === 0 && !isLoadingMessages && (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                No messages yet. Be the first to say something! △
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className="chat-message">
                                <div className="chat-avatar">
                                    {getInitials(msg.username || msg.authorName || "Anonymous")}
                                </div>
                                <div className="chat-message-content">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="chat-message-author">{msg.username || msg.authorName}</div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            {msg.isEncrypted && (
                                                <svg className="w-2.5 h-2.5 opacity-40" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4z"/>
                                                </svg>
                                            )}
                                            {formatTimestamp(msg.timestamp)}
                                        </div>
                                    </div>
                                    <div className="chat-message-text">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {credits.available > 0 ? (
                        <form className="chat-input-container" onSubmit={handleSend}>
                            <input
                                type="text"
                                className="input flex-1"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => {
                                    // Limit input length to prevent excessive data
                                    const value = e.target.value.slice(0, 1000);
                                    setNewMessage(value);
                                }}
                                disabled={isSending}
                                aria-label="Chat message"
                                maxLength={1000}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={!newMessage.trim() || isSending}
                            >
                                Send
                            </button>
                        </form>
                    ) : (
                        <div className="chat-input-container justify-center">
                            <p className="text-sm text-muted-foreground">You&apos;re out of messages. Recruit to unlock more →</p>
                        </div>
                    )}
                </div>

                <div className="chat-sidebar">
                    <h3 className="font-semibold text-sm mb-4 text-primary">
                        △ Connected
                    </h3>

                    {/* Credits Display */}
                    <div className="mb-6 p-3 rounded-lg bg-secondary/50">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Messages</span>
                            <span className={`text-sm font-semibold ${credits.available === 0 ? "text-red-400" : credits.available === 1 ? "text-amber-400" : "text-primary"}`}>
                                {credits.available}
                            </span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${credits.available === 0 ? "bg-red-400/70" : credits.available === 1 ? "bg-amber-400" : "progress-shimmer"}`}
                                style={{ width: `${credits.available === 0 ? 100 : credits.total > 0 ? (credits.available / credits.total) * 100 : 0}%` }}
                            />
                        </div>
                        <p className="text-xs mt-2 text-muted-foreground">
                            {credits.available === 0 ? "Recruit to unlock more" : credits.available === 1 ? "Last message!" : `${credits.available} remaining`}
                        </p>
                    </div>

                    {/* Connected Members */}
                    <div className="members-list">
                        {onlineMembers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Waiting for others...
                            </p>
                        ) : (
                            onlineMembers.map((member) => {
                                const isYou = member.isYou;
                                const displayName = member.username || `${member.address.slice(0, 8)}...`;
                                return (
                                    <div key={member.address} className="member-item">
                                        <div className="member-status" />
                                        <span
                                            className={`text-sm ${isYou ? "text-primary" : ""}`}
                                        >
                                            {isYou ? `you (${displayName})` : displayName}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Top Recruiters */}
                    <div className="mt-6 pt-6 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-3">Pyramid Elite</p>
                        {topRecruiters.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                Be the first recruiter
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {topRecruiters.slice(0, 5).map((recruiter, index) => (
                                    <div key={recruiter.address} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-primary font-mono">{index + 1}.</span>
                                            <span className="truncate max-w-[120px]">{recruiter.username}</span>
                                        </div>
                                        <span className="text-muted-foreground">{recruiter.referralCount} △</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recruit CTA */}
                    <div className="mt-6 pt-6 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Each recruit = 5 messages</p>
                        <button
                            onClick={copyReferralLink}
                            className="btn btn-primary btn-sm w-full"
                        >
                            {copied ? "Copied!" : "Copy Referral Link"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

"use client";

// Crossmint Integration: Using pyramid2 template and updated API key
// Treasury contract configured for gasless transactions
import {
    useAbstraxionAccount,
    useAbstraxionSigningClient,
} from "@burnt-labs/abstraxion";
import { CrossmintProvider, CrossmintEmbeddedCheckout } from "@crossmint/client-sdk-react-ui";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import {
    USDC_DENOM,
    ENTRY_FEE_AMOUNT,
    CROSSMINT_COLLECTION_ID,
    PYRAMID_CONTRACT,
    generateReferralLink,
    formatUSDC,
} from "@/lib/xion";
import { generateSuggestion } from "@/lib/username";
import { getReferrer, saveReferrer, clearReferrer, validateReferrer } from "@/lib/referrer";
import { Confetti } from "@/components/ui/Confetti";
import { PyramidSpinner } from "@/components/ui/PyramidSpinner";
import { useToast } from "@/contexts/ToastContext";

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

type PaymentMethod = "card" | "usdc" | null;
type PaymentState = "alias" | "selecting" | "checkout" | "success";

const CROSSMINT_CLIENT_API_KEY = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY || "";

function JoinContent() {
    const { data: account, isConnected, isConnecting, isReturningFromAuth, login, logout } = useAbstraxionAccount();
    const { client } = useAbstraxionSigningClient();
    const searchParams = useSearchParams();

    const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>(null);
    const [paymentState, setPaymentState] = useState<PaymentState>("alias");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [referrer, setReferrer] = useState<string | null>(null);
    const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
    const [referrerValid, setReferrerValid] = useState<boolean | null>(null);
    const [referralLink, setReferralLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [usdcBalance, setUsdcBalance] = useState<string>("0");
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [showConfetti, setShowConfetti] = useState(false);
    const { celebrate } = useToast();

    // Alias state
    const [alias, setAlias] = useState("");
    const [aliasAvailable, setAliasAvailable] = useState<boolean | null>(null);
    const [validatingAlias, setValidatingAlias] = useState(false);
    const [aliasMessage, setAliasMessage] = useState("");

    // NFT ownership state
    const [hasNFT, setHasNFT] = useState<boolean | null>(null);
    const [checkingNFT, setCheckingNFT] = useState(false);
    const [pollingForNFT, setPollingForNFT] = useState(false);
    const [initialCheckDone, setInitialCheckDone] = useState(false); // Track if initial check completed

    // Check alias availability
    const checkAlias = async (val: string) => {
        if (!val || val.length < 3) return;
        setValidatingAlias(true);
        setAliasMessage("");

        try {
            const res = await fetch(`/api/username/check?username=${encodeURIComponent(val)}`);
            const data = await res.json();

            if (data.available) {
                setAliasAvailable(true);
                setAliasMessage("Available");
            } else {
                setAliasAvailable(false);
                setAliasMessage(data.error || "Username taken");
            }
        } catch (e) {
            console.error(e);
            setAliasAvailable(false);
            setAliasMessage("Error checking availability");
        } finally {
            setValidatingAlias(false);
        }
    };

    const handleAliasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Sanitize alias input: only allow alphanumeric, underscore, hyphen
        // Max length: 30 characters
        const raw = e.target.value;
        const sanitized = raw
            .replace(/[^a-zA-Z0-9_-]/g, "") // Remove invalid characters
            .slice(0, 30); // Limit length

        setAlias(sanitized);
        setAliasAvailable(null);
        setAliasMessage("");
    };

    const confirmAlias = () => {
        if (aliasAvailable) {
            setPaymentState("selecting");
        }
    };

    // Check if user owns an NFT from Crossmint
    const checkNFTOwnership = async (address: string): Promise<boolean> => {
        if (!client) return false;

        const nftContract = process.env.NEXT_PUBLIC_CROSSMINT_NFT_CONTRACT?.trim();
        if (!nftContract) {
            console.error("NFT contract address not configured");
            return false;
        }

        // Normalize addresses to lowercase (bech32 requirement) and trim whitespace
        const normalizedAddress = address.toLowerCase().trim();
        const normalizedContract = nftContract.toLowerCase().trim();

        // Validate address format
        if (!normalizedAddress || !normalizedAddress.startsWith('xion1')) {
            console.error("Invalid address format:", address);
            return false;
        }

        try {
            console.log("Checking NFT ownership:", {
                nftContract: normalizedContract,
                userAddress: normalizedAddress
            });

            // Query CW721 tokens owned by address
            const result = await client.queryContractSmart(normalizedContract, {
                tokens: {
                    owner: normalizedAddress,
                    limit: 1 // We only need to know if they own at least one
                }
            });

            console.log("NFT query result:", result);

            // If result.tokens is an array with items, user owns NFT(s)
            const ownsNFT = result?.tokens && Array.isArray(result.tokens) && result.tokens.length > 0;
            console.log("User owns NFT:", ownsNFT);

            return ownsNFT;
        } catch (error) {
            console.error("Failed to check NFT ownership:", error);
            // Don't block the flow if query fails - user can still proceed with payment
            return false;
        }
    };

    useEffect(() => {
        const fetchBalance = async () => {
            if (client && account?.bech32Address) {
                try {
                    const balances = await client.getAllBalances(account.bech32Address);
                    const usdcCoin = balances.find(b => b.denom === USDC_DENOM);
                    if (usdcCoin) setUsdcBalance(usdcCoin.amount);
                } catch (e) { console.error("Balance fetch failed:", e); }
            }
        };
        fetchBalance();
    }, [client, account?.bech32Address]);

    useEffect(() => {
        const ref = searchParams.get("ref");
        const storedRef = getReferrer(ref); // Priority: URL param > localStorage > cookie (with sanitization)

        if (storedRef) {
            // Validate referrer is a real member via server-side API
            // SECURITY: We don't trust client-side referrer codes - must be validated
            validateReferrer(storedRef).then(result => {
                setReferrerValid(result.valid);

                if (result.valid && result.address) {
                    // Use the server-validated and sanitized address
                    setReferrer(result.address);
                    saveReferrer(result.address);

                    if (result.username) {
                        setReferrerUsername(result.username);
                    }
                } else {
                    // Invalid referrer - don't use it
                    setReferrer(null);
                    clearReferrer();
                }
            });
        }
    }, [searchParams]);

    // Persist alias selection (wrapped in try-catch for private browsing compatibility)
    useEffect(() => {
        try {
            const savedAlias = localStorage.getItem("burnt_pyramid_alias");
            const savedState = localStorage.getItem("burnt_pyramid_payment_state") as PaymentState;

            if (savedAlias) {
                setAlias(savedAlias);
                checkAlias(savedAlias);
                if (savedState && savedState !== "alias" && savedState !== "success") {
                    setPaymentState(savedState);
                }
            }
        } catch {
            // localStorage not available (private browsing)
        }
    }, []);

    useEffect(() => {
        try {
            if (alias) {
                localStorage.setItem("burnt_pyramid_alias", alias);
            }
        } catch {
            // localStorage not available
        }
    }, [alias]);

    useEffect(() => {
        try {
            if (paymentState !== "success") {
                localStorage.setItem("burnt_pyramid_payment_state", paymentState);
            } else {
                // Clear on success and trigger celebration
                localStorage.removeItem("burnt_pyramid_alias");
                localStorage.removeItem("burnt_pyramid_payment_state");
                clearReferrer();
                setShowConfetti(true);
                // Show toast after a short delay
                setTimeout(() => {
                    celebrate("Welcome to the pyramid!", "You are now INITIATE");
                }, 500);
            }
        } catch {
            // localStorage not available
            if (paymentState === "success") {
                clearReferrer();
                setShowConfetti(true);
                setTimeout(() => {
                    celebrate("Welcome to the pyramid!", "You are now INITIATE");
                }, 500);
            }
        }
    }, [paymentState]);

    useEffect(() => {
        if (account?.bech32Address) {
            setReferralLink(generateReferralLink(account.bech32Address));
        }
    }, [account?.bech32Address]);

    // Track mouse position for spotlight effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Check membership and NFT ownership on mount and when client/account changes
    useEffect(() => {
        const checkMembershipAndNFT = async () => {
            if (!account?.bech32Address) return;

            // If client not ready yet, wait for it (but mark as checking to show loading)
            if (!client) {
                return;
            }

            setCheckingNFT(true);

            try {
                // First check if already a member by querying the pyramid contract
                if (PYRAMID_CONTRACT) {
                    try {
                        const memberInfo = await client.queryContractSmart(PYRAMID_CONTRACT, {
                            member: { address: account.bech32Address }
                        });

                        // Check is_member field - contract returns { is_member: bool, member: Option<MemberInfo> }
                        if (memberInfo && memberInfo.is_member === true) {
                            console.log("User is already a member, showing success screen");
                            setPaymentState("success");
                            setCheckingNFT(false);
                            setInitialCheckDone(true);
                            return;
                        }
                    } catch (error) {
                        // Member query failed, might not be a member or contract error
                        console.log("Member query failed (likely not a member):", error);
                    }
                }

                // Not a member yet, check if they have NFT (paid but not claimed)
                const owns = await checkNFTOwnership(account.bech32Address);
                setHasNFT(owns);
            } catch (error) {
                console.error("Failed to check membership status:", error);
                // On error, just check NFT ownership
                const owns = await checkNFTOwnership(account.bech32Address);
                setHasNFT(owns);
            }

            setCheckingNFT(false);
            setInitialCheckDone(true);
        };

        checkMembershipAndNFT();
    }, [client, account?.bech32Address]);

    // Poll for NFT ownership after Crossmint checkout starts
    useEffect(() => {
        if (paymentState !== "checkout" || !client || !account?.bech32Address) {
            setPollingForNFT(false);
            return;
        }

        setPollingForNFT(true);

        // Poll every 5 seconds
        const pollInterval = setInterval(async () => {
            const owns = await checkNFTOwnership(account.bech32Address);

            if (owns) {
                setHasNFT(true);
                setPollingForNFT(false);
                setPaymentState("selecting"); // Exit checkout to show claim UI
                console.log("NFT detected! User can now claim membership.");
                clearInterval(pollInterval);
            }
        }, 5000);

        // Stop polling after 5 minutes
        const timeout = setTimeout(() => {
            clearInterval(pollInterval);
            setPollingForNFT(false);
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
        };
    }, [paymentState, client, account?.bech32Address]);

    const copyLink = async () => {
        if (referralLink) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(referralLink);
                } else {
                    // Fallback for older browsers
                    const textarea = document.createElement("textarea");
                    textarea.value = referralLink;
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
        }
    };

    // USDC Payment - uses smart contract if deployed, otherwise treasury
    const handleUSDCPayment = async () => {
        if (!account?.bech32Address || !client) {
            setError("Wallet not connected");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {


            if (!PYRAMID_CONTRACT) {
                setError("Payment system unavailable (Contract not configured).");
                setIsProcessing(false);
                return;
            }

            // Use smart contract - it handles the payment splitting
            // Only include referrer if it's a valid non-empty address
            const joinMsg = {
                join: referrer && referrer.trim().length > 0 ? { referrer: referrer.trim() } : {},
            };

            const result = await client.execute(
                account.bech32Address,
                PYRAMID_CONTRACT,
                joinMsg,
                "auto",
                "Burnt Pyramid Membership",
                [{ denom: USDC_DENOM, amount: ENTRY_FEE_AMOUNT }]
            );
            console.log("Contract join result:", result);

            // Record membership in backend (for off-chain tracking)
            const response = await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: account.bech32Address,
                    username: alias,
                    referrerAddress: referrer,
                    transactionHash: result.transactionHash,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to record membership");
            }

            // Show success screen
            setPaymentState("success");
        } catch (err: unknown) {
            console.error("Payment failed:", err);
            const rawError = err instanceof Error ? err.message : "Payment failed";

            // User-friendly error messages
            if (rawError.includes("insufficient funds") || rawError.includes("spendable balance") || rawError.includes("smaller than")) {
                setError("Insufficient USDC balance. You need $8 to join.");
            } else if (rawError.includes("AlreadyMember")) {
                setError("You're already a member!");
                setPaymentState("success");
            } else if (rawError.includes("ReferrerNotFound")) {
                setError("Invalid referrer. They must be a member first.");
            } else if (rawError.includes("SelfReferral")) {
                setError("You cannot refer yourself.");
            } else if (rawError.includes("InsufficientBalance") || rawError.includes("Insufficient contract balance")) {
                setError("The pyramid treasury is temporarily empty. The admin has been notified — please try again shortly.");
            } else if (rawError.includes("rejected") || rawError.includes("denied")) {
                setError("Transaction was cancelled.");
            } else {
                setError("Payment failed. Please try again.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCardPayment = () => {
        if (!CROSSMINT_CLIENT_API_KEY) {
            console.error("Crossmint API key missing");
            setError("Card payments are currently unavailable. Please contact support or use your USDC balance.");
            return;
        }
        if (!CROSSMINT_COLLECTION_ID) {
            console.error("Crossmint collection ID missing");
            setError("Card payments are currently unavailable. Please contact support.");
            return;
        }
        if (!account?.bech32Address) {
            setError("Please connect your wallet first.");
            return;
        }

        console.log("Opening Crossmint checkout with pyramid2 template ID: ca88b7d6-419a-4b73-bc49-05cd4adf932b");

        setError(null);
        setPaymentState("checkout");
    };

    const handleClaim = async () => {
        if (!client || !account?.bech32Address) {
            setError("Wallet not connected");
            return;
        }

        if (!alias || !aliasAvailable) {
            setError("Please enter a valid alias first");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const claimMsg = {
                claim: referrer && referrer.trim().length > 0
                    ? { referrer: referrer.trim() }
                    : {},
            };

            const result = await client.execute(
                account.bech32Address,
                PYRAMID_CONTRACT,
                claimMsg,
                "auto",
                "Join Pyramid"
            );
            console.log("Claim result:", result);

            // Update membership record with username
            await fetch("/api/members", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: account.bech32Address,
                    username: alias,
                }),
            });

            // Ensure member record exists
            await fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    walletAddress: account.bech32Address,
                    referrerAddress: referrer,
                    transactionHash: result.transactionHash,
                    username: alias,
                }),
            });

            setPaymentState("success");
        } catch (err: unknown) {
            console.error("Claim failed:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);

            console.log("Claim error details:", {
                message: errorMessage,
                contractAddress: PYRAMID_CONTRACT,
                nftContract: process.env.NEXT_PUBLIC_CROSSMINT_NFT_CONTRACT,
                userAddress: account.bech32Address,
            });

            if (errorMessage.includes("NoNftOwnership") || errorMessage.includes("No payment received")) {
                setError("NFT not found. Please wait a few moments after payment completes.");
            } else if (errorMessage.includes("InsufficientBalance") || errorMessage.includes("Insufficient contract balance")) {
                setError("The pyramid treasury is temporarily empty. The admin has been notified — please try again shortly.");
            } else if (errorMessage.includes("AlreadyMember")) {
                setError("You're already a member!");
                setPaymentState("success");
            } else if (errorMessage.includes("rejected") || errorMessage.includes("denied")) {
                setError("Transaction was cancelled.");
            } else {
                setError("Claim failed. Please try again or contact support if this persists.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

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
                </nav>
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center">
                        <h2 className="text-xl font-semibold mb-3">Access Required</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Connect your account to proceed.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => login()}
                            disabled={isConnecting || isReturningFromAuth}
                        >
                            {isConnecting || isReturningFromAuth ? "Connecting..." : "Connect"}
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Loading state - checking membership/NFT status before showing alias form
    // Show loading if: connected AND (checking OR initial check not done yet)
    if (paymentState === "alias" && (!initialCheckDone || checkingNFT)) {
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

                <nav className="navbar">
                    <Link href="/" className="navbar-brand">
                        <span>△</span>
                        <span>PYRAMID</span>
                    </Link>
                </nav>

                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm text-center flex flex-col items-center">
                        <PyramidSpinner size="lg" className="mb-4" />
                        <p className="text-muted-foreground text-sm">Checking membership status...</p>
                    </div>
                </div>
            </>
        );
    }

    // Alias Selection Step
    if (paymentState === "alias") {
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
                    <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
                        Logout
                    </button>
                </nav>

                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="card max-w-sm w-full text-center">
                        <h2 className="text-xl font-semibold mb-2">Claim Your Identity</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Choose a unique alias for the pyramid.
                        </p>

                        <div className="mb-6">
                            <div className="relative">
                                <input
                                    type="text"
                                    className={`input w-full ${aliasAvailable === true ? 'border-primary' : aliasAvailable === false ? 'border-destructive' : ''}`}
                                    placeholder="shadow_walker"
                                    value={alias}
                                    onChange={handleAliasChange}
                                    onBlur={() => checkAlias(alias)}
                                    aria-label="Choose your pyramid alias"
                                    aria-describedby="alias-status"
                                />
                            </div>

                            <div id="alias-status" className="mt-2 min-h-[20px] text-left text-xs" aria-live="polite">
                                {validatingAlias && <span className="text-muted-foreground">Checking...</span>}
                                {!validatingAlias && aliasMessage && (
                                    <span className={aliasAvailable ? "text-primary" : "text-destructive"}>
                                        {aliasMessage}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <button
                                className="btn btn-secondary btn-sm flex-1 text-xs"
                                onClick={() => {
                                    const suggestion = generateSuggestion();
                                    setAlias(suggestion);
                                    checkAlias(suggestion);
                                }}
                            >
                                🎲 Suggestion
                            </button>
                        </div>

                        <button
                            className="btn btn-primary w-full"
                            onClick={confirmAlias}
                            disabled={!aliasAvailable || validatingAlias}
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Success screen - show referral link
    if (paymentState === "success") {
        return (
            <>
                {/* Celebration confetti */}
                <Confetti
                    active={showConfetti}
                    onComplete={() => setShowConfetti(false)}
                    particleCount={100}
                />

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
                    <div className="flex items-center gap-2">
                        <Link href="/chat" className="btn btn-ghost btn-sm">
                            Backroom
                        </Link>
                        <button className="btn btn-secondary btn-sm" onClick={() => logout()}>
                            Logout
                        </button>
                    </div>
                </nav>

                <div className="min-h-screen flex items-center justify-center px-4 pt-20">
                    <div className="card max-w-md w-full text-center">
                        <div className="text-5xl mb-4">△</div>
                        <h2 className="text-2xl font-semibold mb-2">You&apos;re In</h2>
                        <p className="text-muted-foreground mb-8">
                            The inner circle awaits. Choose your path.
                        </p>

                        {/* Two paths */}
                        <div className="flex flex-col gap-3">
                            {/* Backroom path */}
                            <Link
                                href="/chat"
                                className="group flex items-center gap-4 py-4 px-6 rounded-xl border border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 transition-all"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg text-primary">◈</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        Enter the Backroom
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Where initiates gather in the shadows
                                    </p>
                                </div>
                                <span className="text-muted-foreground group-hover:text-primary transition-colors text-lg">→</span>
                            </Link>

                            {/* Recruit path */}
                            <Link
                                href="/dashboard"
                                className="group flex items-center gap-4 py-4 px-6 rounded-xl border border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 transition-all"
                            >
                                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-lg text-primary">$</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        Begin Recruiting
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Earn <span className="text-primary">$5</span> for every soul you bring
                                    </p>
                                </div>
                                <span className="text-muted-foreground group-hover:text-primary transition-colors text-lg">→</span>
                            </Link>
                        </div>

                        {/* Quick share section */}
                        <div className="border-t border-border py-8 mt-8">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                                Quick Share
                            </p>

                            <div className="referral-link-box mb-4">
                                <input
                                    type="text"
                                    className="input referral-link-input"
                                    value={referralLink}
                                    readOnly
                                    aria-label="Your referral link"
                                />
                                <button
                                    className={`btn btn-primary ${copied ? "copied" : ""}`}
                                    onClick={copyLink}
                                >
                                    {copied ? "✓" : "Copy"}
                                </button>
                            </div>

                            <div className="flex gap-2 justify-center flex-wrap">
                                <a
                                    href={`https://twitter.com/intent/tweet?text=Enter%20the%20pyramid.%20%248%20to%20join%2C%20earn%20%245%20per%20recruit.%20%E2%96%B3&url=${encodeURIComponent(referralLink)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                >
                                    Twitter
                                </a>
                                <a
                                    href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Enter%20the%20pyramid.%20%248%20to%20join%2C%20earn%20%245%20per%20recruit.%20%E2%96%B3`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                >
                                    Telegram
                                </a>
                                <a
                                    href={`https://wa.me/?text=${encodeURIComponent(
                                        `Enter the pyramid. $8 to join, earn $5 per recruit. △\n\n${referralLink}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary btn-sm"
                                >
                                    WhatsApp
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Crossmint checkout
    if (paymentState === "checkout" && CROSSMINT_CLIENT_API_KEY) {
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
                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPaymentState("selecting")}
                        >
                            ← Back
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
                            Logout
                        </button>
                    </div>
                </nav>

                <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-8">
                    <div className="w-full max-w-sm">
                        <h2 className="text-xl font-semibold mb-6 text-center">Complete Payment</h2>

                        {/* Crossmint checkout - using pyramid1 collection */}
                        <div className="crossmint-checkout-container">
                            <CrossmintProvider apiKey={CROSSMINT_CLIENT_API_KEY}>
                                <CrossmintEmbeddedCheckout
                                    lineItems={{
                                        collectionLocator: `crossmint:${CROSSMINT_COLLECTION_ID}`,
                                    }}
                                    recipient={{
                                        walletAddress: account?.bech32Address || "",
                                    }}
                                    payment={{
                                        fiat: { enabled: true },
                                        crypto: { enabled: false },
                                    }}
                                    appearance={{
                                        variables: {
                                            colors: {
                                                backgroundPrimary: "hsl(220, 14%, 10%)",
                                                textPrimary: "#ffffff",
                                                textSecondary: "hsl(215, 12%, 55%)",
                                                accent: "hsl(160, 84%, 39%)",
                                            },
                                            borderRadius: "8px",
                                        },
                                        rules: {
                                            DestinationInput: {
                                                display: "hidden",
                                            },
                                        },
                                    }}
                                />
                            </CrossmintProvider>
                        </div>

                        {/* Back to payment selection */}
                        <div className="mt-6 text-center">
                            <button
                                className="text-sm text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setError(null);
                                    setPaymentState("selecting");
                                }}
                            >
                                ← Pay with balance instead
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Payment selection
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

                    const textX = (x / 100) * window.innerWidth;
                    const textY = (y / 100) * window.innerHeight;
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
                <div className="flex items-center gap-2">
                    <Link href="/" className="btn btn-ghost btn-sm">
                        ← Back
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
                        Logout
                    </button>
                </div>
            </nav>

            <div className="min-h-screen flex items-center justify-center px-4 pt-20">
                <div className="card max-w-md w-full">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-semibold mb-2">Unlock Access</h2>
                        <p className="text-muted-foreground">
                            One-time payment: <span className="text-primary font-semibold">$8</span>
                        </p>
                        {referrer && (
                            <p className="text-xs mt-2">
                                {referrerValid === null ? (
                                    <span className="text-muted-foreground">Checking referrer...</span>
                                ) : referrerValid ? (
                                    <span className="text-primary/70">
                                        Referred by {referrerUsername ? `@${referrerUsername}` : `${referrer.slice(0, 8)}...${referrer.slice(-4)}`}
                                    </span>
                                ) : (
                                    <span className="text-yellow-500">Referrer not found - you can still join</span>
                                )}
                            </p>
                        )}
                    </div>

                    {/* Show claim button if user already has NFT */}
                    {hasNFT === true ? (
                        <div className="space-y-4">
                            <p className="text-sm text-center text-muted-foreground mb-6 flex items-center justify-center gap-1.5">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Payment confirmed
                            </p>

                            <button
                                className="btn btn-primary w-full"
                                disabled={isProcessing}
                                onClick={handleClaim}
                            >
                                {isProcessing ? "Processing..." : "Claim Membership"}
                            </button>

                            {error && (
                                <div className="p-4 bg-destructive/5 rounded-lg">
                                    <p className="text-sm text-destructive/90 text-center leading-relaxed">{error}</p>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-border">
                                <p className="text-xs font-medium mb-3 text-muted-foreground">What you get:</p>
                                <ul className="text-sm text-muted-foreground space-y-1.5">
                                    <li>✓ Lifetime access to the pyramid</li>
                                    <li>✓ Your unique recruitment link</li>
                                    <li>✓ $5 per recruit</li>
                                    <li>✓ Instant payouts</li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <>
                            {checkingNFT ? (
                                <div className="text-center py-8 flex flex-col items-center">
                                    <PyramidSpinner size="lg" className="mb-4" />
                                    <p className="text-sm text-muted-foreground">Checking payment status...</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-muted-foreground mb-4">Select payment method:</p>

                                    <div className="payment-options">
                                <div
                                    className={`payment-option ${selectedPayment === "card" ? "selected" : ""}`}
                                    onClick={() => { setSelectedPayment("card"); setError(null); }}
                                >
                                    <div className="payment-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="2" y="5" width="20" height="14" rx="2" />
                                            <line x1="2" y1="10" x2="22" y2="10" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="payment-label">Credit Card</div>
                                        <div className="payment-description">Visa, Mastercard, Apple Pay</div>
                                    </div>
                                </div>

                                <div
                                    className={`payment-option ${selectedPayment === "usdc" ? "selected" : ""}`}
                                    onClick={() => { setSelectedPayment("usdc"); setError(null); }}
                                >
                                    <div className="payment-icon">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <path d="M12 6v12M9 9h6M9 15h6" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="payment-label">Pay from balance</div>
                                        <div className="payment-description">Available: ${formatUSDC(usdcBalance)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                {selectedPayment === "card" && (
                                    <button className="btn btn-primary w-full" onClick={handleCardPayment}>
                                        Pledge with Card
                                    </button>
                                )}

                                {selectedPayment === "usdc" && (
                                    <>
                                        <button
                                            className="btn btn-primary w-full"
                                            onClick={handleUSDCPayment}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? "Processing..." : "Pledge $8"}
                                        </button>
                                        {error && (
                                            <div className="mt-4 p-4 bg-destructive/5 rounded-lg">
                                                <p className="text-sm text-destructive/90 text-center leading-relaxed">{error}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t border-border">
                                <p className="text-xs font-medium mb-3 text-muted-foreground">What you get:</p>
                                <ul className="text-sm text-muted-foreground space-y-1.5">
                                    <li>✓ Lifetime access to the pyramid</li>
                                    <li>✓ Your unique recruitment link</li>
                                    <li>✓ $5 per recruit</li>
                                    <li>✓ Instant payouts</li>
                                </ul>
                            </div>
                        </>
                    )}
                    </>
                )}
                </div>
            </div>
        </>
    );
}

export default function JoinPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            }
        >
            <JoinContent />
        </Suspense>
    );
}

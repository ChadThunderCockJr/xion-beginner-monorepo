/**
 * Persistent database using Vercel KV (Redis-based)
 * 
 * This replaces the in-memory storage with Vercel KV for persistence across deployments.
 * 
 * Setup required:
 * 1. Go to Vercel Dashboard → Storage → Create Database → KV
 * 2. Name it "pyramid-db"
 * 3. Connect it to your project
 * 4. The environment variables (KV_REST_API_URL, KV_REST_API_TOKEN) will be auto-added
 */

import { kv } from "@vercel/kv";
import { generateSuggestion } from "./username";

// Types
export interface Member {
    walletAddress: string;
    username: string;
    referrerAddress: string | null;
    joinedAt: Date;
    transactionHash: string | null;
    paymentMethod: "crossmint" | "usdc";
}

export interface Earning {
    id: string;
    memberAddress: string;
    referredAddress: string;
    amount: string; // USDC amount as string
    status: "pending" | "paid";
    createdAt: Date;
    paidAt: Date | null;
}

// KV Keys
const MEMBERS_SET = "members";
const MEMBER_PREFIX = "member:";
const USERNAME_PREFIX = "username:"; // Maps username -> wallet address
const EARNINGS_PREFIX = "earnings:";
const CREDITS_PREFIX = "credits:";
const STATS_KEY = "stats";
const USED_TX_PREFIX = "used_tx:"; // Tracks used transaction hashes

// Credit constants
const STARTING_CREDITS = 5;
const CREDITS_PER_RECRUIT = 5;

// Stats type
interface Stats {
    totalMembers: number;
    totalPaidOut: string;
}

// ============================================================================
// TRANSACTION HASH TRACKING (prevent reuse)
// ============================================================================

/**
 * Check if a transaction hash has already been used for registration.
 */
export async function isTransactionHashUsed(txHash: string): Promise<boolean> {
    try {
        const existing = await kv.get(`${USED_TX_PREFIX}${txHash.toLowerCase()}`);
        return existing !== null;
    } catch (error) {
        console.error("Failed to check tx hash:", error);
        // Fail closed: if we can't verify, reject
        return true;
    }
}

/**
 * Mark a transaction hash as used.
 */
export async function markTransactionHashUsed(txHash: string, walletAddress: string): Promise<void> {
    await kv.set(`${USED_TX_PREFIX}${txHash.toLowerCase()}`, walletAddress);
}

// Get member by address
export async function getMember(address: string): Promise<Member | null> {
    try {
        const member = await kv.get<Member>(`${MEMBER_PREFIX}${address}`);
        return member;
    } catch (error) {
        console.error("Failed to get member:", error);
        return null;
    }
}

// Get username by wallet address
export async function getUsernameByAddress(address: string): Promise<string | null> {
    const member = await getMember(address);
    return member?.username || null;
}

// Check if address is a member
export async function isMember(address: string): Promise<boolean> {
    const member = await getMember(address);
    return member !== null;
}

/**
 * Check if a username is already taken
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
    const existing = await kv.get(`${USERNAME_PREFIX}${username.toLowerCase()}`);
    return !!existing;
}

// Add a new member
export async function addMember(member: Omit<Member, "joinedAt" | "username"> & { username?: string }): Promise<Member> {
    // Use provided username or generate a suggestion
    let username = member.username || generateSuggestion();

    // Atomically claim the username using SETNX (fixes TOCTOU race condition)
    let claimed = await kv.setnx(`${USERNAME_PREFIX}${username.toLowerCase()}`, member.walletAddress);
    let attempts = 0;
    while (!claimed && !member.username && attempts < 5) {
        username = generateSuggestion();
        claimed = await kv.setnx(`${USERNAME_PREFIX}${username.toLowerCase()}`, member.walletAddress);
        attempts++;
    }

    if (!claimed) {
        throw new Error(`Username ${username} is already taken`);
    }

    const newMember: Member = {
        ...member,
        username,
        joinedAt: new Date(),
    };

    try {
        // Atomically store member data AND add to members set via Lua script
        // This prevents partial state where member exists but isn't in the set (or vice versa)
        const memberScript = `
            redis.call('SET', KEYS[1], ARGV[1])
            redis.call('SADD', KEYS[2], ARGV[2])
            return 1
        `;
        await kv.eval(
            memberScript,
            [`${MEMBER_PREFIX}${member.walletAddress}`, MEMBERS_SET],
            [JSON.stringify(newMember), member.walletAddress]
        );

        // Update stats atomically using Lua script (fixes TOCTOU race condition)
        const statsScript = `
            local data = redis.call('GET', KEYS[1])
            local stats = data and cjson.decode(data) or {totalMembers=0, totalPaidOut="0.00"}
            stats.totalMembers = (stats.totalMembers or 0) + 1
            if tonumber(ARGV[1]) > 0 then
                stats.totalPaidOut = string.format("%.2f", (tonumber(stats.totalPaidOut) or 0) + tonumber(ARGV[1]))
            end
            redis.call('SET', KEYS[1], cjson.encode(stats))
            return 1
        `;
        const payoutIncrement = member.referrerAddress ? 5.00 : 0;
        await kv.eval(statsScript, [STATS_KEY], [payoutIncrement]);

        // Initialize credits for the new member
        await initializeCredits(member.walletAddress);

        // If there's a referrer, create an earning record and grant them bonus credits
        if (member.referrerAddress) {
            await createEarning(member.referrerAddress, member.walletAddress, "5.00");
            // Grant referrer 5 additional message credits
            await addCredits(member.referrerAddress, CREDITS_PER_RECRUIT);
        }

        return newMember;
    } catch (error) {
        // Rollback the username claim if member creation failed
        await kv.del(`${USERNAME_PREFIX}${username.toLowerCase()}`).catch(() => {});
        console.error("Failed to add member:", error);
        throw error;
    }
}

// Get all members
export async function getAllMembers(): Promise<Member[]> {
    try {
        const addresses = await kv.smembers(MEMBERS_SET);
        const members: Member[] = [];

        for (const address of addresses) {
            const member = await getMember(address);
            if (member) {
                members.push(member);
            }
        }

        return members;
    } catch (error) {
        console.error("Failed to get all members:", error);
        return [];
    }
}

// Create an earning for a referrer (status: pending until approved)
// Returns null if the earning already exists (prevents double-counting)
// Uses SETNX dedup key to prevent race conditions
export async function createEarning(
    memberAddress: string,
    referredAddress: string,
    amount: string
): Promise<Earning | null> {
    try {
        // Atomic dedup check using SETNX — prevents race where two concurrent
        // requests both pass the duplicate check
        const dedupKey = `earning_dedup:${memberAddress}:${referredAddress}`;
        const acquired = await kv.setnx(dedupKey, "1");
        if (!acquired) {
            console.warn(
                `Earning already exists for referrer ${memberAddress} <- referred ${referredAddress}. Skipping duplicate.`
            );
            return null;
        }

        // Get existing earnings for this member
        const existingEarnings = await getEarningsForMember(memberAddress);

        const now = new Date();
        const earning: Earning = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            memberAddress,
            referredAddress,
            amount,
            status: "pending",
            createdAt: now,
            paidAt: null,
        };

        // Add new earning
        await kv.set(`${EARNINGS_PREFIX}${memberAddress}`, [...existingEarnings, earning]);

        return earning;
    } catch (error) {
        console.error("Failed to create earning:", error);
        throw error;
    }
}

// Get earnings for a member
export async function getEarningsForMember(address: string): Promise<Earning[]> {
    try {
        const earnings = await kv.get<Earning[]>(`${EARNINGS_PREFIX}${address}`);
        return earnings || [];
    } catch (error) {
        console.error("Failed to get earnings:", error);
        return [];
    }
}

// Get referral stats for a member
export async function getReferralStats(address: string) {
    const earnings = await getEarningsForMember(address);

    const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const pendingEarnings = earnings
        .filter((e) => e.status === "pending")
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const paidEarnings = earnings
        .filter((e) => e.status === "paid")
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Get usernames for each referral
    const referralsWithUsernames = await Promise.all(
        earnings.map(async (e) => {
            const username = await getUsernameByAddress(e.referredAddress);
            return {
                walletAddress: e.referredAddress,
                username: username || "unknown",
                joinedAt: e.createdAt.toString(),
                earning: e.amount,
                status: e.status,
            };
        })
    );

    return {
        totalEarnings: totalEarnings.toFixed(2),
        pendingEarnings: pendingEarnings.toFixed(2),
        paidEarnings: paidEarnings.toFixed(2),
        referralCount: earnings.length,
        referrals: referralsWithUsernames,
    };
}

// Get global stats
export async function getStats(): Promise<Stats> {
    try {
        const stats = await kv.get<Stats>(STATS_KEY);
        return stats || { totalMembers: 0, totalPaidOut: "0.00" };
    } catch (error) {
        console.error("Failed to get stats:", error);
        return { totalMembers: 0, totalPaidOut: "0.00" };
    }
}

// Mark earning as paid
// NOTE: This only updates the earning status, NOT the global stats.
// The global stats are updated in addMember when the earning is created,
// since earnings are considered "paid instantly" by the contract.
// This prevents double-counting the payout.
export async function markEarningPaid(memberAddress: string, earningId: string): Promise<void> {
    try {
        const earnings = await getEarningsForMember(memberAddress);
        const earning = earnings.find((e) => e.id === earningId);

        // Skip if earning not found or already paid
        if (!earning) {
            console.warn(`Earning ${earningId} not found for member ${memberAddress}`);
            return;
        }

        if (earning.status === "paid") {
            console.warn(`Earning ${earningId} already marked as paid. Skipping.`);
            return;
        }

        const updatedEarnings = earnings.map((e) => {
            if (e.id === earningId) {
                return { ...e, status: "paid" as const, paidAt: new Date() };
            }
            return e;
        });

        await kv.set(`${EARNINGS_PREFIX}${memberAddress}`, updatedEarnings);

        // NOTE: We do NOT update totalPaidOut here because it was already
        // counted in addMember() when the earning was created.
        // The contract pays instantly, so the payout is recorded at member creation time.
    } catch (error) {
        console.error("Failed to mark earning as paid:", error);
        throw error;
    }
}

// Update member username
export async function updateMemberUsername(address: string, newUsername: string): Promise<Member> {
    const member = await getMember(address);
    if (!member) {
        throw new Error("Member not found");
    }

    // Check if new username is taken
    const isTaken = await isUsernameTaken(newUsername);
    if (isTaken) {
        // If it's the same user, it's fine
        const owner = await kv.get(`${USERNAME_PREFIX}${newUsername.toLowerCase()}`);
        if (owner !== address) {
            throw new Error("Username already taken");
        }
    }

    // Remove old username mapping if it exists
    if (member.username) {
        await kv.del(`${USERNAME_PREFIX}${member.username.toLowerCase()}`);
    }

    // Update member object
    const updatedMember: Member = {
        ...member,
        username: newUsername,
    };

    // Store updated member
    await kv.set(`${MEMBER_PREFIX}${address}`, updatedMember);

    // Store new username mapping
    await kv.set(`${USERNAME_PREFIX}${newUsername.toLowerCase()}`, address);

    return updatedMember;
}

// Recalculate global stats from scratch
// This sums ALL earnings amounts since the contract pays instantly.
// Use this to fix any discrepancies caused by previous bugs.
export async function recalculateStats(): Promise<Stats> {
    try {
        const members = await getAllMembers();
        let totalPaidOut = 0;

        for (const member of members) {
            const earnings = await getEarningsForMember(member.walletAddress);
            // Sum ALL earnings since they are paid instantly by the contract
            const memberTotal = earnings.reduce((sum, e) => sum + parseFloat(e.amount), 0);
            totalPaidOut += memberTotal;
        }

        const stats: Stats = {
            totalMembers: members.length,
            totalPaidOut: totalPaidOut.toFixed(2),
        };

        await kv.set(STATS_KEY, stats);
        return stats;
    } catch (error) {
        console.error("Failed to recalculate stats:", error);
        throw error;
    }
}

// Get all pending payouts across all members
export async function getAllPendingPayouts(): Promise<
    Array<Earning & { memberAddress: string }>
> {
    try {
        const addresses = await kv.smembers(MEMBERS_SET);
        const pendingPayouts: Array<Earning & { memberAddress: string }> = [];

        for (const address of addresses) {
            const earnings = await getEarningsForMember(address);
            const pending = earnings.filter((e) => e.status === "pending");
            pending.forEach((earning) => {
                pendingPayouts.push({
                    ...earning,
                    memberAddress: address,
                });
            });
        }

        // Sort by creation date, newest first
        pendingPayouts.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return pendingPayouts;
    } catch (error) {
        console.error("Failed to get pending payouts:", error);
        return [];
    }
}

// =============================================================================
// CHAT CREDITS SYSTEM
// =============================================================================

export interface ChatCredits {
    total: number;
    used: number;
    available: number;
}

// Get chat credits for a member
export async function getChatCredits(address: string): Promise<ChatCredits> {
    try {
        const data = await kv.get<{ total: number; used: number }>(`${CREDITS_PREFIX}${address}`);
        if (!data) {
            return { total: 0, used: 0, available: 0 };
        }
        return {
            total: data.total,
            used: data.used,
            available: Math.max(0, data.total - data.used),
        };
    } catch (error) {
        console.error("Failed to get chat credits:", error);
        return { total: 0, used: 0, available: 0 };
    }
}

// Initialize credits for a new member
export async function initializeCredits(address: string): Promise<void> {
    try {
        const existing = await kv.get(`${CREDITS_PREFIX}${address}`);
        if (!existing) {
            await kv.set(`${CREDITS_PREFIX}${address}`, {
                total: STARTING_CREDITS,
                used: 0,
            });
        }
    } catch (error) {
        console.error("Failed to initialize credits:", error);
        throw error;
    }
}

// Add credits to a member (e.g., when they recruit someone)
// Uses Lua script for atomic read-modify-write (fixes TOCTOU race condition)
export async function addCredits(address: string, amount: number): Promise<void> {
    const key = `${CREDITS_PREFIX}${address}`;
    const script = `
        local data = redis.call('GET', KEYS[1])
        local parsed = data and cjson.decode(data) or {total=0, used=0}
        parsed.total = (parsed.total or 0) + tonumber(ARGV[1])
        redis.call('SET', KEYS[1], cjson.encode(parsed))
        return 1
    `;
    try {
        await kv.eval(script, [key], [amount]);
    } catch (error) {
        console.error("Failed to add credits:", error);
        throw error;
    }
}

// Use a message credit (called when sending a message)
// Uses Lua script for atomic check-and-decrement (fixes TOCTOU race condition)
export async function useMessageCredit(address: string): Promise<boolean> {
    const key = `${CREDITS_PREFIX}${address}`;
    const script = `
        local data = redis.call('GET', KEYS[1])
        if not data then return 0 end
        local parsed = cjson.decode(data)
        if not parsed.total or not parsed.used then return 0 end
        local available = parsed.total - parsed.used
        if available <= 0 then return 0 end
        parsed.used = parsed.used + 1
        redis.call('SET', KEYS[1], cjson.encode(parsed))
        return 1
    `;
    try {
        const result = await kv.eval(script, [key], []);
        return result === 1;
    } catch (error) {
        console.error("Failed to use message credit:", error);
        return false;
    }
}

// =============================================================================
// LEADERBOARD
// =============================================================================

export interface TopRecruiter {
    address: string;
    username: string;
    referralCount: number;
}

// Get top recruiters by referral count
export async function getTopRecruiters(limit: number = 5): Promise<TopRecruiter[]> {
    try {
        const addresses = await kv.smembers(MEMBERS_SET);
        const recruiters: TopRecruiter[] = [];

        for (const address of addresses) {
            const earnings = await getEarningsForMember(address);
            if (earnings.length > 0) {
                const member = await getMember(address);
                recruiters.push({
                    address,
                    username: member?.username || address.slice(0, 8),
                    referralCount: earnings.length,
                });
            }
        }

        // Sort by referral count descending
        recruiters.sort((a, b) => b.referralCount - a.referralCount);

        return recruiters.slice(0, limit);
    } catch (error) {
        console.error("Failed to get top recruiters:", error);
        return [];
    }
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAbstraxionAccount, useAbstraxionSigningClient } from "@burnt-labs/abstraxion";
import { PYRAMID_CONTRACT } from "@/lib/xion";

interface MembershipStatus {
    isMember: boolean;
    username: string | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * Unified hook for checking membership status.
 *
 * This hook checks both the blockchain contract (source of truth) and the backend database.
 * If the contract shows membership but the database doesn't, it triggers a sync.
 *
 * This ensures consistent membership detection across all pages.
 */
export function useMembershipStatus(): MembershipStatus {
    const { data: account, isConnected } = useAbstraxionAccount();
    const { client } = useAbstraxionSigningClient();

    const [isMember, setIsMember] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkMembership = useCallback(async () => {
        if (!account?.bech32Address) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // First, check the backend database (fast)
            const dbResponse = await fetch(`/api/members?address=${account.bech32Address}`);
            if (dbResponse.ok) {
                const dbData = await dbResponse.json();
                if (dbData.isMember) {
                    // Database says member - we're good
                    setIsMember(true);
                    setUsername(dbData.username);
                    setIsLoading(false);
                    return;
                }
            }

            // Database doesn't show membership - check the blockchain contract
            if (client && PYRAMID_CONTRACT) {
                try {
                    const memberInfo = await client.queryContractSmart(PYRAMID_CONTRACT, {
                        member: { address: account.bech32Address }
                    });

                    // Check is_member field - contract returns { is_member: bool, member: Option<MemberInfo> }
                    if (memberInfo && memberInfo.is_member === true) {
                        // Contract says member but DB doesn't - trigger sync
                        console.log("Contract shows membership but DB doesn't - syncing...");

                        const syncResponse = await fetch("/api/members/sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                walletAddress: account.bech32Address,
                            }),
                        });

                        if (syncResponse.ok) {
                            const syncData = await syncResponse.json();
                            setIsMember(true);
                            setUsername(syncData.username || null);
                        } else {
                            // Sync failed but contract says member - still show as member
                            setIsMember(true);
                        }
                        setIsLoading(false);
                        return;
                    }
                } catch (contractError) {
                    // Contract query failed - user is likely not a member
                    console.log("Contract query failed (likely not a member):", contractError);
                }
            }

            // Neither DB nor contract shows membership
            setIsMember(false);
            setUsername(null);
        } catch (err) {
            console.error("Failed to check membership:", err);
            setError(err instanceof Error ? err.message : "Failed to check membership");
        } finally {
            setIsLoading(false);
        }
    }, [account?.bech32Address, client]);

    useEffect(() => {
        if (isConnected) {
            checkMembership();
        } else {
            setIsLoading(false);
            setIsMember(false);
            setUsername(null);
        }
    }, [isConnected, checkMembership]);

    return { isMember, username, isLoading, error };
}

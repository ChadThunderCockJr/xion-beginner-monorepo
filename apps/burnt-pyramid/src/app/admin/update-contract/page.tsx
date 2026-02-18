"use client";

import { useAbstraxionAccount, useAbstraxionSigningClient } from "@burnt-labs/abstraxion";
import { useState } from "react";

const PYRAMID_CONTRACT = process.env.NEXT_PUBLIC_PYRAMID_CONTRACT || "";
const NEW_NFT_CONTRACT = "xion1jdx22d5mmfg8ax4kcat9v8h4llsrqtw56mxzaw9t82xusqvjctrqe76qkx";

export default function UpdateContractPage() {
    const { data: account } = useAbstraxionAccount();
    const { client } = useAbstraxionSigningClient();
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const updateNftContract = async () => {
        if (!client || !account?.bech32Address) {
            setError("Please connect your wallet first");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const updateMsg = {
                update_config: {
                    crossmint_nft_contract: NEW_NFT_CONTRACT,
                },
            };

            console.log("Updating contract with message:", updateMsg);
            console.log("Contract address:", PYRAMID_CONTRACT);
            console.log("Sender:", account.bech32Address);

            const tx = await client.execute(
                account.bech32Address,
                PYRAMID_CONTRACT,
                updateMsg,
                "auto",
                "Update NFT Contract to Pyramid2"
            );

            console.log("Update successful:", tx);
            setResult(`Success! Transaction hash: ${tx.transactionHash}`);
        } catch (err) {
            console.error("Update failed:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to update contract: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">Update Smart Contract</h1>
                    <p className="text-muted-foreground">
                        Configure the pyramid splitter contract to recognize pyramid1 Crossmint NFT contract
                    </p>
                </div>

                <div className="p-6 border rounded-lg space-y-4 bg-secondary/10">
                    <div className="space-y-2">
                        <h3 className="font-semibold">Contract Details:</h3>
                        <div className="text-sm space-y-1 font-mono text-muted-foreground">
                            <p><span className="text-foreground">Pyramid Contract:</span> {PYRAMID_CONTRACT}</p>
                            <p><span className="text-foreground">New NFT Contract:</span> {NEW_NFT_CONTRACT}</p>
                            <p><span className="text-foreground">Your Address:</span> {account?.bech32Address || "Not connected"}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <button
                            onClick={updateNftContract}
                            disabled={isProcessing || !account}
                            className="btn btn-primary w-full"
                        >
                            {isProcessing ? "Updating Contract..." : "Update NFT Contract Address"}
                        </button>
                    </div>

                    {result && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-sm text-green-600 dark:text-green-400 font-mono break-all">
                                {result}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive break-all">{error}</p>
                        </div>
                    )}
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                    <p className="font-semibold">⚠️ Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>You must be the contract owner/admin to execute this</li>
                        <li>This will configure the crossmint_nft_contract field to enable Claim flow</li>
                        <li>After updating, users with pyramid1 Crossmint NFTs will be able to claim membership</li>
                    </ul>
                </div>

                <div className="pt-4">
                    <a href="/" className="text-sm text-primary hover:underline">
                        ← Back to home
                    </a>
                </div>
            </div>
        </div>
    );
}

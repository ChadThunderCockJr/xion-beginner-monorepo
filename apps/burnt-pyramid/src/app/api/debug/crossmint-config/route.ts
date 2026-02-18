import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

/**
 * Diagnostic endpoint to check Crossmint environment variable configuration
 * Returns boolean flags (not actual values) to verify variables are set
 *
 * Access: /api/debug/crossmint-config
 * Requires: Authorization header with Bearer <ADMIN_API_KEY>
 */
export async function GET(req: Request) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    return NextResponse.json({
        hasClientApiKey: !!process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY,
        hasCollectionId: !!process.env.NEXT_PUBLIC_CROSSMINT_COLLECTION_ID,
        hasNftContract: !!process.env.NEXT_PUBLIC_CROSSMINT_NFT_CONTRACT,
        hasPyramidContract: !!process.env.NEXT_PUBLIC_PYRAMID_CONTRACT,
        hasServerApiKey: !!process.env.CROSSMINT_SERVER_API_KEY,
        hasTreasuryContract: !!process.env.NEXT_PUBLIC_TREASURY_CONTRACT,

        // Include lengths for verification (without exposing actual values)
        clientApiKeyLength: process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY?.length || 0,
        collectionIdLength: process.env.NEXT_PUBLIC_CROSSMINT_COLLECTION_ID?.length || 0,

        timestamp: new Date().toISOString(),
    });
}

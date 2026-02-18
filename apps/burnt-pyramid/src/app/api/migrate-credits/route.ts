import { NextResponse } from "next/server";
import { getAllMembers, getChatCredits, addCredits } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

/**
 * Migration endpoint to ensure all members have at least 5 credits
 *
 * Run once to backfill credits for existing members
 * Requires: Authorization header with Bearer <ADMIN_API_KEY>
 */
export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization");

    if (!isAdmin(authHeader)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const members = await getAllMembers();
        let updated = 0;
        const errors: string[] = [];

        for (const member of members) {
            try {
                const credits = await getChatCredits(member.walletAddress);

                // If total credits are less than 5, add the difference
                if (credits.total < 5) {
                    const creditsToAdd = 5 - credits.total;
                    await addCredits(member.walletAddress, creditsToAdd);
                    updated++;
                    console.log(`Added ${creditsToAdd} credits to ${member.walletAddress} (now has ${credits.total + creditsToAdd} total)`);
                }
            } catch (error) {
                const errorMsg = `Failed to update credits for ${member.walletAddress}`;
                console.error(errorMsg, error);
                errors.push(errorMsg);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete: ${updated} members received credit top-ups`,
            totalMembers: members.length,
            updated,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error("Migration failed:", error);
        return NextResponse.json(
            { error: "Migration failed" },
            { status: 500 }
        );
    }
}

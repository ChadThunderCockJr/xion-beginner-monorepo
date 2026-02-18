import { NextResponse } from "next/server";
import { getAllMembers, updateMemberUsername } from "@/lib/db";
import { generateSuggestion } from "@/lib/username";
import { isAdmin } from "@/lib/auth";

/**
 * Migration endpoint to assign random usernames to members who don't have one
 *
 * Run once to backfill usernames for existing members
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
            // Skip if member already has a username
            if (member.username && member.username.trim() !== "") {
                continue;
            }

            // Generate unique username with retry logic
            let attempts = 0;
            let success = false;

            while (attempts < 10 && !success) {
                try {
                    const randomUsername = generateSuggestion();
                    await updateMemberUsername(member.walletAddress, randomUsername);
                    updated++;
                    success = true;
                    console.log(`Assigned username ${randomUsername} to ${member.walletAddress}`);
                } catch (error) {
                    attempts++;
                    if (attempts >= 10) {
                        const errorMsg = `Failed to assign username to ${member.walletAddress} after 10 attempts`;
                        console.error(errorMsg, error);
                        errors.push(errorMsg);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration complete: ${updated} usernames assigned`,
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

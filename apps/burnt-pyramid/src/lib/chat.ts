/**
 * Chat message storage using Vercel KV with encryption
 *
 * Messages are encrypted using AES-256-GCM before storage.
 * Requires CHAT_ENCRYPTION_KEY environment variable (exactly 32 characters).
 * WARNING: Changing the key will make existing messages unreadable.
 */

import { kv } from "@vercel/kv";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Types
export interface ChatMessage {
    id: string;
    authorAddress: string;
    authorName: string;
    content: string;
    timestamp: Date;
    isEncrypted?: boolean;
}

interface EncryptedMessage {
    iv: string;
    encryptedData: string;
}

// KV Keys
const MESSAGES_LIST = "chat:messages";
const MESSAGE_PREFIX = "chat:message:";

// Encryption helpers
const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.CHAT_ENCRYPTION_KEY || "";

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    if (process.env.NODE_ENV === "production") {
        throw new Error("CHAT_ENCRYPTION_KEY must be set and at least 32 characters in production");
    }
    console.warn("CHAT_ENCRYPTION_KEY not set or too short. Messages will not be encrypted properly.");
}

function getEncryptionKey(): Buffer {
    // If key is 64 hex chars, decode as hex (32 bytes = 256 bits)
    if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
        return Buffer.from(ENCRYPTION_KEY, "hex");
    }
    // Otherwise treat as UTF-8, require exactly 32 bytes, no padding
    const key = Buffer.from(ENCRYPTION_KEY, "utf-8");
    if (key.length < 32) {
        throw new Error("CHAT_ENCRYPTION_KEY must be at least 32 bytes");
    }
    return key.subarray(0, 32);
}

function encrypt(text: string): EncryptedMessage {
    const iv = randomBytes(16);
    const key = getEncryptionKey();
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("hex"),
        encryptedData: encrypted + ":" + authTag.toString("hex"),
    };
}

function decrypt(encrypted: EncryptedMessage): string {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, "hex");
    const [encryptedText, authTagHex] = encrypted.encryptedData.split(":");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return decrypted;
}

// Add a new message
export async function addMessage(
    authorAddress: string,
    content: string
): Promise<ChatMessage> {
    const messageId = `${Date.now()}-${randomBytes(8).toString("hex")}`;
    const authorName = authorAddress.slice(0, 8);

    const message: ChatMessage = {
        id: messageId,
        authorAddress,
        authorName,
        content,
        timestamp: new Date(),
    };

    try {
        // Encrypt the content before storage
        const encryptedContent = encrypt(content);

        const storedMessage = {
            ...message,
            content: encryptedContent,
        };

        // Store message
        await kv.set(`${MESSAGE_PREFIX}${messageId}`, storedMessage);

        // Add to messages list (sorted set with timestamp as score)
        await kv.zadd(MESSAGES_LIST, {
            score: message.timestamp.getTime(),
            member: messageId,
        });

        return message;
    } catch (error) {
        console.error("Failed to add message:", error);
        throw error;
    }
}

// Get messages with pagination
export async function getMessages(
    limit: number = 50,
    before?: number
): Promise<ChatMessage[]> {
    try {
        // Get message IDs from sorted set (newest first)
        const maxScore = before || Date.now();
        const messageIds = await kv.zrange(
            MESSAGES_LIST,
            maxScore,  // With rev+byScore, max comes first
            0,         // min score
            { rev: true, byScore: true, offset: 0, count: limit }
        );

        if (!messageIds || messageIds.length === 0) {
            return [];
        }

        // Fetch and decrypt messages
        const messages: ChatMessage[] = [];

        for (const messageId of messageIds) {
            const stored = await kv.get<any>(`${MESSAGE_PREFIX}${messageId}`);
            if (stored) {
                try {
                    // Handle both plain text (old) and encrypted (new) formats
                    let content: string;
                    let isEncrypted = false;
                    if (typeof stored.content === 'object' && stored.content.iv) {
                        // Encrypted format
                        content = decrypt(stored.content);
                        isEncrypted = true;
                    } else {
                        // Plain text format (legacy)
                        content = stored.content;
                    }

                    const message: ChatMessage = {
                        id: stored.id,
                        authorAddress: stored.authorAddress,
                        authorName: stored.authorName,
                        content,
                        timestamp: new Date(stored.timestamp),
                        isEncrypted,
                    };

                    messages.push(message);
                } catch (error) {
                    console.error(`Failed to decrypt message ${messageId}:`, error);
                    // Skip corrupted messages
                }
            }
        }

        // Reverse to show oldest first
        return messages.reverse();
    } catch (error) {
        console.error("Failed to get messages:", error);
        return [];
    }
}

// Get total message count
export async function getMessageCount(): Promise<number> {
    try {
        const count = await kv.zcard(MESSAGES_LIST);
        return count || 0;
    } catch (error) {
        console.error("Failed to get message count:", error);
        return 0;
    }
}

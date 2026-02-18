/**
 * Username Generation System
 * 
 * Generates unique, mysterious usernames for pyramid members.
 * Format: adjective_noun_number (e.g., shadow_vault_42)
 */

// Pyramid/Illuminati themed adjective wordlist (max 7 chars each for 20 char username limit)
const ADJECTIVES = [
    "shadow", "golden", "hidden", "sacred", "divine",
    "mystic", "veiled", "radiant", "cryptic", "eternal",
    "ancient", "supreme", "exalted", "blessed", "crowned"
];

// Pyramid/Hierarchy themed noun wordlist (max 7 chars each for 20 char username limit)
const NOUNS = [
    "oracle", "adept", "apex", "eye", "sigil",
    "cipher", "keeper", "temple", "altar", "throne",
    "crown", "vault", "zenith", "scepter", "watcher"
];

// Regex for valid usernames (alphanumeric, underscores, 3-20 chars)
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * Generate a suggestion
 * Format: adjective_noun_XX (e.g., shadow_vault_42)
 */
export function generateSuggestion(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const number = Math.floor(Math.random() * 100).toString().padStart(2, '0');

    return `${adjective}_${noun}_${number}`;
}

/**
 * Format username for display (add @ if missing)
 */
export function formatUsername(username: string): string {
    const clean = username.replace(/^@/, '');
    return `@${clean}`;
}

/**
 * Get display name (remove @ for cleaner look in some contexts if needed)
 */
export function getDisplayName(username: string): string {
    return formatUsername(username);
}

/**
 * Get avatar initials from username
 * e.g., "@shadow_vault" -> "SV"
 */
export function getInitials(username: string): string {
    const clean = username.replace(/^@/, '').replace(/_/g, ' ');
    const parts = clean.split(' ');

    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return clean.charAt(0).toUpperCase();
}

/**
 * Get badge tier based on recruit count
 */
export function getBadgeTier(recruitCount: number): {
    name: string;
    class: string;
    emoji: string;
} {
    if (recruitCount >= 10) {
        return { name: "Apex", class: "badge-apex", emoji: "⚡" };
    } else if (recruitCount >= 5) {
        return { name: "Architect", class: "badge-architect", emoji: "🔮" };
    } else if (recruitCount >= 1) {
        return { name: "Operator", class: "badge-operator", emoji: "◈" };
    }
    return { name: "Initiate", class: "badge-initiate", emoji: "△" };
}

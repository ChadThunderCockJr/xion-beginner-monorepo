import { getRedis } from "./redis.js";

// ── Profile ────────────────────────────────────────────────────

export interface Profile {
  displayName: string;
  username: string;
  createdAt: number;
}

export async function getProfile(address: string): Promise<Profile | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    const data = await r.hgetall(`profile:${address}`);
    if (!data.createdAt) return null;
    return {
      displayName: data.displayName || "",
      username: data.username || "",
      createdAt: parseInt(data.createdAt),
    };
  } catch { return null; }
}

export async function setProfile(address: string, displayName: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    const exists = await r.exists(`profile:${address}`);
    if (exists) {
      await r.hset(`profile:${address}`, "displayName", displayName);
    } else {
      await r.hset(`profile:${address}`, "displayName", displayName, "username", "", "createdAt", String(Date.now()));
    }
    return true;
  } catch { return false; }
}

export async function setUsername(address: string, username: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = getRedis();
    if (!r) return { ok: false, error: "Redis unavailable" };

    // Validate format: 3-20 chars, alphanumeric + underscores
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: "Username must be 3-20 characters (letters, numbers, underscores)" };
    }

    const lowerUsername = username.toLowerCase();

    // Check uniqueness via the username->address mapping
    const existing = await r.get(`username:${lowerUsername}`);
    if (existing && existing !== address) {
      return { ok: false, error: "Username already taken" };
    }

    // Remove old username mapping if changing
    const profile = await r.hgetall(`profile:${address}`);
    if (profile.username) {
      await r.del(`username:${profile.username.toLowerCase()}`);
    }

    // Set new username
    await r.hset(`profile:${address}`, "username", username);
    await r.set(`username:${lowerUsername}`, address);

    // If no display name set yet, use username as display name
    if (!profile.displayName) {
      await r.hset(`profile:${address}`, "displayName", username);
    }

    return { ok: true };
  } catch { return { ok: false, error: "Failed to set username" }; }
}

export async function lookupByUsername(username: string): Promise<string | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get(`username:${username.toLowerCase()}`);
  } catch { return null; }
}

export async function searchPlayers(query: string): Promise<Array<{ address: string; username: string; displayName: string }>> {
  try {
    const r = getRedis();
    if (!r) return [];

    const lowerQuery = query.toLowerCase();
    const results: Array<{ address: string; username: string; displayName: string }> = [];
    const seen = new Set<string>();

    // Exact username match first
    const exactAddr = await r.get(`username:${lowerQuery}`);
    if (exactAddr) {
      const profile = await getProfile(exactAddr);
      if (profile) {
        results.push({ address: exactAddr, username: profile.username, displayName: profile.displayName });
        seen.add(exactAddr);
      }
    }

    // Prefix search: scan username:* keys matching the query prefix
    if (results.length < 10) {
      let cursor = "0";
      const pattern = `username:${lowerQuery}*`;
      do {
        const [nextCursor, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 50);
        cursor = nextCursor;
        for (const key of keys) {
          if (results.length >= 10) break;
          const addr = await r.get(key);
          if (addr && !seen.has(addr)) {
            seen.add(addr);
            const profile = await getProfile(addr);
            if (profile) {
              results.push({ address: addr, username: profile.username, displayName: profile.displayName });
            }
          }
        }
      } while (cursor !== "0" && results.length < 10);
    }

    // If query looks like an address, try direct lookup
    if (query.startsWith("xion1") && !seen.has(query)) {
      const profile = await getProfile(query);
      if (profile) {
        results.push({ address: query, username: profile.username, displayName: profile.displayName });
      }
    }

    return results;
  } catch { return []; }
}

export async function ensureProfile(address: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    const exists = await r.exists(`profile:${address}`);
    if (!exists) {
      await r.hset(`profile:${address}`, "displayName", "", "username", "", "createdAt", String(Date.now()));
    }
  } catch { /* ignore */ }
}

// ── Friends ────────────────────────────────────────────────────

export async function getFriends(address: string): Promise<string[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    return await r.smembers(`friends:${address}`);
  } catch { return []; }
}

export async function addFriend(a: string, b: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    await r.sadd(`friends:${a}`, b);
    await r.sadd(`friends:${b}`, a);
    return true;
  } catch { return false; }
}

export async function removeFriend(a: string, b: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    await r.srem(`friends:${a}`, b);
    await r.srem(`friends:${b}`, a);
    return true;
  } catch { return false; }
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    return (await r.sismember(`friends:${a}`, b)) === 1;
  } catch { return false; }
}

// ── Friend Requests ────────────────────────────────────────────

export async function sendFriendRequest(from: string, to: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    await r.sadd(`friend_requests_in:${to}`, from);
    await r.sadd(`friend_requests_out:${from}`, to);
    return true;
  } catch { return false; }
}

export async function getIncomingRequests(address: string): Promise<string[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    return await r.smembers(`friend_requests_in:${address}`);
  } catch { return []; }
}

export async function getOutgoingRequests(address: string): Promise<string[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    return await r.smembers(`friend_requests_out:${address}`);
  } catch { return []; }
}

export async function removeFriendRequest(from: string, to: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    await r.srem(`friend_requests_in:${to}`, from);
    await r.srem(`friend_requests_out:${from}`, to);
    return true;
  } catch { return false; }
}

export async function hasPendingRequest(from: string, to: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    return (await r.sismember(`friend_requests_out:${from}`, to)) === 1;
  } catch { return false; }
}

// ── Presence ───────────────────────────────────────────────────

export async function markOnline(address: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.sadd("online_players", address);
  } catch { /* ignore */ }
}

export async function markOffline(address: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.srem("online_players", address);
  } catch { /* ignore */ }
}

export async function isOnline(address: string): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    return (await r.sismember("online_players", address)) === 1;
  } catch { return false; }
}

export async function getOnlinePlayers(): Promise<string[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    return await r.smembers("online_players");
  } catch { return []; }
}

// ── Activity Feed ──────────────────────────────────────────────

export interface ActivityItem {
  type: "match" | "friend_added" | "friend_online";
  text: string;
  result?: "W" | "L";
  timestamp: number;
}

export async function addActivity(address: string, item: ActivityItem): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    const key = `activity:${address}`;
    await r.zadd(key, item.timestamp, JSON.stringify(item));
    // Cap at 50 most recent
    const count = await r.zcard(key);
    if (count > 50) {
      await r.zremrangebyrank(key, 0, count - 51);
    }
  } catch { /* ignore */ }
}

export async function getActivity(address: string, limit = 20): Promise<ActivityItem[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    const items = await r.zrevrange(`activity:${address}`, 0, limit - 1);
    return items.map((s) => JSON.parse(s) as ActivityItem);
  } catch { return []; }
}

// ── Match Results ──────────────────────────────────────────────

export interface MatchResult {
  gameId: string;
  opponent: string;
  opponentName: string;
  result: "W" | "L";
  resultType: string;
  timestamp: number;
}

export async function recordMatchResult(address: string, result: MatchResult): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    const key = `matches:${address}`;
    await r.zadd(key, result.timestamp, JSON.stringify(result));
    const count = await r.zcard(key);
    if (count > 100) {
      await r.zremrangebyrank(key, 0, count - 101);
    }
  } catch { /* ignore */ }
}

export async function getMatchResults(address: string, limit = 20): Promise<MatchResult[]> {
  try {
    const r = getRedis();
    if (!r) return [];
    const items = await r.zrevrange(`matches:${address}`, 0, limit - 1);
    return items.map((s) => JSON.parse(s) as MatchResult);
  } catch { return []; }
}

// ── Challenges ─────────────────────────────────────────────────

export interface Challenge {
  id: string;
  from: string;
  fromName: string;
  to: string;
  createdAt: number;
}

export async function createChallenge(challenge: Challenge): Promise<boolean> {
  try {
    const r = getRedis();
    if (!r) return false;
    // 60 second TTL
    await r.setex(`challenge:${challenge.id}`, 60, JSON.stringify(challenge));
    return true;
  } catch { return false; }
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    const data = await r.get(`challenge:${id}`);
    if (!data) return null;
    return JSON.parse(data) as Challenge;
  } catch { return null; }
}

export async function deleteChallenge(id: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.del(`challenge:${id}`);
  } catch { /* ignore */ }
}

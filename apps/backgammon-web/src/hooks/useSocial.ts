import { useCallback, useEffect, useReducer, useRef } from "react";
import { useWebSocket } from "./useWebSocket";

// ── Types ────────────────────────────────────────────────────────

export interface FriendEntry {
  address: string;
  displayName: string;
  online: boolean;
}

export interface FriendRequestEntry {
  address: string;
  displayName: string;
}

export interface ActivityItem {
  type: "match" | "friend_added" | "friend_online";
  text: string;
  result?: "W" | "L";
  timestamp: number;
}

export interface SearchResult {
  address: string;
  username: string;
  displayName: string;
}

export interface PendingChallenge {
  challengeId: string;
  fromAddress: string;
  fromName: string;
  receivedAt: number;
}

export interface ChallengeConfig {
  matchLength: number;
  wagerAmount: number;
  doublingCube: boolean;
}

export interface SocialState {
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  outgoingRequests: string[];
  activity: ActivityItem[];
  pendingChallenges: PendingChallenge[];
  searchResults: SearchResult[];
  blockedUsers: string[];
  displayName: string;
  username: string;
  usernameError: string;
  connected: boolean;
}

type SocialAction =
  | { type: "FRIENDS_LIST"; friends: FriendEntry[]; incoming_requests: FriendRequestEntry[]; outgoing_requests: string[] }
  | { type: "ACTIVITY_FEED"; items: ActivityItem[] }
  | { type: "PROFILE_UPDATED"; display_name: string }
  | { type: "FRIEND_ONLINE"; address: string }
  | { type: "FRIEND_OFFLINE"; address: string }
  | { type: "FRIEND_REQUEST_RECEIVED"; from_address: string; from_name: string }
  | { type: "FRIEND_REQUEST_ACCEPTED"; address: string; display_name: string }
  | { type: "FRIEND_REMOVED"; address: string }
  | { type: "CHALLENGE_RECEIVED"; challenge_id: string; from_address: string; from_name: string }
  | { type: "CHALLENGE_DECLINED"; challenge_id: string }
  | { type: "CHALLENGE_DISMISS"; challenge_id: string }
  | { type: "USERNAME_SET"; username: string }
  | { type: "USERNAME_ERROR"; message: string }
  | { type: "SEARCH_RESULTS"; results: SearchResult[] }
  | { type: "ADD_OUTGOING_REQUEST"; address: string }
  | { type: "USER_BLOCKED"; address: string }
  | { type: "USER_UNBLOCKED"; address: string }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" };

const initialState: SocialState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  activity: [],
  pendingChallenges: [],
  searchResults: [],
  blockedUsers: [],
  displayName: "",
  username: "",
  usernameError: "",
  connected: false,
};

function socialReducer(state: SocialState, action: SocialAction): SocialState {
  switch (action.type) {
    case "FRIENDS_LIST":
      return {
        ...state,
        friends: action.friends,
        incomingRequests: action.incoming_requests,
        outgoingRequests: action.outgoing_requests,
      };
    case "ACTIVITY_FEED":
      return { ...state, activity: action.items };
    case "PROFILE_UPDATED":
      return { ...state, displayName: action.display_name };
    case "FRIEND_ONLINE":
      return {
        ...state,
        friends: state.friends.map((f) =>
          f.address === action.address ? { ...f, online: true } : f,
        ),
      };
    case "FRIEND_OFFLINE":
      return {
        ...state,
        friends: state.friends.map((f) =>
          f.address === action.address ? { ...f, online: false } : f,
        ),
      };
    case "FRIEND_REQUEST_RECEIVED":
      return {
        ...state,
        incomingRequests: [
          ...state.incomingRequests.filter((r) => r.address !== action.from_address),
          { address: action.from_address, displayName: action.from_name },
        ],
      };
    case "FRIEND_REQUEST_ACCEPTED": {
      return {
        ...state,
        friends: [
          ...state.friends,
          { address: action.address, displayName: action.display_name, online: true },
        ],
        outgoingRequests: state.outgoingRequests.filter((a) => a !== action.address),
      };
    }
    case "FRIEND_REMOVED":
      return {
        ...state,
        friends: state.friends.filter((f) => f.address !== action.address),
      };
    case "CHALLENGE_RECEIVED":
      return {
        ...state,
        pendingChallenges: [
          ...state.pendingChallenges,
          {
            challengeId: action.challenge_id,
            fromAddress: action.from_address,
            fromName: action.from_name,
            receivedAt: Date.now(),
          },
        ],
      };
    case "CHALLENGE_DECLINED":
    case "CHALLENGE_DISMISS":
      return {
        ...state,
        pendingChallenges: state.pendingChallenges.filter(
          (c) => c.challengeId !== action.challenge_id,
        ),
      };
    case "USERNAME_SET":
      return { ...state, username: action.username, usernameError: "" };
    case "USERNAME_ERROR":
      return { ...state, usernameError: action.message };
    case "SEARCH_RESULTS":
      return { ...state, searchResults: action.results };
    case "ADD_OUTGOING_REQUEST":
      return {
        ...state,
        outgoingRequests: state.outgoingRequests.includes(action.address)
          ? state.outgoingRequests
          : [...state.outgoingRequests, action.address],
      };
    case "USER_BLOCKED":
      return {
        ...state,
        blockedUsers: state.blockedUsers.includes(action.address)
          ? state.blockedUsers
          : [...state.blockedUsers, action.address],
      };
    case "USER_UNBLOCKED":
      return {
        ...state,
        blockedUsers: state.blockedUsers.filter((a) => a !== action.address),
      };
    case "CONNECTED":
      return { ...state, connected: true };
    case "DISCONNECTED":
      return { ...state, connected: false };
    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────────

export function useSocial(wsUrl: string, address: string | null) {
  const { connect, sendMessage, connected, on } = useWebSocket(wsUrl);
  const [state, dispatch] = useReducer(socialReducer, initialState);
  const addressRef = useRef(address);
  addressRef.current = address;

  // Connect when address is available
  useEffect(() => {
    if (address) {
      connect();
    }
  }, [address, connect]);

  // Track connected state
  useEffect(() => {
    dispatch({ type: connected ? "CONNECTED" : "DISCONNECTED" });
  }, [connected]);

  // Authenticate + fetch initial data
  useEffect(() => {
    if (connected && address) {
      sendMessage({ type: "auth", address });
      // Small delay to ensure auth is processed
      const t = setTimeout(() => {
        sendMessage({ type: "get_friends" });
        sendMessage({ type: "get_activity" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [connected, address, sendMessage]);

  // Register message handlers
  useEffect(() => {
    const unsubs = [
      on("friends_list", (msg) =>
        dispatch({
          type: "FRIENDS_LIST",
          friends: (msg.friends || []) as FriendEntry[],
          incoming_requests: (msg.incoming_requests || []) as FriendRequestEntry[],
          outgoing_requests: (msg.outgoing_requests || []) as string[],
        }),
      ),
      on("activity_feed", (msg) =>
        dispatch({
          type: "ACTIVITY_FEED",
          items: (msg.items || []) as ActivityItem[],
        }),
      ),
      on("profile_updated", (msg) =>
        dispatch({
          type: "PROFILE_UPDATED",
          display_name: msg.display_name as string,
        }),
      ),
      on("friend_online", (msg) =>
        dispatch({ type: "FRIEND_ONLINE", address: msg.address as string }),
      ),
      on("friend_offline", (msg) =>
        dispatch({ type: "FRIEND_OFFLINE", address: msg.address as string }),
      ),
      on("friend_request_received", (msg) =>
        dispatch({
          type: "FRIEND_REQUEST_RECEIVED",
          from_address: msg.from_address as string,
          from_name: msg.from_name as string,
        }),
      ),
      on("friend_request_accepted", (msg) =>
        dispatch({
          type: "FRIEND_REQUEST_ACCEPTED",
          address: msg.address as string,
          display_name: msg.display_name as string,
        }),
      ),
      on("friend_removed", (msg) =>
        dispatch({ type: "FRIEND_REMOVED", address: msg.address as string }),
      ),
      on("challenge_received", (msg) =>
        dispatch({
          type: "CHALLENGE_RECEIVED",
          challenge_id: msg.challenge_id as string,
          from_address: msg.from_address as string,
          from_name: msg.from_name as string,
        }),
      ),
      on("challenge_declined", (msg) =>
        dispatch({
          type: "CHALLENGE_DECLINED",
          challenge_id: msg.challenge_id as string,
        }),
      ),
      on("username_set", (msg) =>
        dispatch({ type: "USERNAME_SET", username: msg.username as string }),
      ),
      on("username_error", (msg) =>
        dispatch({ type: "USERNAME_ERROR", message: msg.message as string }),
      ),
      on("search_results", (msg) =>
        dispatch({
          type: "SEARCH_RESULTS",
          results: (msg.results || []) as SearchResult[],
        }),
      ),
      on("block_user_success", (msg) =>
        dispatch({ type: "USER_BLOCKED", address: msg.target as string }),
      ),
      on("error", (msg) => {
        console.warn("[Social] Server error:", msg.message);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  // ── Actions ──────────────────────────────────────────────────

  const setDisplayName = useCallback(
    (name: string) => {
      sendMessage({ type: "set_profile", display_name: name });
    },
    [sendMessage],
  );

  const sendFriendRequest = useCallback(
    (toAddress: string) => {
      sendMessage({ type: "send_friend_request", to_address: toAddress });
      dispatch({ type: "ADD_OUTGOING_REQUEST", address: toAddress });
    },
    [sendMessage],
  );

  const acceptFriendRequest = useCallback(
    (fromAddress: string) => {
      sendMessage({ type: "accept_friend_request", from_address: fromAddress });
    },
    [sendMessage],
  );

  const rejectFriendRequest = useCallback(
    (fromAddress: string) => {
      sendMessage({ type: "reject_friend_request", from_address: fromAddress });
    },
    [sendMessage],
  );

  const removeFriend = useCallback(
    (friendAddress: string) => {
      sendMessage({ type: "remove_friend", address: friendAddress });
    },
    [sendMessage],
  );

  const challengeFriend = useCallback(
    (toAddress: string, config?: ChallengeConfig) => {
      sendMessage({
        type: "challenge_friend",
        to_address: toAddress,
        match_length: config?.matchLength ?? 5,
        wager_amount: config?.wagerAmount ?? 0,
        doubling_cube: config?.doublingCube ?? true,
      });
    },
    [sendMessage],
  );

  const acceptChallenge = useCallback(
    (challengeId: string) => {
      sendMessage({ type: "accept_challenge", challenge_id: challengeId });
      dispatch({ type: "CHALLENGE_DISMISS", challenge_id: challengeId });
    },
    [sendMessage],
  );

  const declineChallenge = useCallback(
    (challengeId: string) => {
      sendMessage({ type: "decline_challenge", challenge_id: challengeId });
      dispatch({ type: "CHALLENGE_DISMISS", challenge_id: challengeId });
    },
    [sendMessage],
  );

  const setUsername = useCallback(
    (username: string) => {
      sendMessage({ type: "set_username", username });
    },
    [sendMessage],
  );

  const searchPlayers = useCallback(
    (query: string) => {
      sendMessage({ type: "search_players", query });
    },
    [sendMessage],
  );

  const blockUser = useCallback(
    (targetAddress: string) => {
      sendMessage({ type: "block_user", target: targetAddress });
      dispatch({ type: "USER_BLOCKED", address: targetAddress });
    },
    [sendMessage],
  );

  const unblockUser = useCallback(
    (targetAddress: string) => {
      sendMessage({ type: "unblock_user", target: targetAddress });
      dispatch({ type: "USER_UNBLOCKED", address: targetAddress });
    },
    [sendMessage],
  );

  const reportUser = useCallback(
    (targetAddress: string, reason: string) => {
      sendMessage({ type: "report_user", target: targetAddress, reason });
    },
    [sendMessage],
  );

  const refreshFriends = useCallback(() => {
    sendMessage({ type: "get_friends" });
  }, [sendMessage]);

  const refreshActivity = useCallback(() => {
    sendMessage({ type: "get_activity" });
  }, [sendMessage]);

  return {
    ...state,
    setDisplayName,
    setUsername,
    searchPlayers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    challengeFriend,
    acceptChallenge,
    declineChallenge,
    blockUser,
    unblockUser,
    reportUser,
    refreshFriends,
    refreshActivity,
  };
}

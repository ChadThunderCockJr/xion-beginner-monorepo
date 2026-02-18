import { useAbstraxionAccount } from "@burnt-labs/abstraxion";

export function useAuth() {
  const { data: account, isConnected, isConnecting, isInitializing, login, logout } = useAbstraxionAccount();
  return {
    address: account?.bech32Address ?? null,
    isConnected,
    isConnecting: isInitializing || isConnecting,
    login,
    logout,
  };
}

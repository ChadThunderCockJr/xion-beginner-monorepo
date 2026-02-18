/**
 * Format USDC amount from micro-units to display (6 decimals → 2 decimal places).
 */
export function formatUSDC(microAmount: string | number): string {
  const amount =
    typeof microAmount === "string" ? parseInt(microAmount, 10) : microAmount;
  return (amount / 1_000_000).toFixed(2);
}

/**
 * Parse USDC display amount to micro-units.
 */
export function parseUSDC(displayAmount: number): string {
  return Math.floor(displayAmount * 1_000_000).toString();
}

/**
 * Format XION amount from uxion to XION (6 decimal places).
 */
export function formatXion(uxion: string | number): string {
  const amount = typeof uxion === "string" ? parseInt(uxion, 10) : uxion;
  return (amount / 1_000_000).toFixed(6);
}

/**
 * Parse XION amount to uxion.
 */
export function parseXion(xion: string | number): string {
  const amount = typeof xion === "string" ? parseFloat(xion) : xion;
  return Math.floor(amount * 1_000_000).toString();
}

/**
 * Shorten a XION address for display.
 */
export function shortenAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

/**
 * Design token values for use in SVG inline styles or dynamic calculations.
 * The CSS @theme tokens in globals.css are canonical; this is a convenience reference.
 *
 * For board colors, prefer using CSS variables directly (e.g. var(--color-board-felt-light))
 * so they respond to theme changes. The board tokens below are fallback values only.
 */
export const tokens = {
  bg: {
    deepest: "var(--color-bg-deepest)",
    base: "var(--color-bg-base)",
    elevated: "var(--color-bg-elevated)",
    surface: "var(--color-bg-surface)",
    subtle: "var(--color-bg-subtle)",
  },
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
    faint: "var(--color-text-faint)",
  },
  gold: {
    primary: "var(--color-gold-primary)",
    light: "var(--color-gold-light)",
    dark: "var(--color-gold-dark)",
    muted: "var(--color-gold-muted)",
  },
  semantic: {
    success: "var(--color-success)",
    successMuted: "var(--color-success-muted)",
    danger: "var(--color-danger)",
    dangerMuted: "var(--color-danger-muted)",
    warning: "var(--color-warning)",
  },
  burgundy: {
    deep: "var(--color-burgundy-deep)",
    accent: "var(--color-burgundy-accent)",
  },
  border: {
    subtle: "var(--color-border-subtle)",
    default: "var(--color-border-default)",
    strong: "var(--color-border-strong)",
  },
  /** Board colors — use CSS variables (var(--color-board-*)) in components for theme support */
  board: {
    feltLight: "var(--color-board-felt-light)",
    feltDark: "var(--color-board-felt-dark)",
    border: "var(--color-board-border)",
    bar: "var(--color-board-bar)",
    checkerWhite: "var(--color-checker-white)",
    checkerBlack: "var(--color-checker-black)",
    pointLight: "var(--color-board-point-light)",
    pointDark: "var(--color-board-point-dark)",
  },
} as const;

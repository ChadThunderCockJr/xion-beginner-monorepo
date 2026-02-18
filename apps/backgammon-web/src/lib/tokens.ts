/**
 * Design token values for use in SVG inline styles or dynamic calculations.
 * The CSS @theme tokens in globals.css are canonical; this is a convenience reference.
 */
export const tokens = {
  bg: {
    deepest: "#040604",
    base: "#0A120A",
    elevated: "#111C11",
    surface: "#1A2A1A",
    subtle: "#243424",
  },
  text: {
    primary: "#ECE8E0",
    secondary: "#C8C0B4",
    muted: "#8A8478",
    faint: "#5C5850",
  },
  gold: {
    primary: "#581428",
    light: "#6B2D3E",
    dark: "#3A0C1A",
    muted: "rgba(88, 20, 40, 0.15)",
  },
  semantic: {
    success: "#4ADE80",
    successMuted: "rgba(74, 222, 128, 0.12)",
    danger: "#F87171",
    dangerMuted: "rgba(248, 113, 113, 0.12)",
    warning: "#FBBF24",
  },
  burgundy: {
    deep: "#2A1215",
    accent: "#6B2D3E",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    default: "rgba(255, 255, 255, 0.10)",
    strong: "rgba(255, 255, 255, 0.16)",
  },
} as const;

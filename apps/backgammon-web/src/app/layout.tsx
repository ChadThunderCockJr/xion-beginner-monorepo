"use client";

import { AbstraxionProvider } from "@burnt-labs/abstraxion";
import { Cormorant_Garamond, Outfit, JetBrains_Mono, Pinyon_Script } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";

// One-time cleanup of stale Abstraxion state from failed auth attempts
if (typeof window !== "undefined" && window.localStorage.getItem("_abstraxion_cleaned") !== "5") {
  ["xion-authz-granter-account", "xion-authz-temp-account"].forEach((k) =>
    window.localStorage.removeItem(k),
  );
  // Remove any keypair data
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith("xion-") || k.startsWith("abstraxion"))
    .forEach((k) => window.localStorage.removeItem(k));
  window.localStorage.setItem("_abstraxion_cleaned", "5");
}

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const pinyonScript = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pinyon",
  display: "swap",
});

const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT || "";
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "";

const abstraxionConfig = {
  chainId: "xion-testnet-2",
  treasury: TREASURY_ADDRESS || "xion1awfqd5qw4mxzf4kg86qmgdvs6h9jmef9kvwgu0ykfx5aaz9p9rus20m3ky",
  // Explicit empty bank prevents SDK fallback bank config with broken "0.1" amount
  bank: [] as { denom: string; amount: string }[],
  ...(ESCROW_CONTRACT
    ? {
        contracts: [
          {
            address: ESCROW_CONTRACT,
            amounts: [{ denom: "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4", amount: "10000000" }],
          },
        ],
      }
    : {}),
  authentication: {
    type: 'redirect' as const,
    callbackUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Gammon</title>
        <meta name="description" content="Play competitive backgammon online" />
        <meta name="theme-color" content="#F5F1EB" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Inline script to set theme class before first paint — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("gammon-theme");document.documentElement.className=t==="lux"?"lux":t==="dark"?"dark":"light"}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${cormorant.variable} ${outfit.variable} ${jetbrainsMono.variable} ${pinyonScript.variable} antialiased`}
      >
        <ThemeProvider>
          <AbstraxionProvider config={abstraxionConfig}>
            {children}
          </AbstraxionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

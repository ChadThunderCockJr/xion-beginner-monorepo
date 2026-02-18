"use client";

import { AbstraxionProvider } from "@burnt-labs/abstraxion";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/contexts/ToastContext";
import { ToastContainer } from "@/components/ui/Toast";
import { KonamiCode } from "@/components/ui/KonamiCode";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Abstraxion configuration - XION testnet
const PYRAMID_CONTRACT = process.env.NEXT_PUBLIC_PYRAMID_CONTRACT || "";

const abstraxionConfig = {
  chainId: "xion-testnet-2",
  treasury: "xion1awfqd5qw4mxzf4kg86qmgdvs6h9jmef9kvwgu0ykfx5aaz9p9rus20m3ky",
  // Grant contract execution permissions for the pyramid contract
  grantContracts: PYRAMID_CONTRACT
    ? [
        {
          address: PYRAMID_CONTRACT,
          amounts: [{ denom: "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4", amount: "10000000" }],
        },
      ]
    : [],
  authentication: {
    type: 'redirect' as const,
    callbackUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <title>Pyramid Community</title>
        <meta
          name="description"
          content="Join the pyramid community. $8 to enter, earn $5 per referral."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable}`}>
        <AbstraxionProvider config={abstraxionConfig}>
          <ToastProvider>
            {/* Skip link for keyboard navigation */}
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>

            {/* Background gradient layer */}
            <div className="page-background" />

            {/* Smoke/haze effect - subtle, behind content */}
            <div className="smoke-layer" aria-hidden="true" />

            {/* Toast notifications */}
            <ToastContainer />

            {/* Easter eggs */}
            <KonamiCode />

            {/* Main content */}
            <div className="page-container">
              {children}
            </div>
          </ToastProvider>
        </AbstraxionProvider>
      </body>
    </html>
  );
}

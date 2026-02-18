"use client";

import { useEffect, useState, useCallback } from "react";
import { Confetti } from "./Confetti";

// Konami code: ↑↑↓↓←→←→BA
const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

export function KonamiCode() {
  const [inputSequence, setInputSequence] = useState<string[]>([]);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const newSequence = [...inputSequence, event.code].slice(-KONAMI_CODE.length);
    setInputSequence(newSequence);

    // Check if the sequence matches
    if (newSequence.length === KONAMI_CODE.length) {
      const matches = newSequence.every((key, index) => key === KONAMI_CODE[index]);
      if (matches) {
        // Trigger easter egg!
        setShowEasterEgg(true);
        setShowMessage(true);
        setInputSequence([]);

        // Hide message after 4 seconds
        setTimeout(() => setShowMessage(false), 4000);
      }
    }
  }, [inputSequence]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Confetti explosion */}
      <Confetti
        active={showEasterEgg}
        onComplete={() => setShowEasterEgg(false)}
        particleCount={150}
        duration={4000}
      />

      {/* Secret message */}
      {showMessage && (
        <div
          className="
            fixed inset-0 z-[300]
            flex items-center justify-center
            pointer-events-none
            animate-fade-in
          "
        >
          <div
            className="
              px-8 py-6
              bg-[hsl(220,14%,6%,0.95)]
              border border-[hsl(160,84%,50%,0.5)]
              rounded-2xl
              shadow-[0_0_60px_hsl(160,84%,50%,0.3)]
              text-center
              animate-level-up
            "
          >
            <div className="text-4xl mb-2">👁️</div>
            <p
              className="text-[hsl(160,84%,50%)] text-lg font-bold tracking-widest uppercase"
              style={{ textShadow: "0 0 20px hsl(160,84%,50%)" }}
            >
              The Eye Sees All
            </p>
            <p className="text-[hsl(215,12%,55%)] text-xs mt-2 tracking-wider">
              You have discovered a secret
            </p>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

interface LevelUpModalProps {
  isOpen: boolean;
  tier: "INITIATE" | "OPERATOR" | "ARCHITECT" | "APEX";
  onClose: () => void;
  autoCloseDelay?: number;
}

const tierConfig = {
  INITIATE: {
    color: "hsl(215, 12%, 55%)",
    bgGradient: "from-[hsl(220,13%,14%)] to-[hsl(220,14%,10%)]",
    borderColor: "border-[hsl(220,12%,20%)]",
    glowColor: "shadow-[0_0_60px_hsl(215,12%,55%,0.3)]",
    message: "Your journey begins",
  },
  OPERATOR: {
    color: "hsl(200, 80%, 65%)",
    bgGradient: "from-[hsl(200,30%,15%)] to-[hsl(220,14%,8%)]",
    borderColor: "border-[hsl(200,40%,30%)]",
    glowColor: "shadow-[0_0_60px_hsl(200,80%,65%,0.3)]",
    message: "You've proven your worth",
  },
  ARCHITECT: {
    color: "hsl(280, 80%, 75%)",
    bgGradient: "from-[hsl(280,30%,15%)] to-[hsl(260,40%,10%)]",
    borderColor: "border-[hsl(280,40%,35%)]",
    glowColor: "shadow-[0_0_60px_hsl(280,80%,75%,0.4)]",
    message: "The pyramid rises beneath you",
  },
  APEX: {
    color: "hsl(160, 84%, 50%)",
    bgGradient: "from-[hsl(160,50%,12%)] to-[hsl(160,84%,8%)]",
    borderColor: "border-[hsl(160,60%,35%)]",
    glowColor: "shadow-[0_0_80px_hsl(160,84%,50%,0.5)]",
    message: "You have reached the summit",
  },
};

export function LevelUpModal({ isOpen, tier, onClose, autoCloseDelay = 4000 }: LevelUpModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const config = tierConfig[tier];

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setIsClosing(false);

      // Auto close
      const timer = setTimeout(() => {
        setIsClosing(true);
        setTimeout(onClose, 300);
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseDelay, onClose]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[150]
        flex items-center justify-center
        bg-[hsl(220,14%,6%,0.9)]
        backdrop-blur-sm
        transition-opacity duration-300
        ${isClosing ? "opacity-0" : "opacity-100"}
      `}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-up-title"
    >
      <div
        className={`
          relative
          flex flex-col items-center
          p-8 px-12
          rounded-2xl
          bg-gradient-to-b ${config.bgGradient}
          border ${config.borderColor}
          ${config.glowColor}
          transition-all duration-300
          ${isClosing ? "scale-90 opacity-0" : "scale-100 opacity-100"}
          ${isAnimating ? "animate-level-up" : ""}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative pyramid */}
        <div
          className="absolute -top-6 text-4xl animate-pulse"
          style={{ color: config.color }}
        >
          △
        </div>

        {/* Title */}
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(215,12%,55%)] mb-2">
          You have ascended to
        </p>

        {/* Tier name */}
        <h2
          id="level-up-title"
          className="text-4xl font-bold tracking-wide mb-4 animate-glow-pulse"
          style={{ color: config.color }}
        >
          {tier}
        </h2>

        {/* Badge visual */}
        <div
          className={`
            w-20 h-20
            flex items-center justify-center
            rounded-full
            border-2
            mb-4
            animate-badge-reveal
          `}
          style={{
            borderColor: config.color,
            background: `radial-gradient(circle, ${config.color}20 0%, transparent 70%)`,
          }}
        >
          <span className="text-3xl" style={{ color: config.color }}>
            △
          </span>
        </div>

        {/* Message */}
        <p className="text-sm text-[hsl(210,20%,92%,0.8)] text-center max-w-[200px]">
          {config.message}
        </p>

        {/* Click to close hint */}
        <p className="text-xs text-[hsl(215,12%,55%,0.5)] mt-6">
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}

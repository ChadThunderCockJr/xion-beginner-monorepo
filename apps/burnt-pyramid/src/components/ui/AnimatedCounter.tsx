"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: "number" | "currency" | "compact";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  onComplete?: () => void;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function formatNumber(
  value: number,
  format: "number" | "currency" | "compact",
  decimals: number
): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case "compact":
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toFixed(decimals);
    default:
      return value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

export function AnimatedCounter({
  value,
  duration = 1500,
  format = "number",
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  onComplete,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);
  const previousValueRef = useRef(0);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setDisplayValue(value);
      previousValueRef.current = value;
      onComplete?.();
      return;
    }

    const startValue = previousValueRef.current;
    const endValue = value;
    const startTime = performance.now();

    // Trigger pulse animation if value increased
    if (endValue > startValue && startValue > 0) {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 300);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValueRef.current = endValue;
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration, onComplete]);

  return (
    <span
      className={`
        tabular-nums
        transition-transform duration-300
        ${isPulsing ? "animate-stat-pulse" : ""}
        ${className}
      `}
    >
      {prefix}
      {formatNumber(displayValue, format, decimals)}
      {suffix}
    </span>
  );
}

// Hook version for more control
export function useAnimatedValue(targetValue: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const previousRef = useRef(0);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setValue(targetValue);
      previousRef.current = targetValue;
      return;
    }

    const startValue = previousRef.current;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = startValue + (targetValue - startValue) * easedProgress;
      setValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setValue(targetValue);
        previousRef.current = targetValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [targetValue, duration]);

  return value;
}

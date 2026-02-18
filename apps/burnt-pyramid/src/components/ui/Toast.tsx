"use client";

import { useEffect, useState } from "react";
import { useToast, Toast as ToastType } from "@/contexts/ToastContext";

const iconMap: Record<string, string> = {
  success: "✓",
  info: "ℹ",
  error: "✕",
  celebration: "△",
};

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const startTime = Date.now();
    const duration = toast.duration;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      }
    };

    requestAnimationFrame(updateProgress);
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  };

  const typeStyles: Record<string, string> = {
    success: "border-l-[hsl(160_84%_50%)] bg-[hsl(160_84%_50%/0.1)]",
    info: "border-l-[hsl(215_12%_55%)] bg-[hsl(220_13%_14%)]",
    error: "border-l-[hsl(0_62%_55%)] bg-[hsl(0_62%_55%/0.1)]",
    celebration: "border-l-[hsl(160_84%_50%)] bg-gradient-to-r from-[hsl(160_84%_50%/0.15)] to-[hsl(160_84%_50%/0.1)]",
  };

  const iconColors: Record<string, string> = {
    success: "text-[hsl(160_84%_50%)]",
    info: "text-[hsl(215_12%_55%)]",
    error: "text-[hsl(0_62%_55%)]",
    celebration: "text-[hsl(160_84%_50%)]",
  };

  return (
    <div
      role="alert"
      className={`
        relative overflow-hidden
        flex items-start gap-3
        w-[calc(100vw-2rem)] max-w-[340px] p-4
        rounded-lg border-l-4 border border-[hsl(220_12%_16%)]
        shadow-lg shadow-black/30
        backdrop-blur-sm
        transition-all duration-200
        ${typeStyles[toast.type]}
        ${isExiting ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}
        ${toast.type === "celebration" ? "animate-toast-celebrate" : "animate-toast-in"}
      `}
    >
      {/* Icon */}
      <div
        className={`
          flex-shrink-0 w-6 h-6
          flex items-center justify-center
          rounded-full
          text-sm font-bold
          ${iconColors[toast.type]}
          ${toast.type === "celebration" ? "animate-pulse" : ""}
        `}
      >
        {toast.icon || iconMap[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[hsl(210_20%_92%)] text-sm">
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-[hsl(215_12%_55%)] text-xs mt-0.5">
            {toast.description}
          </p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="
          flex-shrink-0 w-5 h-5
          flex items-center justify-center
          rounded-full
          text-[hsl(215_12%_55%)] text-xs
          hover:text-[hsl(210_20%_92%)] hover:bg-[hsl(220_12%_16%)]
          transition-colors
        "
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(220_12%_16%)]">
          <div
            className={`
              h-full transition-none
              bg-[hsl(160_84%_50%)]
            `}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="
        fixed top-4 right-4 z-[100]
        flex flex-col gap-3
        pointer-events-none
      "
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}

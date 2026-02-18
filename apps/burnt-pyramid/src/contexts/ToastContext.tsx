"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

export type ToastType = "success" | "info" | "error" | "celebration";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  icon?: string;
  duration?: number;
  showConfetti?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (options: Omit<Toast, "id">) => void;
  celebrate: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (options: Omit<Toast, "id">) => {
      const id = `toast-${++toastIdRef.current}`;
      const duration = options.duration ?? 5000;

      const newToast: Toast = {
        ...options,
        id,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const celebrate = useCallback(
    (title: string, description?: string) => {
      toast({
        type: "celebration",
        title,
        description,
        icon: "△",
        showConfetti: true,
        duration: 6000,
      });
    },
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, celebrate, dismiss, dismissAll }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

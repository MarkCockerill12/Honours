// Error Toast Notification Component
"use client";

import React, { useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export type ToastType = "error" | "warning" | "success" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ErrorToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export function ErrorToast({ toast, onDismiss }: ErrorToastProps) {
  useTheme();

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case "error":
        return "bg-red-950/90 border-red-500/50 text-red-100";
      case "warning":
        return "bg-amber-950/90 border-amber-500/50 text-amber-100";
      case "success":
        return "bg-emerald-950/90 border-emerald-500/50 text-emerald-100";
      case "info":
        return "bg-blue-950/90 border-blue-500/50 text-blue-100";
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm
        animate-in slide-in-from-right duration-300
        ${getStyles()}
      `}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm mb-1">{toast.title}</h4>
        <p className="text-xs opacity-90 break-words">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <div className="space-y-2 pointer-events-auto">
        {toasts.map((toast) => (
          <ErrorToast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

// Hook to manage toasts
export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts((prev) => [
      ...prev,
      { ...toast, id, duration: toast.duration || 5000 },
    ]);
    return id;
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const error = React.useCallback(
    (title: string, message: string, duration?: number) => {
      return addToast({ type: "error", title, message, duration });
    },
    [addToast],
  );

  const warning = React.useCallback(
    (title: string, message: string, duration?: number) => {
      return addToast({ type: "warning", title, message, duration });
    },
    [addToast],
  );

  const success = React.useCallback(
    (title: string, message: string, duration?: number) => {
      return addToast({ type: "success", title, message, duration });
    },
    [addToast],
  );

  const info = React.useCallback(
    (title: string, message: string, duration?: number) => {
      return addToast({ type: "info", title, message, duration });
    },
    [addToast],
  );

  return {
    toasts,
    addToast,
    dismissToast,
    error,
    warning,
    success,
    info,
  };
}


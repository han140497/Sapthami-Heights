"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function showToast(message: string, type: ToastType = "success") {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
              t.type === "success"
                ? "border-positive/30 bg-positive/10 text-positive dark:bg-positive/20"
                : t.type === "error"
                ? "border-negative/30 bg-negative/10 text-negative dark:bg-negative/20"
                : "border-accent/30 bg-accent/10 text-accent dark:bg-accent/20"
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {t.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {t.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
              {t.type === "info" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg: string) => {
        if (typeof window !== "undefined") alert(msg);
      },
    };
  }
  return context;
}

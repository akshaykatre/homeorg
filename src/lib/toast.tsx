"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && (
        <div
          role="status"
          className="fixed left-1/2 bottom-24 z-30 -translate-x-1/2 max-w-[calc(100%-32px)] rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

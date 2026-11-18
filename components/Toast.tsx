"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

interface ToastContextValue {
  notify: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0"
      >
        {message ? (
          <div className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-md bg-surface-3 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <p className="flex-1 text-[13px] leading-[20px] text-text-1">{message}</p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              aria-label="Dismiss"
              className="-m-1 inline-flex size-11 items-center justify-center rounded-sm text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

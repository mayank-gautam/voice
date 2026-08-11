"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type LoadingContextValue = {
  isLoading: boolean;
  message: string;
  /** Increment the global loading counter (supports nested operations). */
  startLoading: (message?: string) => void;
  /** Decrement the global loading counter. */
  stopLoading: () => void;
  /** Run an async task under the global loader. */
  withLoading: <T>(task: () => Promise<T>, message?: string) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

const DEFAULT_MESSAGE = "Please wait while we load your account.";

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const messageStackRef = useRef<string[]>([]);

  const startLoading = useCallback((nextMessage?: string) => {
    const msg = nextMessage?.trim() || DEFAULT_MESSAGE;
    messageStackRef.current.push(msg);
    setMessage(msg);
    setCount((value) => value + 1);
  }, []);

  const stopLoading = useCallback(() => {
    messageStackRef.current.pop();
    const previous = messageStackRef.current[messageStackRef.current.length - 1];
    setMessage(previous || DEFAULT_MESSAGE);
    setCount((value) => Math.max(0, value - 1));
  }, []);

  const withLoading = useCallback(
    async <T,>(task: () => Promise<T>, nextMessage?: string): Promise<T> => {
      startLoading(nextMessage);
      try {
        return await task();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  const value = useMemo(
    () => ({
      isLoading: count > 0,
      message,
      startLoading,
      stopLoading,
      withLoading,
    }),
    [count, message, startLoading, stopLoading, withLoading],
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useGlobalLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useGlobalLoading must be used within LoadingProvider.");
  }
  return context;
}

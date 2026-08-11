"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useGlobalLoading } from "@/lib/loading";

/**
 * Shows the global loader briefly while App Router navigations settle.
 * Page-level data fetches should use local skeletons/spinners only — do not
 * also call startLoading for the same work (avoids stacked full-screen loaders).
 */
function RouteLoadingListenerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useGlobalLoading();
  const previousKeyRef = useRef<string | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (previousKeyRef.current === null) {
      previousKeyRef.current = key;
      return;
    }
    if (previousKeyRef.current === key) return;
    previousKeyRef.current = key;

    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
      stopLoading();
    }

    startLoading("Loading page…");
    stopTimerRef.current = setTimeout(() => {
      stopLoading();
      stopTimerRef.current = null;
    }, 450);

    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
        stopLoading();
      }
    };
  }, [pathname, searchParams, startLoading, stopLoading]);

  return null;
}

export function RouteLoadingListener() {
  return (
    <Suspense fallback={null}>
      <RouteLoadingListenerInner />
    </Suspense>
  );
}

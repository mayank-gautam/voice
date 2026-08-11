"use client";

import { Loader2 } from "lucide-react";
import { useGlobalLoading } from "@/lib/loading";

export function GlobalLoader() {
  const { isLoading, message } = useGlobalLoading();

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Loading…</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

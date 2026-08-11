"use client";

import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallDetailLoaderProps {
  callId?: string;
  className?: string;
}

export function CallDetailLoader({ callId, className }: CallDetailLoaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 min-h-[420px] animate-fade-in",
        className
      )}
    >
      <div className="relative flex items-center justify-center w-28 h-28">
        <span className="absolute inset-0 rounded-full border border-primary/30 call-ring-pulse" />
        <span className="absolute inset-2 rounded-full border border-primary/40 call-ring-pulse call-ring-delay-1" />
        <span className="absolute inset-4 rounded-full border border-primary/50 call-ring-pulse call-ring-delay-2" />
        <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-primary/15 border border-primary/40 call-phone-bob">
          <Phone className="w-6 h-6 text-primary" />
        </div>
      </div>

      <div className="flex items-end justify-center gap-1 h-8" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-primary/70 call-wave-bar"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>

      <div className="text-center space-y-1.5 px-4">
        <p className="text-sm font-medium">Connecting to call details…</p>
        {callId && (
          <p className="text-xs font-mono text-muted-foreground truncate max-w-xs mx-auto">{callId}</p>
        )}
        <p className="text-[11px] text-muted-foreground">Fetching call metadata and analytics</p>
      </div>
    </div>
  );
}

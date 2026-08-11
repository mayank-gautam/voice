"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useState } from "react";
import { TimeRangeProvider } from "@/lib/timeRange";
import { LoadingProvider } from "@/lib/loading";
import { GlobalLoader } from "@/components/loading/GlobalLoader";
import { RouteLoadingListener } from "@/components/loading/RouteLoadingListener";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="voiceai-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LoadingProvider>
            <TimeRangeProvider>
              <RouteLoadingListener />
              {children}
              <GlobalLoader />
              <Toaster />
              <Sonner />
            </TimeRangeProvider>
          </LoadingProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

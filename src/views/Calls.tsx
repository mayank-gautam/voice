"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CallsTable } from "@/components/dashboard/CallsTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneIncoming, PhoneOutgoing, AlertTriangle, RefreshCw, Loader2, Search } from "lucide-react";
import { useProjects } from "@/lib/projectConfig";
import { useTimeRange } from "@/lib/timeRange";
import type { CallEnvTag } from "@/lib/callEnvTag";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

type CallRow = {
  id: string;
  timestamp: string;
  callerNumber: string;
  callType: "inbound" | "outbound";
  duration: number;
  status: "completed" | "failed" | "dropped" | "escalated" | "active";
  agentSteps: number;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  hasTranscript: boolean;
  cost: string;
  envTag?: CallEnvTag | null;
};

const ENV_TAG_BATCH = 30;

const CallsContent = () => {
  const { activeId, active, loading: projectsLoading } = useProjects();
  const { timeRange, dateRange, getBounds, refreshToken, triggerRefresh } = useTimeRange();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [source, setSource] = useState<"twilio" | "empty">("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callIdInput, setCallIdInput] = useState("");
  const [callIdFilter, setCallIdFilter] = useState("");
  const enrichGenRef = useRef(0);
  const requestGenRef = useRef(0);
  const previousProjectRef = useRef<string | null | undefined>(undefined);

  // Clear stale call data immediately when the project changes.
  useEffect(() => {
    if (previousProjectRef.current === undefined) {
      previousProjectRef.current = activeId;
      return;
    }
    if (previousProjectRef.current === activeId) return;
    previousProjectRef.current = activeId;
    enrichGenRef.current += 1;
    setCalls([]);
    setSource("empty");
    setError(null);
    setCallIdInput("");
    setCallIdFilter("");
    setLoading(true);
  }, [activeId]);

  const enrichEnvTags = useCallback(
    async (items: CallRow[], projectId: string | null | undefined, gen: number) => {
      const missing = items.filter((c) => !c.envTag).map((c) => c.id);
      if (missing.length === 0) return;

      for (let i = 0; i < missing.length; i += ENV_TAG_BATCH) {
        if (enrichGenRef.current !== gen) return;
        const batch = missing.slice(i, i + ENV_TAG_BATCH);
        try {
          const params = new URLSearchParams();
          if (projectId) params.set("projectId", projectId);
          const res = await apiFetch(`/api/calls/env-tags?${params}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sids: batch }),
          });
          if (!res.ok || enrichGenRef.current !== gen) continue;
          const data = (await res.json()) as {
            tags?: Record<string, CallEnvTag | null>;
          };
          const tags = data.tags || {};
          setCalls((prev) =>
            prev.map((c) => {
              if (!(c.id in tags)) return c;
              if (c.envTag) return c;
              return { ...c, envTag: tags[c.id] ?? null };
            }),
          );
        } catch {
          /* skip batch */
        }
      }
    },
    [],
  );

  const load = useCallback(
    async (projectId?: string | null) => {
      const requestGen = ++requestGenRef.current;
      const enrichGen = ++enrichGenRef.current;
      setLoading(true);
      setError(null);
      setCalls([]);
      try {
        if (!projectId) {
          setSource("empty");
          setError("No project selected for this AWS account.");
          return;
        }

        const bounds = getBounds();
        const params = new URLSearchParams({ limit: "1000" });
        params.set("projectId", projectId);
        if (bounds.after) params.set("startTimeAfter", bounds.after.toISOString());
        if (bounds.before) params.set("startTimeBefore", bounds.before.toISOString());

        const res = await apiFetch(`/api/calls?${params}`);
        const data = await res.json();
        if (requestGen !== requestGenRef.current) return;

        if (!res.ok) {
          if (data?.error?.code === "NO_PROJECT") {
            setSource("empty");
            setError(
              data?.error?.message ||
                "No project configured for the selected AWS account/role.",
            );
            return;
          }
          throw new Error(data?.error?.message || "Failed to load calls");
        }

        const items = (data.items || []) as CallRow[];
        setCalls(items);
        setSource("twilio");
        if (data.truncated) {
          setError("Showing the latest 1,000 calls in this range (Twilio page cap).");
        }
        void enrichEnvTags(items, projectId, enrichGen);
      } catch (e) {
        if (requestGen !== requestGenRef.current) return;
        if ((e as { code?: string })?.code === "AUTH_REQUIRED") return;
        setCalls([]);
        setSource("empty");
        const msg = e instanceof Error ? e.message : "Failed to load calls";
        setError(msg);
        toast.error(msg);
      } finally {
        if (requestGen === requestGenRef.current) {
          setLoading(false);
        }
      }
    },
    [enrichEnvTags, getBounds],
  );

  useEffect(() => {
    if (projectsLoading) return;
    void load(activeId);
  }, [activeId, projectsLoading, load, refreshToken, timeRange, dateRange]);

  const visibleCalls = useMemo(() => {
    const q = callIdFilter.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter((call) => call.id.toLowerCase().includes(q));
  }, [calls, callIdFilter]);

  const inboundCount = visibleCalls.filter((c) => c.callType === "inbound").length;
  const outboundCount = visibleCalls.filter((c) => c.callType === "outbound").length;
  const failedCount = visibleCalls.filter(
    (c) => c.status === "failed" || c.status === "dropped",
  ).length;
  const showLoader = loading || projectsLoading;

  const applyCallIdFilter = (event?: React.FormEvent) => {
    event?.preventDefault();
    setCallIdFilter(callIdInput.trim());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Call History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showLoader
              ? "Loading calls…"
              : source === "twilio"
                ? `Live Twilio calls${active?.name ? ` · ${active.name}` : ""}`
                : "No Twilio calls loaded for the selected project"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => triggerRefresh()}
          disabled={showLoader}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${showLoader ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <form
        onSubmit={applyCallIdFilter}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Call ID
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={callIdInput}
            onChange={(e) => setCallIdInput(e.target.value)}
            placeholder="Enter Call SID (e.g. CAxxxxxxxx)"
            className="pl-9 bg-background/50 border-border/50 font-mono text-sm"
            disabled={showLoader}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={showLoader}>
            Search
          </Button>
          {callIdFilter && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={showLoader}
              onClick={() => {
                setCallIdInput("");
                setCallIdFilter("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {error && !showLoader && (
        <p className="text-xs text-chart-warning border border-chart-warning/30 bg-chart-warning/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Calls"
          value={showLoader ? "…" : visibleCalls.length}
          icon={<Phone className="w-4 h-4" />}
        />
        <MetricCard
          title="Inbound"
          value={showLoader ? "…" : inboundCount}
          icon={<PhoneIncoming className="w-4 h-4" />}
          variant="success"
        />
        <MetricCard
          title="Outbound"
          value={showLoader ? "…" : outboundCount}
          icon={<PhoneOutgoing className="w-4 h-4" />}
          variant="info"
        />
        <MetricCard
          title="Failed/Dropped"
          value={showLoader ? "…" : failedCount}
          icon={<AlertTriangle className="w-4 h-4" />}
          variant="destructive"
        />
      </div>

      {showLoader ? (
        <div className="relative rounded-xl border border-border/50 bg-card/40 overflow-hidden min-h-[320px]">
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {active?.name ? `Fetching calls for ${active.name}…` : "Fetching call list…"}
            </p>
          </div>
          <div className="p-4 space-y-3 pointer-events-none opacity-40">
            <div className="flex gap-3">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </div>
      ) : visibleCalls.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/40 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No results found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {callIdFilter
              ? `No calls match Call ID “${callIdFilter}” in the selected project.`
              : "No Twilio calls are available for the selected project and time range."}
          </p>
        </div>
      ) : (
        <CallsTable calls={visibleCalls} resetKey={`${activeId}:${callIdFilter}`} />
      )}
    </div>
  );
};

const Calls = () => (
  <DashboardLayout>
    <CallsContent />
  </DashboardLayout>
);

export default Calls;

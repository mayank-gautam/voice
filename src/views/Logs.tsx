"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { useProjects } from "@/lib/projectConfig";
import {
  buildAwsCredentialHeaders,
  getActiveCredentials,
} from "@/lib/get-active-credentials";
import { clearSelectedCredentials } from "@/lib/credentials-store";
import { toast } from "sonner";
import { inferServiceName } from "@/lib/serviceMapFromLogs";

type LogEvent = {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName?: string;
  level?: string;
  service?: string;
};

const PAGE_SIZE = 100;

function inferLevel(message: string, explicit?: string): "info" | "warn" | "error" | "debug" {
  if (explicit) {
    const l = explicit.toLowerCase();
    if (l.includes("error") || l.includes("fatal")) return "error";
    if (l.includes("warn")) return "warn";
    if (l.includes("debug") || l.includes("trace")) return "debug";
    if (l.includes("info")) return "info";
  }
  const m = message.toLowerCase();
  if (/\berror\b|\bfatal\b|\bexception\b|\bfailed\b/.test(m)) return "error";
  if (/\bwarn\b|\bwarning\b/.test(m)) return "warn";
  if (/\bdebug\b|\btrace\b/.test(m)) return "debug";
  return "info";
}

function inferService(e: LogEvent): string {
  if (e.service?.trim()) return e.service.trim();
  return inferServiceName(e);
}

function extractTraceId(message: string, fallback: string): string {
  const m =
    message.match(/\b(?:trace[_-]?id|traceId)[=:\s]+([A-Za-z0-9_-]+)/i) ||
    message.match(/\b(trace-[A-Za-z0-9_-]+)\b/i);
  return m?.[1] || fallback;
}

function extractDisplayMessage(raw: string): string {
  const text = raw?.trim() ?? "";
  if (!text) return "";

  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const candidates = [parsed.msg, parsed.message, parsed.Message, parsed.log, parsed.text];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
        if (c != null && typeof c !== "object") return String(c);
      }
    } catch {
      /* fall through */
    }
  }

  const kv = text.match(/(?:^|[\s,{])(?:msg|message)\s*[:=]\s*"?([^"\n,}]+)"?/i);
  if (kv?.[1]?.trim()) return kv[1].trim();

  return text;
}

function eventKey(e: LogEvent): string {
  return `${e.timestamp}|${e.logStreamName}|${e.logGroupName || ""}|${e.message}`;
}

const levelIcons = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  debug: CheckCircle,
};

const levelColors = {
  info: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  debug: "text-muted-foreground",
};

function LogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCallId = searchParams.get("callId")?.trim() || "";
  const { activeId, active, loading: projectsLoading } = useProjects();

  const [callIdInput, setCallIdInput] = useState(urlCallId);
  const [activeCallId, setActiveCallId] = useState(urlCallId);
  const [messageFilter, setMessageFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(Boolean(urlCallId));

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const eventsLenRef = useRef(0);
  const previousProjectRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    setCallIdInput(urlCallId);
  }, [urlCallId]);

  // Clear logs / Call ID filter when the authorized project changes.
  useEffect(() => {
    if (previousProjectRef.current === undefined) {
      previousProjectRef.current = activeId;
      return;
    }
    if (previousProjectRef.current === activeId) return;
    previousProjectRef.current = activeId;

    setEvents([]);
    eventsLenRef.current = 0;
    setHasMore(false);
    setError(null);
    setExpandedKey(null);
    setSearched(false);
    setActiveCallId("");
    setCallIdInput("");
    setMessageFilter("");
    setLevelFilter("all");
    setServiceFilter("all");
    if (urlCallId) {
      router.replace("/logs");
    }
  }, [activeId, router, urlCallId]);

  const fetchPage = useCallback(
    async (callId: string, opts: { offset?: number; append: boolean }) => {
      const creds = await getActiveCredentials();
      if (creds.ok === false) {
        await clearSelectedCredentials().catch(() => undefined);
        toast.error(creds.message);
        router.replace("/sso");
        return;
      }

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(opts.offset ?? 0));
      if (activeId) params.set("projectId", activeId);

      const res = await fetch(
        `/api/calls/${encodeURIComponent(callId)}/logs?${params.toString()}`,
        {
          credentials: "include",
          headers: buildAwsCredentialHeaders(creds.aws, creds.credentials.accountId),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to load logs");

      setConfigured(data.configured !== false);
      setHasMore(Boolean(data.hasMore));

      const page: LogEvent[] = data.events || [];
      setEvents((prev) => {
        if (!opts.append) {
          eventsLenRef.current = page.length;
          return page;
        }
        const seen = new Set(prev.map(eventKey));
        const merged = [...prev];
        for (const e of page) {
          const k = eventKey(e);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(e);
        }
        eventsLenRef.current = merged.length;
        return merged;
      });

      if (data.message && data.configured === false) setError(data.message);
      else if (data.message && page.length === 0 && !opts.append) setError(data.message);
      else setError(null);
    },
    [activeId, router]
  );

  const loadForCallId = useCallback(
    async (rawCallId: string) => {
      const callId = rawCallId.trim();
      if (!callId) {
        setError("Enter a Call SID / Call ID to search logs.");
        setEvents([]);
        eventsLenRef.current = 0;
        setHasMore(false);
        setSearched(false);
        setActiveCallId("");
        return;
      }

      setSearched(true);
      setActiveCallId(callId);
      setLoading(true);
      setError(null);
      setExpandedKey(null);
      setHasMore(false);
      setEvents([]);
      eventsLenRef.current = 0;

      try {
        await fetchPage(callId, { offset: 0, append: false });
      } catch (e) {
        setEvents([]);
        eventsLenRef.current = 0;
        setHasMore(false);
        setError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    },
    [fetchPage]
  );

  // Load whenever URL callId or active project changes
  useEffect(() => {
    if (projectsLoading) return;
    if (!urlCallId) {
      setSearched(false);
      setActiveCallId("");
      setEvents([]);
      eventsLenRef.current = 0;
      setHasMore(false);
      setLoading(false);
      return;
    }
    void loadForCallId(urlCallId);
  }, [urlCallId, activeId, loadForCallId, projectsLoading]);

  const loadMore = useCallback(async () => {
    if (!activeCallId || !hasMore || loadingMoreRef.current || loading) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchPage(activeCallId, { offset: eventsLenRef.current, append: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more logs");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [activeCallId, fetchPage, hasMore, loading]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loading, events.length]);

  const enriched = useMemo(
    () =>
      events.map((e) => ({
        ...e,
        level: inferLevel(e.message, e.level),
        service: inferService(e),
        traceId: extractTraceId(e.message, activeCallId || "—"),
        displayMessage: extractDisplayMessage(e.message),
      })),
    [events, activeCallId]
  );

  const services = useMemo(
    () => [...new Set(enriched.map((l) => l.service))].sort(),
    [enriched]
  );

  const filteredLogs = useMemo(() => {
    const q = messageFilter.trim().toLowerCase();
    return enriched.filter((log) => {
      const matchesText =
        !q ||
        log.message.toLowerCase().includes(q) ||
        log.displayMessage.toLowerCase().includes(q) ||
        log.traceId.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        log.logStreamName.toLowerCase().includes(q);
      const matchesLevel = levelFilter === "all" || log.level === levelFilter;
      const matchesService = serviceFilter === "all" || log.service === serviceFilter;
      return matchesText && matchesLevel && matchesService;
    });
  }, [enriched, messageFilter, levelFilter, serviceFilter]);

  const onSubmitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const callId = callIdInput.trim();
    if (!callId) {
      setError("Enter a Call SID / Call ID to search logs.");
      router.replace("/logs");
      return;
    }
    if (callId === urlCallId) {
      void loadForCallId(callId);
      return;
    }
    router.replace(`/logs?callId=${encodeURIComponent(callId)}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Logs & Traces</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search CloudWatch logs by Call SID
          {active?.name ? ` · ${active.name}` : ""}
          {searched && activeCallId && !loading && events.length > 0 ? (
            <span>
              {" "}
              · {events.length}
              {hasMore ? "+" : ""} events
            </span>
          ) : null}
        </p>
      </div>

      <form
        onSubmit={onSubmitSearch}
        className="glass-card border border-border/50 rounded-xl p-4 space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Enter Call SID / Call ID (e.g. CAxxxxxxxx…)"
              value={callIdInput}
              onChange={(e) => setCallIdInput(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" disabled={loading} className="gap-2 shrink-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-border/50 shrink-0"
            disabled={!activeCallId || loading || loadingMore}
            onClick={() => void loadForCallId(activeCallId || callIdInput)}
          >
            <RefreshCw className={cn("w-4 h-4", (loading || loadingMore) && "animate-spin")} />
          </Button>
        </div>

        {searched && activeCallId && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing logs for <span className="font-mono text-foreground">{activeCallId}</span>
            </span>
            <Link
              href={`/calls/${encodeURIComponent(activeCallId)}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open call detail <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </form>

      {error && (
        <div className="text-xs text-chart-warning border border-chart-warning/30 bg-chart-warning/10 rounded-lg px-3 py-2 space-y-1">
          <p>{error}</p>
          {!configured && (
            <Link href="/settings" className="underline text-primary">
              Open project settings
            </Link>
          )}
        </div>
      )}

      {searched && (
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter loaded messages…"
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
                className="pl-9 bg-background/50 border-border/50 font-mono text-sm"
                disabled={loading || events.length === 0}
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[120px] bg-background/50 border-border/50">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="glass-card border border-border/50 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-border/50 bg-muted/30">
          <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase">
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-1">Level</div>
            <div className="col-span-2">Service</div>
            <div className="col-span-5">Message</div>
            <div className="col-span-2">Trace ID</div>
          </div>
        </div>
        <div
          ref={scrollRef}
          className="divide-y divide-border/30 max-h-[600px] overflow-y-auto scrollbar-thin"
        >
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-sm">Enter a Call SID above to load CloudWatch logs.</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">Fetching logs for {activeCallId || "call"}…</p>
            </div>
          )}

          {searched && !loading && filteredLogs.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p className="text-sm">No log events for this Call SID.</p>
            </div>
          )}

          {!loading &&
            filteredLogs.map((log, index) => {
              const Icon = levelIcons[log.level] || Info;
              const rowKey = `${log.timestamp}-${index}-${log.logStreamName}`;
              const isOpen = expandedKey === rowKey;

              return (
                <div
                  key={rowKey}
                  className={cn(
                    log.level === "error" && "bg-destructive/5",
                    log.level === "warn" && "bg-warning/5"
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setExpandedKey(isOpen ? null : rowKey)}
                    className={cn(
                      "w-full text-left grid grid-cols-12 gap-4 p-3 text-sm hover:bg-muted/30 transition-colors cursor-pointer",
                      isOpen && "bg-muted/40"
                    )}
                  >
                    <div className="col-span-2 font-mono text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                      <span className="truncate">
                        {log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss.SSS") : "—"}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <div className={cn("inline-flex items-center gap-1.5", levelColors[log.level])}>
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs uppercase">{log.level}</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center min-w-0">
                      <span className="px-2 py-0.5 text-xs bg-secondary rounded-md truncate">
                        {log.service}
                      </span>
                    </div>
                    <div className="col-span-5 truncate self-center" title={log.displayMessage}>
                      {log.displayMessage}
                    </div>
                    <div
                      className="col-span-2 font-mono text-xs text-primary truncate self-center"
                      title={log.traceId}
                    >
                      {log.traceId}
                    </div>
                  </button>

                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/20 bg-muted/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-muted-foreground font-mono">
                          <div className="min-w-0">
                            <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                              Log group
                            </span>
                            <p className="break-all">{log.logGroupName || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                              Log stream
                            </span>
                            <p className="break-all">{log.logStreamName || "—"}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px] font-mono">
                            Full message
                          </span>
                          <pre className="mt-1 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed bg-background/60 border border-border/40 rounded-lg p-3 max-h-64 overflow-y-auto scrollbar-thin">
                            {log.message}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          {!loading && filteredLogs.length > 0 && (
            <div ref={sentinelRef} className="py-3 flex flex-col items-center justify-center gap-1">
              {loadingMore && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Loading more logs…
                </div>
              )}
              {!loadingMore && hasMore && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => void loadMore()}
                >
                  Load more
                </button>
              )}
              {!loadingMore && !hasMore && (
                <p className="text-[11px] text-muted-foreground">End of logs for this Call SID</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Logs = () => (
  <DashboardLayout>
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Loading logs…</span>
        </div>
      }
    >
      <LogsContent />
    </Suspense>
  </DashboardLayout>
);

export default Logs;

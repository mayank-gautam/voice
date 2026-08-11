"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { clearSelectedCredentials } from "@/lib/credentials-store";
import { toast } from "sonner";
import { inferServiceName } from "@/lib/serviceMapFromLogs";
import { formatProjectNameDisplay } from "@/lib/formatProjectName";
import {
  fetchCallLogsChunk,
  LOGS_CHUNK_SIZE,
  type LogsApiEvent,
} from "@/lib/logsApi";

type LogEvent = LogsApiEvent;

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

type EnrichedLog = LogEvent & {
  level: "info" | "warn" | "error" | "debug";
  service: string;
  traceId: string;
  displayMessage: string;
  rowKey: string;
};

function LogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCallId = searchParams.get("callId")?.trim() || "";
  const { activeId, active, loading: projectsLoading } = useProjects();
  const projectDisplay = formatProjectNameDisplay(active?.name);

  const [callIdInput, setCallIdInput] = useState(urlCallId);
  const [activeCallId, setActiveCallId] = useState(urlCallId);
  const [messageFilter, setMessageFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(Boolean(urlCallId));

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const eventsLenRef = useRef(0);
  const hasMoreRef = useRef(false);
  const requestGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const previousProjectRef = useRef<string | null | undefined>(undefined);
  const activeProjectRef = useRef(activeId);

  useEffect(() => {
    activeProjectRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    setCallIdInput(urlCallId);
  }, [urlCallId]);

  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestGenRef.current += 1;
    loadingMoreRef.current = false;
  }, []);

  // Clear logs when the authorized project changes.
  useEffect(() => {
    if (previousProjectRef.current === undefined) {
      previousProjectRef.current = activeId;
      return;
    }
    if (previousProjectRef.current === activeId) return;
    previousProjectRef.current = activeId;

    cancelInFlight();
    setEvents([]);
    eventsLenRef.current = 0;
    setHasMore(false);
    hasMoreRef.current = false;
    setError(null);
    setLoadMoreError(null);
    setExpandedKey(null);
    setSearched(false);
    setActiveCallId("");
    setCallIdInput("");
    setMessageFilter("");
    setLevelFilter("all");
    setServiceFilter("all");
    setLoading(false);
    setLoadingMore(false);
    if (urlCallId) {
      router.replace("/logs");
    }
  }, [activeId, router, urlCallId, cancelInFlight]);

  const fetchPage = useCallback(
    async (
      callId: string,
      opts: { offset?: number; append: boolean },
      gen: number,
      signal: AbortSignal,
    ) => {
      const projectIdAtStart = activeProjectRef.current;
      const result = await fetchCallLogsChunk({
        callId,
        projectId: projectIdAtStart,
        offset: opts.offset ?? 0,
        limit: LOGS_CHUNK_SIZE,
        signal,
      });

      if (gen !== requestGenRef.current) return;
      if (activeProjectRef.current !== projectIdAtStart) return;

      setConfigured(result.configured);
      setHasMore(result.hasMore);
      hasMoreRef.current = result.hasMore;

      const page = result.events;
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

      if (result.message && result.configured === false) setError(result.message);
      else if (result.message && page.length === 0 && !opts.append) setError(result.message);
      else if (!opts.append) setError(null);
    },
    [],
  );

  const loadForCallId = useCallback(
    async (rawCallId: string) => {
      const callId = rawCallId.trim();
      if (!callId) {
        setError("Enter a Call SID / Call ID to search logs.");
        setEvents([]);
        eventsLenRef.current = 0;
        setHasMore(false);
        hasMoreRef.current = false;
        setSearched(false);
        setActiveCallId("");
        return;
      }

      cancelInFlight();
      const gen = requestGenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      setSearched(true);
      setActiveCallId(callId);
      setLoading(true);
      setError(null);
      setLoadMoreError(null);
      setExpandedKey(null);
      setHasMore(false);
      hasMoreRef.current = false;
      setEvents([]);
      eventsLenRef.current = 0;

      try {
        await fetchPage(callId, { offset: 0, append: false }, gen, controller.signal);
      } catch (e) {
        if (gen !== requestGenRef.current) return;
        if ((e as { name?: string })?.name === "AbortError") return;
        const err = e as Error & { code?: string };
        if (err.code === "AUTH_REQUIRED") {
          await clearSelectedCredentials().catch(() => undefined);
          toast.error(err.message);
          router.replace("/sso");
          return;
        }
        setEvents([]);
        eventsLenRef.current = 0;
        setHasMore(false);
        hasMoreRef.current = false;
        setError(err.message || "Failed to load logs");
      } finally {
        if (gen === requestGenRef.current) setLoading(false);
      }
    },
    [cancelInFlight, fetchPage, router],
  );

  useEffect(() => {
    if (projectsLoading) return;
    if (!urlCallId) {
      setSearched(false);
      setActiveCallId("");
      setEvents([]);
      eventsLenRef.current = 0;
      setHasMore(false);
      hasMoreRef.current = false;
      setLoading(false);
      return;
    }
    void loadForCallId(urlCallId);
  }, [urlCallId, activeId, loadForCallId, projectsLoading]);

  const loadMore = useCallback(async () => {
    if (
      !activeCallId ||
      !hasMoreRef.current ||
      loadingMoreRef.current ||
      loading ||
      !activeProjectRef.current
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    const gen = requestGenRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const projectIdAtStart = activeProjectRef.current;
    const offset = eventsLenRef.current;

    try {
      await fetchPage(
        activeCallId,
        { offset, append: true },
        gen,
        controller.signal,
      );
    } catch (e) {
      if (gen !== requestGenRef.current) return;
      if ((e as { name?: string })?.name === "AbortError") return;
      if (activeProjectRef.current !== projectIdAtStart) return;
      const err = e as Error & { code?: string };
      if (err.code === "AUTH_REQUIRED") {
        await clearSelectedCredentials().catch(() => undefined);
        toast.error(err.message);
        router.replace("/sso");
        return;
      }
      setLoadMoreError(err.message || "Failed to load more logs");
    } finally {
      if (gen === requestGenRef.current) {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    }
  }, [activeCallId, fetchPage, loading, router]);

  // Prefetch next chunk ~70–80% before absolute bottom (large rootMargin).
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !searched || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root, rootMargin: "480px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loading, searched, events.length, hasMore]);

  const enriched = useMemo<EnrichedLog[]>(
    () =>
      events.map((e, index) => ({
        ...e,
        level: inferLevel(e.message, e.level),
        service: inferService(e),
        traceId: extractTraceId(e.message, activeCallId || "—"),
        displayMessage: extractDisplayMessage(e.message),
        rowKey: `${eventKey(e)}|${index}`,
      })),
    [events, activeCallId],
  );

  const services = useMemo(
    () => [...new Set(enriched.map((l) => l.service))].sort(),
    [enriched],
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

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 12,
    measureElement:
      typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  });

  const onSubmitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const callId = callIdInput.trim();
    if (!callId) {
      setError("Enter a Call SID / Call ID to search logs.");
      router.replace("/logs");
      return;
    }
    // Client-side filters only apply to loaded chunks — reset them on new search.
    setMessageFilter("");
    setLevelFilter("all");
    setServiceFilter("all");
    if (callId === urlCallId) {
      void loadForCallId(callId);
      return;
    }
    router.replace(`/logs?callId=${encodeURIComponent(callId)}`);
  };

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Logs & Traces</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search CloudWatch logs by Call SID for the current project
          {projectDisplay ? (
            <span className="text-foreground font-medium tracking-wide">
              {" "}
              · {projectDisplay}
            </span>
          ) : null}
          {searched && activeCallId && !loading && events.length > 0 ? (
            <span>
              {" "}
              · {events.length}
              {hasMore ? "+" : ""} events · chunks of {LOGS_CHUNK_SIZE}
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
          <Button type="submit" disabled={loading || projectsLoading} className="gap-2 shrink-0">
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
              {projectDisplay ? (
                <>
                  {" "}
                  · project{" "}
                  <span className="font-medium tracking-wide text-foreground">{projectDisplay}</span>
                </>
              ) : null}
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
            <p className="text-muted-foreground">
              Ensure the current project is mapped in account-hierarchy for ECS/Lambda log groups.
            </p>
          )}
          {activeCallId && (
            <button
              type="button"
              className="underline text-primary"
              onClick={() => void loadForCallId(activeCallId)}
            >
              Retry
            </button>
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
          className="max-h-[600px] overflow-y-auto scrollbar-thin relative"
        >
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Search className="w-8 h-8 opacity-40" />
              <p className="text-sm">Enter a Call SID above to load CloudWatch logs.</p>
              {projectDisplay ? (
                <p className="text-xs tracking-wide">Current project: {projectDisplay}</p>
              ) : null}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm">
                Fetching first {LOGS_CHUNK_SIZE} logs
                {projectDisplay ? ` for ${projectDisplay}` : ""}…
              </p>
            </div>
          )}

          {searched && !loading && filteredLogs.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <AlertCircle className="w-8 h-8 opacity-50" />
              <p className="text-sm">
                {events.length === 0
                  ? "No log events for this Call SID."
                  : "No loaded events match the current filters."}
              </p>
            </div>
          )}

          {!loading && filteredLogs.length > 0 && (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const log = filteredLogs[virtualRow.index];
                if (!log) return null;
                const Icon = levelIcons[log.level] || Info;
                const isOpen = expandedKey === log.rowKey;

                return (
                  <div
                    key={log.rowKey}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={cn(
                      "absolute top-0 left-0 w-full border-b border-border/30",
                      log.level === "error" && "bg-destructive/5",
                      log.level === "warn" && "bg-warning/5",
                    )}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpandedKey(isOpen ? null : log.rowKey)}
                      className={cn(
                        "w-full text-left grid grid-cols-12 gap-4 p-3 text-sm hover:bg-muted/30 transition-colors cursor-pointer",
                        isOpen && "bg-muted/40",
                      )}
                    >
                      <div className="col-span-2 font-mono text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                        <ChevronDown
                          className={cn(
                            "w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                            isOpen && "rotate-180",
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

                    {isOpen && (
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/20 bg-muted/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-muted-foreground font-mono">
                          <div className="min-w-0">
                            <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                              Project
                            </span>
                            <p className="tracking-wide">
                              {projectDisplay || "—"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                              Log group
                            </span>
                            <p className="break-all">{log.logGroupName || "—"}</p>
                          </div>
                          <div className="min-w-0 sm:col-span-2">
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
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (filteredLogs.length > 0 || (hasMore && events.length > 0)) && (
            <div ref={sentinelRef} className="py-3 flex flex-col items-center justify-center gap-1">
              {loadingMore && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Loading next {LOGS_CHUNK_SIZE} logs…
                </div>
              )}
              {loadMoreError && !loadingMore && (
                <div className="flex flex-col items-center gap-1 text-xs text-chart-warning">
                  <p>{loadMoreError}</p>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => void loadMore()}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!loadingMore && !loadMoreError && !hasMore && filteredLogs.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  You&apos;ve reached the end of logs for this Call SID
                </p>
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

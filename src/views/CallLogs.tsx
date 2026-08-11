"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronDown,
  Download,
  Network,
  FileText,
  Layers,
  Clock,
  ListOrdered,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useProjects } from "@/lib/projectConfig";
import {
  buildAwsCredentialHeaders,
  getActiveCredentials,
} from "@/lib/get-active-credentials";
import { clearSelectedCredentials } from "@/lib/credentials-store";
import { inferServiceName } from "@/lib/serviceMapFromLogs";
import { formatProjectNameDisplay } from "@/lib/formatProjectName";
import { CallLogServiceMapModal } from "@/components/dashboard/call-analytics/CallLogServiceMapModal";

type LogEvent = {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName?: string;
  level?: string;
  service?: string;
};

const PAGE_SIZE = 200;

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

/** Prefer API service, then last segment of log group, else stream name. */
function inferService(e: LogEvent): string {
  if (e.service?.trim()) return e.service.trim();
  return inferServiceName(e);
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

const CallLogs = () => {
  const params = useParams();
  const router = useRouter();
  const callId = typeof params.id === "string" ? params.id : params.id?.[0];
  const { activeId, active } = useProjects();

  const [events, setEvents] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const eventsLenRef = useRef(0);

  const fetchPage = useCallback(
    async (opts: { offset?: number; append: boolean; all?: boolean }) => {
      if (!callId) return;

      const creds = await getActiveCredentials();
      if (creds.ok === false) {
        await clearSelectedCredentials().catch(() => undefined);
        toast.error(creds.message);
        router.replace("/sso");
        return;
      }

      const params = new URLSearchParams();
      if (opts.all) {
        params.set("all", "1");
      } else {
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(opts.offset ?? 0));
      }
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
      const page: LogEvent[] = data.events || [];
      // Short last page (e.g. 123 of 523) always ends pagination.
      setHasMore(Boolean(data.hasMore) && (opts.all || page.length >= PAGE_SIZE));

      setEvents((prev) => {
        if (!opts.append || opts.all) {
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
      else if (opts.append || opts.all) setError(null);
      else if (!data.message) setError(null);
    },
    [callId, activeId, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpandedKey(null);
    setHasMore(false);
    try {
      setEvents([]);
      eventsLenRef.current = 0;
      await fetchPage({ offset: 0, append: false });
    } catch (e) {
      setEvents([]);
      eventsLenRef.current = 0;
      setHasMore(false);
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loading || loadingAll || downloading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage({ offset: eventsLenRef.current, append: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more logs");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [fetchPage, hasMore, loading, loadingAll, downloading]);

  const loadAll = useCallback(async () => {
    if (!callId || loading || loadingAll || downloading || loadingMoreRef.current) return;
    setLoadingAll(true);
    setError(null);
    try {
      await fetchPage({ all: true, append: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load all logs");
    } finally {
      setLoadingAll(false);
    }
  }, [callId, fetchPage, loading, loadingAll, downloading]);

  const downloadCompleteLog = useCallback(async () => {
    if (!callId || loading || loadingAll || downloading || loadingMoreRef.current) return;
    setDownloading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ all: "1" });
      if (activeId) params.set("projectId", activeId);

      const creds = await getActiveCredentials();
      if (creds.ok === false) {
        await clearSelectedCredentials().catch(() => undefined);
        toast.error(creds.message);
        router.replace("/sso");
        return;
      }

      const res = await fetch(
        `/api/calls/${encodeURIComponent(callId)}/logs?${params.toString()}`,
        {
          credentials: "include",
          headers: buildAwsCredentialHeaders(creds.aws, creds.credentials.accountId),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to download logs");

      setConfigured(data.configured !== false);
      setHasMore(Boolean(data.hasMore));

      const allEvents: LogEvent[] = data.events || [];
      setEvents(allEvents);
      eventsLenRef.current = allEvents.length;

      if (data.message && allEvents.length === 0) {
        setError(data.message);
        toast.error(data.message);
        return;
      }

      const header = [
        `# CloudWatch logs for Call SID ${callId}`,
        `# Project: ${formatProjectNameDisplay(active?.name) || activeId || "—"}`,
        `# Exported: ${new Date().toISOString()}`,
        `# Events: ${allEvents.length}`,
        `# Columns: timestamp, level, service, logGroup, logStream, message`,
        "",
      ].join("\n");

      const lines = allEvents.map((e) => {
        const ts = e.timestamp
          ? format(new Date(e.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")
          : "";
        const level = inferLevel(e.message, e.level);
        const service = inferService(e);
        const group = (e.logGroupName || "").replace(/\t/g, " ");
        const stream = (e.logStreamName || "").replace(/\t/g, " ");
        const message = (e.message || "").replace(/\r?\n/g, "\\n");
        return `${ts}\t${level}\t${service}\t${group}\t${stream}\t${message}`;
      });

      const blob = new Blob([header + lines.join("\n") + "\n"], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `call-${callId}-logs.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${allEvents.length} log events`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to download logs";
      setError(msg);
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  }, [callId, activeId, active?.name, loading, loadingAll, downloading]);

  useEffect(() => {
    void load();
  }, [load]);

  // Infinite scroll — load next page when sentinel enters view
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
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
        displayMessage: extractDisplayMessage(e.message),
      })),
    [events]
  );

  const services = useMemo(
    () => [...new Set(enriched.map((l) => l.service))].sort(),
    [enriched]
  );

  const summary = useMemo(() => {
    let errors = 0;
    let warns = 0;
    let info = 0;
    let debug = 0;
    let firstTs = 0;
    let lastTs = 0;
    for (const e of enriched) {
      if (e.level === "error") errors += 1;
      else if (e.level === "warn") warns += 1;
      else if (e.level === "debug") debug += 1;
      else info += 1;
      if (e.timestamp) {
        if (!firstTs || e.timestamp < firstTs) firstTs = e.timestamp;
        if (e.timestamp > lastTs) lastTs = e.timestamp;
      }
    }
    const total = enriched.length;
    const errorRate = total ? Math.round((errors / total) * 1000) / 10 : 0;
    return {
      total,
      errors,
      warns,
      info,
      debug,
      services: services.length,
      errorRate,
      durationMs: firstTs && lastTs ? Math.max(0, lastTs - firstTs) : 0,
      hasMore,
    };
  }, [enriched, services.length, hasMore]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((log) => {
      const matchesSearch =
        !q ||
        log.message.toLowerCase().includes(q) ||
        log.displayMessage.toLowerCase().includes(q) ||
        log.service.toLowerCase().includes(q) ||
        log.logStreamName.toLowerCase().includes(q);
      const matchesLevel = levelFilter === "all" || log.level === levelFilter;
      const matchesService = serviceFilter === "all" || log.service === serviceFilter;
      return matchesSearch && matchesLevel && matchesService;
    });
  }, [enriched, search, levelFilter, serviceFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 mt-0.5"
              onClick={() => router.push(`/calls/${callId}`)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Logs & Traces</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Distributed tracing and log aggregation
                {callId ? (
                  <>
                    {" "}
                    for{" "}
                    <span className="font-mono text-foreground/80">{callId}</span>
                  </>
                ) : null}
                {active?.name ? ` · ${formatProjectNameDisplay(active.name)}` : ""}
                {!loading && events.length > 0 ? (
                  <span className="text-muted-foreground/80">
                    {" "}
                    · {events.length}
                    {hasMore ? "+" : ""} events
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={
                loading ||
                loadingAll ||
                downloading ||
                loadingMore ||
                (!hasMore && events.length > 0)
              }
              onClick={() => void loadAll()}
              title="Fetch all matching logs for this Call SID (up to 10,000)"
            >
              {loadingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ListOrdered className="w-3.5 h-3.5" />
              )}
              {loadingAll ? "Loading all…" : "Load all"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || loadingAll || downloading || !configured}
              onClick={() => void downloadCompleteLog()}
              title="Download complete CloudWatch logs for this Call SID (up to 10,000)"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {downloading ? "Downloading…" : "Download"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || loadingAll || downloading || events.length === 0}
              onClick={() => setMapOpen(true)}
            >
              <Network className="w-3.5 h-3.5" />
              Service Map
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryStat
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Total logs"
            value={loading ? "…" : `${summary.total}${summary.hasMore ? "+" : ""}`}
          />
          <SummaryStat
            icon={<AlertCircle className="w-3.5 h-3.5 text-destructive" />}
            label="Errors"
            value={loading ? "…" : String(summary.errors)}
            valueClassName={summary.errors > 0 ? "text-destructive" : undefined}
          />
          <SummaryStat
            icon={<AlertTriangle className="w-3.5 h-3.5 text-warning" />}
            label="Warnings"
            value={loading ? "…" : String(summary.warns)}
            valueClassName={summary.warns > 0 ? "text-warning" : undefined}
          />
          <SummaryStat
            icon={<Info className="w-3.5 h-3.5 text-info" />}
            label="Info"
            value={loading ? "…" : String(summary.info)}
          />
          <SummaryStat
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Services"
            value={loading ? "…" : String(summary.services)}
          />
          <SummaryStat
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Error rate"
            value={loading ? "…" : `${summary.errorRate}%`}
            valueClassName={
              summary.errorRate >= 10
                ? "text-destructive"
                : summary.errorRate > 0
                  ? "text-warning"
                  : undefined
            }
          />
        </div>

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

        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search log messages…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background/50 border-border/50 font-mono text-sm"
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
            <Button
              variant="outline"
              size="icon"
              className="border-border/50"
              onClick={() => void load()}
              disabled={loading || loadingMore || loadingAll || downloading}
            >
              <RefreshCw
                className={cn(
                  "w-4 h-4",
                  (loading || loadingMore || loadingAll || downloading) && "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>

        <div className="glass-card border border-border/50 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border/50 bg-muted/30">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase">
              <div className="col-span-2">Timestamp</div>
              <div className="col-span-1">Level</div>
              <div className="col-span-2">Service</div>
              <div className="col-span-7">Message</div>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="divide-y divide-border/30 max-h-[600px] overflow-y-auto scrollbar-thin"
          >
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm">Fetching CloudWatch logs for this call…</p>
              </div>
            )}

            {loadingAll && !loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground border-b border-border/30">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Loading all logs for this Call SID…</p>
              </div>
            )}
            {downloading && !loading && !loadingAll && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground border-b border-border/30">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Preparing complete log download…</p>
              </div>
            )}

            {!loading && filteredLogs.length === 0 && (
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
                          {log.timestamp
                            ? format(new Date(log.timestamp), "HH:mm:ss.SSS")
                            : "—"}
                        </span>
                      </div>
                      <div className="col-span-1 flex items-center">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1.5",
                            levelColors[log.level]
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-xs uppercase">{log.level}</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center min-w-0">
                        <span className="px-2 py-0.5 text-xs bg-secondary rounded-md truncate">
                          {log.service}
                        </span>
                      </div>
                      <div className="col-span-7 truncate self-center" title={log.displayMessage}>
                        {log.displayMessage}
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
                            <div className="min-w-0">
                              <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                                Timestamp
                              </span>
                              <p>
                                {log.timestamp
                                  ? format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss.SSS")
                                  : "—"}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <span className="text-muted-foreground/70 uppercase tracking-wide text-[10px]">
                                Level
                              </span>
                              <p className="uppercase">{log.level}</p>
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

            {/* Infinite-scroll sentinel */}
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

        {callId && (
          <CallLogServiceMapModal
            open={mapOpen}
            onOpenChange={setMapOpen}
            callId={callId}
            events={events}
            hasMore={hasMore}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

function SummaryStat({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="glass-card border border-border/50 rounded-xl px-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className={cn("text-xl font-semibold tabular-nums", valueClassName)}>{value}</div>
    </div>
  );
}

export default CallLogs;

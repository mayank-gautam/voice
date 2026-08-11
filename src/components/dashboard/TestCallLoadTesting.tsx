"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Play, Square, Gauge, Activity, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { download } from "@/lib/testSuite";
import Link from "next/link";

export type TestCallPayload = {
  to: string;
  from: string;
  mode: "twiml" | "webhook";
  twiml?: string;
  url?: string;
  timeout?: number;
  timeLimit?: number;
  record?: boolean;
  statusCallback?: string;
};

type Tick = {
  t: number;
  concurrent: number;
  started: number;
  completed: number;
  failed: number;
  p50: number;
  p95: number;
};

type CallResult = {
  sid?: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  at: number;
};

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function createTestCall(
  projectId: string | null | undefined,
  payload: TestCallPayload
): Promise<{ sid: string; status: string }> {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);

  const res = await fetch(`/api/test-calls?${params}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to create call");
  }
  return { sid: data.call.sid as string, status: data.call.status as string };
}

type Props = {
  projectId: string | null | undefined;
  payload: TestCallPayload | null;
  canStart: boolean;
  onRunningChange?: (running: boolean) => void;
};

export function TestCallLoadTesting({ projectId, payload, canStart, onRunningChange }: Props) {
  const [concurrency, setConcurrency] = useState(5);
  const [rampSec, setRampSec] = useState(10);
  const [durationSec, setDurationSec] = useState(60);
  const [maxCalls, setMaxCalls] = useState(50);
  const [running, setRunning] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [results, setResults] = useState<CallResult[]>([]);

  const stopRef = useRef(false);
  const inFlightRef = useRef(0);
  const startedRef = useRef(0);
  const completedRef = useRef(0);
  const failedRef = useRef(0);
  const latenciesRef = useRef<number[]>([]);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const setRunningSafe = useCallback(
    (value: boolean) => {
      setRunning(value);
      onRunningChange?.(value);
    },
    [onRunningChange]
  );

  const clearTimers = useCallback(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    tickTimerRef.current = null;
    spawnTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    stopRef.current = true;
    clearTimers();
  }, [clearTimers]);

  const stop = useCallback(
    (silent = false) => {
      stopRef.current = true;
      clearTimers();
      setRunningSafe(false);
      if (!silent) toast.info("Load test stopped");
    },
    [clearTimers, setRunningSafe]
  );

  const fireOne = useCallback(async () => {
    const body = payloadRef.current;
    if (!body || stopRef.current) return;

    inFlightRef.current += 1;
    startedRef.current += 1;
    const t0 = performance.now();
    try {
      const call = await createTestCall(projectId, body);
      const latencyMs = Math.round(performance.now() - t0);
      latenciesRef.current.push(latencyMs);
      completedRef.current += 1;
      setResults((prev) =>
        [{ sid: call.sid, ok: true, latencyMs, at: Date.now() }, ...prev].slice(0, 40)
      );
    } catch (err) {
      const latencyMs = Math.round(performance.now() - t0);
      failedRef.current += 1;
      latenciesRef.current.push(latencyMs);
      setResults((prev) =>
        [
          {
            ok: false,
            latencyMs,
            error: err instanceof Error ? err.message : "Failed",
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 40)
      );
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
    }
  }, [projectId]);

  const start = useCallback(() => {
    if (!payloadRef.current || !canStart) {
      toast.error("Configure valid test call parameters first");
      return;
    }

    stopRef.current = false;
    inFlightRef.current = 0;
    startedRef.current = 0;
    completedRef.current = 0;
    failedRef.current = 0;
    latenciesRef.current = [];
    startedAtRef.current = Date.now();
    setTicks([]);
    setResults([]);
    setRunningSafe(true);
    toast.success(`Load test started — target ${concurrency} concurrent`);

    tickTimerRef.current = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const sorted = [...latenciesRef.current].sort((a, b) => a - b);
      setTicks((prev) => [
        ...prev,
        {
          t: elapsedSec,
          concurrent: inFlightRef.current,
          started: startedRef.current,
          completed: completedRef.current,
          failed: failedRef.current,
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
        },
      ]);

      if (elapsedSec >= durationSec) {
        stop(true);
        toast.success("Load test complete");
      }
    }, 1000);

    spawnTimerRef.current = setInterval(() => {
      if (stopRef.current) return;
      const elapsedSec = (Date.now() - startedAtRef.current) / 1000;
      if (elapsedSec >= durationSec) return;
      if (startedRef.current >= maxCalls) return;

      const ramp = Math.min(1, elapsedSec / Math.max(0.001, rampSec));
      const target = Math.max(1, Math.round(concurrency * ramp));
      const slots = Math.min(
        target - inFlightRef.current,
        maxCalls - startedRef.current
      );
      for (let i = 0; i < slots; i++) {
        void fireOne();
      }
    }, 250);
  }, [canStart, concurrency, durationSec, fireOne, maxCalls, rampSec, setRunningSafe, stop]);

  const last = ticks[ticks.length - 1];
  const totalOk = last?.completed ?? completedRef.current;
  const totalFailed = last?.failed ?? failedRef.current;
  const totalAttempts = totalOk + totalFailed;
  const errorRate = totalAttempts ? (totalFailed / totalAttempts) * 100 : 0;
  const peakP95 = ticks.length ? Math.max(...ticks.map((x) => x.p95)) : 0;
  const avgP50 = ticks.length
    ? Math.round(ticks.reduce((a, b) => a + b.p50, 0) / ticks.length)
    : 0;
  const elapsed = last?.t ?? 0;
  const peakConcurrent = ticks.length ? Math.max(...ticks.map((x) => x.concurrent)) : 0;

  const summaryLine = useMemo(() => {
    if (!payload) return "Set To / From and instructions above";
    return `${payload.from} → ${payload.to} · ${payload.mode === "twiml" ? "TwiML" : "Webhook"}`;
  }, [payload]);

  const exportRun = () => {
    download(
      `test-call-load-${Date.now()}.json`,
      JSON.stringify(
        {
          config: {
            concurrency,
            rampSec,
            durationSec,
            maxCalls,
            call: payload,
          },
          summary: {
            started: startedRef.current,
            completed: totalOk,
            failed: totalFailed,
            errorRate: +errorRate.toFixed(2),
            avgP50,
            peakP95,
            peakConcurrent,
          },
          samples: ticks,
          recent: results,
        },
        null,
        2
      ),
      "application/json"
    );
    toast.success("Load test results exported");
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Using test call parameters</CardTitle>
          <CardDescription className="font-mono text-xs">{summaryLine}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              Load profile
            </CardTitle>
            <CardDescription>
              Places real Twilio calls with the settings above. Keep concurrency low — each call
              incurs Twilio cost.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Concurrent calls</Label>
                <span className="font-mono">{concurrency}</span>
              </div>
              <Slider
                value={[concurrency]}
                min={1}
                max={25}
                step={1}
                disabled={running}
                onValueChange={([v]) => setConcurrency(v)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Ramp-up</Label>
                <span className="font-mono">{rampSec}s</span>
              </div>
              <Slider
                value={[rampSec]}
                min={0}
                max={120}
                step={5}
                disabled={running}
                onValueChange={([v]) => setRampSec(v)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Duration</Label>
                <span className="font-mono">{durationSec}s</span>
              </div>
              <Slider
                value={[durationSec]}
                min={10}
                max={300}
                step={10}
                disabled={running}
                onValueChange={([v]) => setDurationSec(v)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Max total calls</Label>
                <span className="font-mono">{maxCalls}</span>
              </div>
              <Slider
                value={[maxCalls]}
                min={1}
                max={200}
                step={1}
                disabled={running}
                onValueChange={([v]) => setMaxCalls(v)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {running ? (
                <Button variant="destructive" className="flex-1" onClick={() => stop()}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button className="flex-1" onClick={start} disabled={!canStart}>
                  <Play className="w-4 h-4 mr-2" />
                  Start load test
                </Button>
              )}
              <Button variant="outline" onClick={exportRun} disabled={!ticks.length}>
                <Download className="w-4 h-4" />
              </Button>
            </div>

            {running && (
              <div className="space-y-1.5">
                <Progress value={Math.min(100, (elapsed / durationSec) * 100)} />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {elapsed}s / {durationSec}s · in flight {last?.concurrent ?? 0} · started{" "}
                  {last?.started ?? 0}/{maxCalls}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "In flight", value: last?.concurrent ?? 0, tone: "text-primary" },
              { label: "Created OK", value: totalOk, tone: "text-success" },
              {
                label: "Error rate",
                value: `${errorRate.toFixed(1)}%`,
                tone: errorRate > 5 ? "text-destructive" : "text-foreground",
              },
              { label: "Peak p95 create", value: `${peakP95}ms`, tone: "text-warning" },
            ].map((s) => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Concurrency & creates
              </CardTitle>
              {running && (
                <Badge variant="outline" className="text-xs text-success border-success/40">
                  live
                </Badge>
              )}
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...chartTooltip} />
                  <Area
                    type="monotone"
                    dataKey="concurrent"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                    name="In flight"
                  />
                  <Area
                    type="monotone"
                    dataKey="started"
                    stroke="hsl(var(--info))"
                    fill="hsl(var(--info) / 0.15)"
                    name="Started (cum)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Create latency (API)</CardTitle>
            </CardHeader>
            <CardContent className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ticks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...chartTooltip} />
                  <Line
                    type="monotone"
                    dataKey="p50"
                    stroke="hsl(var(--success))"
                    dot={false}
                    name="p50 ms"
                  />
                  <Line
                    type="monotone"
                    dataKey="p95"
                    stroke="hsl(var(--warning))"
                    dot={false}
                    name="p95 ms"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {!!ticks.length && !running && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Run summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Avg p50 create</p>
                  <p className="font-semibold">{avgP50} ms</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peak concurrency</p>
                  <p className="font-semibold">{peakConcurrent}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed creates</p>
                  <p className="font-semibold">{totalFailed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="font-semibold font-mono text-xs break-all">
                    {payload?.to || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!!results.length && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Recent creates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-56 overflow-auto">
                {results.map((r, i) => (
                  <div
                    key={`${r.at}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs border-b border-border/40 pb-1.5 last:border-0"
                  >
                    <div className="min-w-0">
                      {r.ok && r.sid ? (
                        <Link
                          href={`/calls/${r.sid}`}
                          className="font-mono text-primary hover:underline truncate block"
                        >
                          {r.sid}
                        </Link>
                      ) : (
                        <p className="text-destructive truncate">{r.error || "Failed"}</p>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground shrink-0">{r.latencyMs}ms</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Play, Square, Gauge, Activity, Download } from "lucide-react";
import { toast } from "sonner";
import { download, type TestCase } from "@/lib/testSuite";

interface Tick {
  t: number;
  concurrent: number;
  started: number;
  completed: number;
  failed: number;
  p50: number;
  p95: number;
  asrMs: number;
  llmMs: number;
  ttsMs: number;
}

const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  },
};

export const LoadTesting = ({ cases }: { cases: TestCase[] }) => {
  const [target, setTarget] = useState("+1 415 555 0142");
  const [scenario, setScenario] = useState<string>("mixed");
  const [concurrency, setConcurrency] = useState(25);
  const [rampSec, setRampSec] = useState(20);
  const [durationSec, setDurationSec] = useState(60);
  const [running, setRunning] = useState(false);
  const [ticks, setTicks] = useState<Tick[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const stop = (silent = false) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
    if (!silent) toast.info("Load test stopped");
  };

  const start = () => {
    setTicks([]);
    setRunning(true);
    toast.success(`Load test started — ${concurrency} concurrent calls`);
    let t = 0;
    let completed = 0;
    let failed = 0;
    timer.current = setInterval(() => {
      t += 1;
      const ramp = Math.min(1, t / Math.max(1, rampSec));
      const concurrent = Math.round(concurrency * ramp * (0.9 + Math.random() * 0.15));
      const stress = concurrent / concurrency;
      const started = Math.max(1, Math.round(concurrent / 4));
      const failRate = 0.01 + Math.max(0, stress - 0.75) * 0.14;
      const nowFailed = Math.random() < failRate * 3 ? 1 : 0;
      failed += nowFailed;
      completed += Math.max(0, started - nowFailed);
      const asrMs = Math.round(180 + stress * 190 + Math.random() * 60);
      const llmMs = Math.round(520 + stress * 900 + Math.random() * 180);
      const ttsMs = Math.round(140 + stress * 160 + Math.random() * 50);
      const p50 = asrMs + llmMs + ttsMs;
      const p95 = Math.round(p50 * (1.35 + stress * 0.35));
      setTicks((prev) => [
        ...prev,
        { t, concurrent, started, completed, failed, p50, p95, asrMs, llmMs, ttsMs },
      ]);
      if (t >= durationSec) {
        stop(true);
        toast.success("Load test complete");
      }
    }, 1000);
  };

  const last = ticks[ticks.length - 1];
  const totalCalls = last?.completed ?? 0;
  const totalFailed = last?.failed ?? 0;
  const errorRate = totalCalls + totalFailed ? (totalFailed / (totalCalls + totalFailed)) * 100 : 0;
  const peakP95 = ticks.length ? Math.max(...ticks.map((x) => x.p95)) : 0;
  const avgP50 = ticks.length ? Math.round(ticks.reduce((a, b) => a + b.p50, 0) / ticks.length) : 0;
  const elapsed = last?.t ?? 0;

  const exportRun = () => {
    download(
      `load-test-${Date.now()}.json`,
      JSON.stringify(
        {
          config: { target, scenario, concurrency, rampSec, durationSec },
          summary: { totalCalls, totalFailed, errorRate: +errorRate.toFixed(2), avgP50, peakP95 },
          samples: ticks,
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
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              Load profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Target agent number</Label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} disabled={running} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scenario</Label>
              <Select value={scenario} onValueChange={setScenario} disabled={running}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed (all test cases)</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.id} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Concurrent calls</Label>
                <span className="font-mono">{concurrency}</span>
              </div>
              <Slider
                value={[concurrency]}
                min={1}
                max={200}
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
                min={5}
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
                min={30}
                max={600}
                step={30}
                disabled={running}
                onValueChange={([v]) => setDurationSec(v)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              {running ? (
                <Button variant="destructive" className="flex-1" onClick={() => stop()}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button className="flex-1" onClick={start}>
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
                <Progress value={(elapsed / durationSec) * 100} />
                <p className="text-xs text-muted-foreground">
                  {elapsed}s / {durationSec}s elapsed
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Active calls", value: last?.concurrent ?? 0, tone: "text-primary" },
              { label: "Completed", value: totalCalls, tone: "text-success" },
              {
                label: "Error rate",
                value: `${errorRate.toFixed(1)}%`,
                tone: errorRate > 5 ? "text-destructive" : "text-foreground",
              },
              { label: "Peak p95", value: `${peakP95}ms`, tone: "text-warning" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Concurrency & throughput
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
                    name="Concurrent calls"
                  />
                  <Area
                    type="monotone"
                    dataKey="started"
                    stroke="hsl(var(--info))"
                    fill="hsl(var(--info) / 0.15)"
                    name="Calls/sec"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Response latency</CardTitle>
              </CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ticks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip {...chartTooltip} />
                    <Line type="monotone" dataKey="p50" stroke="hsl(var(--success))" dot={false} name="p50 ms" />
                    <Line type="monotone" dataKey="p95" stroke="hsl(var(--warning))" dot={false} name="p95 ms" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline breakdown</CardTitle>
              </CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ticks} stackOffset="none">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip {...chartTooltip} />
                    <Area type="monotone" stackId="1" dataKey="asrMs" stroke="hsl(var(--info))" fill="hsl(var(--info) / 0.25)" name="STT ms" />
                    <Area type="monotone" stackId="1" dataKey="llmMs" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.25)" name="LLM ms" />
                    <Area type="monotone" stackId="1" dataKey="ttsMs" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.25)" name="TTS ms" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {!!ticks.length && !running && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Run summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Avg p50</p>
                  <p className="font-semibold">{avgP50} ms</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peak concurrency</p>
                  <p className="font-semibold">{Math.max(...ticks.map((x) => x.concurrent))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed calls</p>
                  <p className="font-semibold">{totalFailed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Scenario</p>
                  <p className="font-semibold">{scenario === "mixed" ? "Mixed" : scenario}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

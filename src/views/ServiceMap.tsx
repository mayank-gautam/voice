"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Mic,
  Brain,
  Wrench,
  Volume2,
  Network,
  Phone,
  Database,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  DollarSign,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

type ServiceKey = "twilio" | "router" | "stt" | "llm" | "tool" | "tts" | "db";

type ServiceNode = {
  key: ServiceKey;
  name: string;
  kind: string;
  icon: typeof Mic;
  x: number;
  y: number;
  status: "healthy" | "degraded" | "down";
  p50: number;
  p95: number;
  errorRate: number;
  throughput: number;
  cost?: number;
  provider?: string;
  version?: string;
  spark: { t: number; v: number }[];
};

type Edge = { from: ServiceKey; to: ServiceKey; calls: number; errRate: number };

const mkSpark = (base: number) =>
  Array.from({ length: 20 }, (_, i) => ({
    t: i,
    v: Math.max(1, base + Math.sin(i / 2) * base * 0.15 + (Math.random() - 0.5) * base * 0.2),
  }));

const services: ServiceNode[] = [
  {
    key: "twilio",
    name: "Twilio Ingress",
    kind: "Telephony",
    icon: Phone,
    x: 60,
    y: 180,
    status: "healthy",
    p50: 42,
    p95: 88,
    errorRate: 0.1,
    throughput: 1240,
    provider: "Twilio",
    version: "PSTN v2",
    spark: mkSpark(42),
  },
  {
    key: "router",
    name: "Session Router",
    kind: "Orchestrator",
    icon: Network,
    x: 260,
    y: 180,
    status: "healthy",
    p50: 18,
    p95: 46,
    errorRate: 0.2,
    throughput: 1240,
    version: "1.8.3",
    spark: mkSpark(18),
  },
  {
    key: "stt",
    name: "Speech-to-Text",
    kind: "STT",
    icon: Mic,
    x: 460,
    y: 60,
    status: "healthy",
    p50: 180,
    p95: 320,
    errorRate: 0.4,
    throughput: 1240,
    provider: "Deepgram",
    version: "nova-3",
    spark: mkSpark(180),
  },
  {
    key: "llm",
    name: "LLM Reasoning",
    kind: "LLM",
    icon: Brain,
    x: 460,
    y: 180,
    status: "degraded",
    p50: 980,
    p95: 1820,
    errorRate: 1.8,
    throughput: 1240,
    cost: 0.0021,
    provider: "Azure OpenAI",
    version: "gpt-4o-mini",
    spark: mkSpark(980),
  },
  {
    key: "tool",
    name: "Tool Calls",
    kind: "Function",
    icon: Wrench,
    x: 660,
    y: 60,
    status: "healthy",
    p50: 320,
    p95: 640,
    errorRate: 0.9,
    throughput: 820,
    version: "6 tools",
    spark: mkSpark(320),
  },
  {
    key: "db",
    name: "Customer DB",
    kind: "Database",
    icon: Database,
    x: 660,
    y: 300,
    status: "healthy",
    p50: 22,
    p95: 68,
    errorRate: 0.05,
    throughput: 3120,
    provider: "CosmosDB",
    spark: mkSpark(22),
  },
  {
    key: "tts",
    name: "Text-to-Speech",
    kind: "TTS",
    icon: Volume2,
    x: 660,
    y: 180,
    status: "healthy",
    p50: 210,
    p95: 410,
    errorRate: 0.3,
    throughput: 1240,
    provider: "ElevenLabs",
    version: "eleven-v3",
    spark: mkSpark(210),
  },
];

const edges: Edge[] = [
  { from: "twilio", to: "router", calls: 1240, errRate: 0.1 },
  { from: "router", to: "stt", calls: 1240, errRate: 0.3 },
  { from: "router", to: "llm", calls: 1240, errRate: 1.8 },
  { from: "llm", to: "tool", calls: 820, errRate: 0.9 },
  { from: "tool", to: "db", calls: 3120, errRate: 0.05 },
  { from: "router", to: "tts", calls: 1240, errRate: 0.3 },
];

// Mock trace lookup — matches ids used on Traces page
const knownTraces: Record<string, { callId: string; duration: number; spans: number; status: "ok" | "error" }> = {
  trace_8a92f1: { callId: "call_2384", duration: 1840, spans: 11, status: "ok" },
  trace_8a92f0: { callId: "call_2383", duration: 3210, spans: 17, status: "error" },
  trace_8a92ef: { callId: "call_2382", duration: 920, spans: 6, status: "ok" },
};

const statusColor = {
  healthy: "text-chart-success border-chart-success/40 bg-chart-success/10",
  degraded: "text-chart-warning border-chart-warning/40 bg-chart-warning/10",
  down: "text-destructive border-destructive/40 bg-destructive/10",
};

const statusDot = {
  healthy: "bg-chart-success",
  degraded: "bg-chart-warning",
  down: "bg-destructive",
};

const ServiceMap = () => {
  const [selected, setSelected] = useState<ServiceKey>("llm");
  const [query, setQuery] = useState("");
  const [traceHit, setTraceHit] = useState<{ id: string; data: typeof knownTraces[string] } | null>(null);

  const node = useMemo(() => services.find((s) => s.key === selected)!, [selected]);

  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    const hit = knownTraces[q];
    if (hit) {
      setTraceHit({ id: q, data: hit });
      toast.success(`Trace ${q} found`, { description: `${hit.spans} spans across services` });
    } else {
      setTraceHit(null);
      toast.error("Trace not found", { description: `Try trace_8a92f1, trace_8a92f0, or trace_8a92ef` });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Service Map</h1>
            <p className="text-muted-foreground">
              Visual topology of the voice pipeline. Click a service for details or search by trace ID.
            </p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search trace id (e.g. trace_8a92f1)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 font-mono text-xs"
              />
            </div>
            <Button onClick={handleSearch}>Find Trace</Button>
          </div>
        </div>

        {traceHit && (
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <div>
                  <div className="font-mono text-sm">{traceHit.id}</div>
                  <div className="text-xs text-muted-foreground">
                    Call {traceHit.data.callId} • {traceHit.data.spans} spans • {traceHit.data.duration}ms
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={traceHit.data.status === "ok" ? "secondary" : "destructive"}>
                  {traceHit.data.status}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => (window.location.href = "/traces")}>
                  Open in Traces
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Topology */}
          <Card className="bg-card/50 border-border/50 lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                Live Topology
              </CardTitle>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-chart-success" /> Healthy</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-chart-warning" /> Degraded</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Down</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-x-auto">
                <svg viewBox="0 0 780 380" className="w-full h-[420px]">
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" opacity="0.6" />
                    </marker>
                  </defs>

                  {edges.map((e, i) => {
                    const from = services.find((s) => s.key === e.from)!;
                    const to = services.find((s) => s.key === e.to)!;
                    const isHot = e.errRate > 1;
                    return (
                      <g key={i}>
                        <line
                          x1={from.x + 60}
                          y1={from.y}
                          x2={to.x - 60}
                          y2={to.y}
                          stroke={isHot ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
                          strokeWidth={isHot ? 2 : 1.5}
                          strokeOpacity={isHot ? 0.8 : 0.4}
                          strokeDasharray={isHot ? "0" : "4 4"}
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={(from.x + to.x) / 2 + 60}
                          y={(from.y + to.y) / 2 - 6}
                          fill="hsl(var(--muted-foreground))"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {e.calls}/m
                        </text>
                      </g>
                    );
                  })}

                  {services.map((s) => {
                    const Icon = s.icon;
                    const isSel = selected === s.key;
                    return (
                      <g
                        key={s.key}
                        transform={`translate(${s.x - 60}, ${s.y - 34})`}
                        onClick={() => setSelected(s.key)}
                        className="cursor-pointer"
                      >
                        <rect
                          width="120"
                          height="68"
                          rx="10"
                          fill="hsl(var(--card))"
                          stroke={isSel ? "hsl(var(--primary))" : "hsl(var(--border))"}
                          strokeWidth={isSel ? 2 : 1}
                        />
                        <circle cx="16" cy="16" r="4" className={statusDot[s.status]} fill="currentColor" />
                        <foreignObject x="8" y="26" width="104" height="36">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold truncate">{s.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                p50 {s.p50}ms • {s.errorRate}%
                              </div>
                            </div>
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click any service node to inspect. Red edges indicate elevated error rates.
              </p>
            </CardContent>
          </Card>

          {/* Details */}
          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <node.icon className="w-4 h-4 text-primary" />
                  {node.name}
                </CardTitle>
                <Badge variant="outline" className={cn("capitalize", statusColor[node.status])}>
                  {node.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {node.kind} {node.provider ? `• ${node.provider}` : ""} {node.version ? `• ${node.version}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" /> p50 latency
                  </div>
                  <div className="text-lg font-semibold mt-1">{node.p50}ms</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Clock className="w-3 h-3" /> p95 latency
                  </div>
                  <div className="text-lg font-semibold mt-1">{node.p95}ms</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Throughput
                  </div>
                  <div className="text-lg font-semibold mt-1">{node.throughput}/min</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    {node.status === "healthy" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}{" "}
                    Error rate
                  </div>
                  <div
                    className={cn(
                      "text-lg font-semibold mt-1",
                      node.errorRate > 1 ? "text-chart-warning" : "text-chart-success"
                    )}
                  >
                    {node.errorRate}%
                  </div>
                </div>
              </div>

              {node.cost !== undefined && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <DollarSign className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">Avg cost / request</span>
                  </div>
                  <span className="font-mono text-sm">${node.cost.toFixed(4)}</span>
                </div>
              )}

              <div>
                <div className="text-xs text-muted-foreground mb-2">Latency last 20 min</div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={node.spark}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="t" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          fontSize: 11,
                        }}
                      />
                      <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => (window.location.href = "/traces")}>
                  View Traces
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => (window.location.href = "/logs")}>
                  View Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service list */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium">All Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {services.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelected(s.key)}
                    className={cn(
                      "text-left p-3 rounded-lg border transition-colors",
                      selected === s.key
                        ? "bg-primary/10 border-primary/40"
                        : "bg-muted/20 border-border/50 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{s.name}</span>
                      </div>
                      <span className={cn("w-2 h-2 rounded-full", statusDot[s.status])} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>p95 {s.p95}ms</span>
                      <span>•</span>
                      <span>{s.errorRate}% err</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ServiceMap;

"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { LineChart as LineIcon, Save, Plus, LayoutDashboard, Trash2 } from "lucide-react";
import { toast } from "sonner";

const METRICS = [
  "llm.latency.ms", "stt.latency.ms", "tts.latency.ms",
  "llm.tokens.in", "llm.tokens.out", "calls.total",
  "stt.error_rate", "tts.mos", "cost.usd", "eval.hallucination",
];
const AGGS = ["avg", "p50", "p90", "p95", "p99", "sum", "count"];
const GROUPS = ["none", "model", "tenant", "region", "intent"];

const seed = (n: number, base: number, jitter: number) =>
  Array.from({ length: n }, (_, i) => ({
    t: `${String(i).padStart(2, "0")}:00`,
    p50: Math.round(base + Math.sin(i / 3) * jitter + Math.random() * jitter * 0.4),
    p95: Math.round(base * 1.6 + Math.cos(i / 4) * jitter * 1.5 + Math.random() * jitter * 0.6),
    p99: Math.round(base * 2.1 + Math.sin(i / 2) * jitter * 1.8 + Math.random() * jitter * 0.7),
  }));

const savedWidgets = [
  { id: "w1", title: "LLM latency p95 by model", metric: "llm.latency.ms", agg: "p95" },
  { id: "w2", title: "Calls / minute", metric: "calls.total", agg: "sum" },
  { id: "w3", title: "Cost burn (USD/hr)", metric: "cost.usd", agg: "sum" },
  { id: "w4", title: "STT error rate", metric: "stt.error_rate", agg: "avg" },
];

const groupSeries = [
  { t: "00:00", "gpt-4o-mini": 612, "claude-3.5": 845, "llama-3-70b": 720 },
  { t: "04:00", "gpt-4o-mini": 640, "claude-3.5": 812, "llama-3-70b": 740 },
  { t: "08:00", "gpt-4o-mini": 702, "claude-3.5": 880, "llama-3-70b": 768 },
  { t: "12:00", "gpt-4o-mini": 690, "claude-3.5": 905, "llama-3-70b": 802 },
  { t: "16:00", "gpt-4o-mini": 658, "claude-3.5": 870, "llama-3-70b": 781 },
  { t: "20:00", "gpt-4o-mini": 622, "claude-3.5": 832, "llama-3-70b": 745 },
];

const MetricExplorer = () => {
  const [metric, setMetric] = useState("llm.latency.ms");
  const [agg, setAgg] = useState("p95");
  const [group, setGroup] = useState("model");
  const [range, setRange] = useState("24h");
  const [viz, setViz] = useState<"line" | "area" | "bar">("line");

  const data = useMemo(() => seed(24, 600, 120), [metric, agg, range]);

  const widgets = savedWidgets;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Metric Explorer & Dashboards</h1>
            <p className="text-muted-foreground">Ad-hoc queries with percentiles & group-by · save widgets to custom dashboards</p>
          </div>
        </div>

        <Tabs defaultValue="explorer">
          <TabsList>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
            <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          </TabsList>

          <TabsContent value="explorer" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-base">Query</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label>Metric</Label>
                    <Select value={metric} onValueChange={setMetric}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Aggregation</Label>
                    <Select value={agg} onValueChange={setAgg}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGGS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Group by</Label>
                    <Select value={group} onValueChange={setGroup}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{GROUPS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Range</Label>
                    <Select value={range} onValueChange={setRange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["1h", "6h", "24h", "7d", "30d"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Filter (PromQL-like)</Label>
                    <Input placeholder='{tenant="acme",region="us-east"}' />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="flex gap-2">
                    {(["line", "area", "bar"] as const).map((v) => (
                      <Button key={v} size="sm" variant={viz === v ? "default" : "outline"} onClick={() => setViz(v)}>
                        {v}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => toast.success("Widget saved to dashboard")}>
                    <Save className="w-4 h-4 mr-2" />Save to dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LineIcon className="w-4 h-4" />
                  <span className="font-mono text-xs">{agg}({metric}) by {group}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  {group !== "none" ? (
                    <LineChart data={groupSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="gpt-4o-mini" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="claude-3.5" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="llama-3-70b" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : viz === "area" ? (
                    <AreaChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Area type="monotone" dataKey="p50" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.25)" />
                      <Area type="monotone" dataKey="p95" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.25)" />
                      <Area type="monotone" dataKey="p99" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3) / 0.25)" />
                    </AreaChart>
                  ) : viz === "bar" ? (
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="p95" fill="hsl(var(--chart-2))" />
                    </BarChart>
                  ) : (
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="p50" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p95" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p99" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboards" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge variant="default"><LayoutDashboard className="w-3 h-3 mr-1" />Voice Ops</Badge>
                <Badge variant="outline">Cost & Usage</Badge>
                <Badge variant="outline">ML Quality</Badge>
              </div>
              <Button variant="outline"><Plus className="w-4 h-4 mr-2" />New dashboard</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {widgets.map((w) => (
                <Card key={w.id} className="bg-card/50 border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">{w.title}</CardTitle>
                    <Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={seed(20, 500, 90)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="p95" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.25)" />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-muted-foreground font-mono mt-2">{w.agg}({w.metric})</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MetricExplorer;

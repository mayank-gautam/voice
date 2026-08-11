"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Database, Plus, Play, Download, CheckCircle2, XCircle, GitCompare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const datasets = [
  { id: "ds-001", name: "Banking intents v3", items: 482, created: "2026-06-10", lastRun: "2h ago", owner: "qa-team" },
  { id: "ds-002", name: "Hallucination probes", items: 128, created: "2026-05-22", lastRun: "1d ago", owner: "ml-eval" },
  { id: "ds-003", name: "Edge accents (golden)", items: 96, created: "2026-04-18", lastRun: "5d ago", owner: "voice" },
  { id: "ds-004", name: "PII redaction tests", items: 64, created: "2026-03-30", lastRun: "12d ago", owner: "security" },
];

const experiments = [
  { id: "exp-118", dataset: "Banking intents v3", model: "gpt-4o-mini", prompt: "v12", accuracy: 0.942, hallucination: 0.018, latency: 612, cost: 1.42, status: "completed" },
  { id: "exp-117", dataset: "Banking intents v3", model: "claude-3.5-sonnet", prompt: "v12", accuracy: 0.951, hallucination: 0.012, latency: 845, cost: 3.18, status: "completed" },
  { id: "exp-116", dataset: "Banking intents v3", model: "gpt-4o-mini", prompt: "v11", accuracy: 0.918, hallucination: 0.029, latency: 598, cost: 1.38, status: "completed" },
  { id: "exp-115", dataset: "Hallucination probes", model: "gpt-4o", prompt: "v8", accuracy: 0.889, hallucination: 0.041, latency: 1102, cost: 4.22, status: "completed" },
  { id: "exp-114", dataset: "Edge accents (golden)", model: "whisper-large-v3", prompt: "—", accuracy: 0.962, hallucination: 0, latency: 412, cost: 0.84, status: "running" },
];

const compareData = [
  { metric: "Accuracy", a: 94.2, b: 95.1 },
  { metric: "Relevance", a: 91.0, b: 93.4 },
  { metric: "Faithfulness", a: 96.0, b: 97.2 },
  { metric: "Latency (norm)", a: 72, b: 58 },
  { metric: "Cost (norm)", a: 88, b: 64 },
];

const Datasets = () => {
  const [tab, setTab] = useState("datasets");
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Datasets & Experiments</h1>
            <p className="text-muted-foreground">Offline evaluation suites, golden sets, and head-to-head model/prompt experiments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" />New experiment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Run new experiment</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input placeholder="Experiment name" />
                  <Input placeholder="Dataset id (e.g. ds-001)" />
                  <Input placeholder="Model (gpt-4o-mini, claude-3.5-sonnet…)" />
                  <Input placeholder="Prompt version (v12)" />
                  <Button className="w-full"><Play className="w-4 h-4 mr-2" />Queue run</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Datasets", value: "12", icon: Database },
            { label: "Total items", value: "3,842", icon: CheckCircle2 },
            { label: "Experiments (30d)", value: "118", icon: Play },
            { label: "Regressions caught", value: "7", icon: XCircle },
          ].map((s) => (
            <Card key={s.label} className="bg-card/50 border-border/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10"><s.icon className="w-6 h-6 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="datasets">Datasets</TabsTrigger>
            <TabsTrigger value="experiments">Experiments</TabsTrigger>
            <TabsTrigger value="compare">Compare runs</TabsTrigger>
          </TabsList>

          <TabsContent value="datasets" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-base">Golden datasets</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Items</TableHead><TableHead>Owner</TableHead>
                      <TableHead>Created</TableHead><TableHead>Last run</TableHead><TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasets.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{d.items}</TableCell>
                        <TableCell><Badge variant="outline">{d.owner}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{d.created}</TableCell>
                        <TableCell className="text-muted-foreground">{d.lastRun}</TableCell>
                        <TableCell><Button size="sm" variant="ghost"><Play className="w-4 h-4 mr-1" />Run</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="experiments" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-base">Recent experiment runs</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead><TableHead>Dataset</TableHead><TableHead>Model</TableHead>
                      <TableHead>Prompt</TableHead><TableHead>Accuracy</TableHead><TableHead>Halluc.</TableHead>
                      <TableHead>p95 ms</TableHead><TableHead>Cost $</TableHead><TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {experiments.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.id}</TableCell>
                        <TableCell>{e.dataset}</TableCell>
                        <TableCell><Badge variant="outline">{e.model}</Badge></TableCell>
                        <TableCell>{e.prompt}</TableCell>
                        <TableCell className="text-chart-success">{(e.accuracy * 100).toFixed(1)}%</TableCell>
                        <TableCell className={e.hallucination > 0.025 ? "text-chart-warning" : ""}>{(e.hallucination * 100).toFixed(1)}%</TableCell>
                        <TableCell>{e.latency}</TableCell>
                        <TableCell>${e.cost.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={e.status === "running" ? "secondary" : "default"}>{e.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitCompare className="w-4 h-4" /> exp-116 (gpt-4o-mini v11) vs exp-117 (claude-3.5 v12)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={compareData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                    <Bar dataKey="a" name="exp-116" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="b" name="exp-117" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Datasets;

"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, Plus, AlertTriangle, Clock, Calendar, ShieldOff } from "lucide-react";

const rules = [
  { id: "r-01", name: "p95 LLM latency > 2s", metric: "llm.latency.p95", op: ">", threshold: "2000ms", window: "5m", severity: "high", channel: "PagerDuty · #voice-oncall", enabled: true, triggered: 3 },
  { id: "r-02", name: "STT error rate > 3%", metric: "stt.error_rate", op: ">", threshold: "3%", window: "10m", severity: "critical", channel: "Slack · #incidents", enabled: true, triggered: 1 },
  { id: "r-03", name: "Cost burn 2× forecast", metric: "cost.burn_ratio", op: ">", threshold: "2.0", window: "1h", severity: "medium", channel: "Email · finops@", enabled: true, triggered: 0 },
  { id: "r-04", name: "Hallucination score spike", metric: "eval.hallucination.p90", op: ">", threshold: "0.05", window: "30m", severity: "high", channel: "Slack · #ml-quality", enabled: false, triggered: 0 },
  { id: "r-05", name: "TTS MOS < 3.8", metric: "tts.mos", op: "<", threshold: "3.8", window: "15m", severity: "medium", channel: "Slack · #voice", enabled: true, triggered: 2 },
];

const incidents = [
  { id: "INC-2041", title: "LLM gateway p95 spike (us-east)", severity: "critical", status: "investigating", opened: "12m ago", owner: "alex.k", rule: "p95 LLM latency > 2s" },
  { id: "INC-2040", title: "STT errors on accent-EN-IN cohort", severity: "high", status: "mitigated", opened: "2h ago", owner: "priya.s", rule: "STT error rate > 3%" },
  { id: "INC-2039", title: "Cost burn 2.4× forecast", severity: "medium", status: "resolved", opened: "1d ago", owner: "finops", rule: "Cost burn 2× forecast" },
];

const schedule = [
  { day: "Mon", primary: "alex.k", secondary: "priya.s" },
  { day: "Tue", primary: "priya.s", secondary: "jordan.m" },
  { day: "Wed", primary: "jordan.m", secondary: "alex.k" },
  { day: "Thu", primary: "alex.k", secondary: "priya.s" },
  { day: "Fri", primary: "priya.s", secondary: "jordan.m" },
  { day: "Sat", primary: "jordan.m", secondary: "alex.k" },
  { day: "Sun", primary: "alex.k", secondary: "priya.s" },
];

const sevColor = (s: string) =>
  s === "critical" ? "destructive" : s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

const AlertRules = () => {
  const [open, setOpen] = useState(false);
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Alert Rules & Incidents</h1>
            <p className="text-muted-foreground">Define metric thresholds, manage on-call, and track incident lifecycle</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create alert rule</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1"><Label>Name</Label><Input placeholder="e.g. TTS MOS below floor" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Metric</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select metric" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llm.latency.p95">llm.latency.p95</SelectItem>
                        <SelectItem value="stt.error_rate">stt.error_rate</SelectItem>
                        <SelectItem value="tts.mos">tts.mos</SelectItem>
                        <SelectItem value="cost.burn_ratio">cost.burn_ratio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Operator</Label>
                    <Select><SelectTrigger><SelectValue placeholder=">" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                        <SelectItem value="=">=</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Threshold</Label><Input placeholder="2000" /></div>
                  <div className="space-y-1"><Label>Window</Label><Input placeholder="5m" /></div>
                </div>
                <div className="space-y-1"><Label>Notify channel</Label><Input placeholder="Slack #incidents / PagerDuty" /></div>
                <Button className="w-full" onClick={() => setOpen(false)}>Create rule</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Active rules", value: "23", icon: Bell },
            { label: "Open incidents", value: "2", icon: AlertTriangle },
            { label: "Mean time to ack", value: "3m 12s", icon: Clock },
            { label: "Suppressions", value: "1", icon: ShieldOff },
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

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="oncall">On-call</TabsTrigger>
            <TabsTrigger value="suppress">Suppression</TabsTrigger>
          </TabsList>

          <TabsContent value="rules">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Condition</TableHead><TableHead>Window</TableHead>
                      <TableHead>Severity</TableHead><TableHead>Channel</TableHead>
                      <TableHead>Triggered (24h)</TableHead><TableHead>Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.metric} {r.op} {r.threshold}</TableCell>
                        <TableCell>{r.window}</TableCell>
                        <TableCell><Badge variant={sevColor(r.severity) as any}>{r.severity}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.channel}</TableCell>
                        <TableCell>{r.triggered}</TableCell>
                        <TableCell><Switch defaultChecked={r.enabled} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incidents">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6 space-y-3">
                {incidents.map((i) => (
                  <div key={i.id} className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{i.id}</span>
                        <Badge variant={sevColor(i.severity) as any}>{i.severity}</Badge>
                        <Badge variant="outline">{i.status}</Badge>
                      </div>
                      <div className="font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">Opened {i.opened} · owner {i.owner} · rule “{i.rule}”</div>
                    </div>
                    <Button variant="outline" size="sm">View timeline</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oncall">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" />Weekly rotation</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Primary</TableHead><TableHead>Secondary</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {schedule.map((d) => (
                      <TableRow key={d.day}>
                        <TableCell className="font-medium">{d.day}</TableCell>
                        <TableCell><Badge variant="default">{d.primary}</Badge></TableCell>
                        <TableCell><Badge variant="outline">{d.secondary}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppress">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-base">Maintenance windows</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/50 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">LLM gateway upgrade</div>
                    <div className="text-xs text-muted-foreground">Sat 26 Jun · 02:00 – 04:00 UTC · suppresses 6 rules</div>
                  </div>
                  <Badge variant="secondary">scheduled</Badge>
                </div>
                <Button variant="outline" className="w-full"><Plus className="w-4 h-4 mr-2" />Add maintenance window</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AlertRules;

"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { ThumbsUp, ThumbsDown, Sparkles, Shield, Target, Brain, Plus } from "lucide-react";

const scorers = [
  { name: "Hallucination", icon: Sparkles, pass: 92, fail: 8, color: "hsl(var(--chart-1))" },
  { name: "Toxicity", icon: Shield, pass: 99, fail: 1, color: "hsl(var(--chart-2))" },
  { name: "Relevance", icon: Target, pass: 87, fail: 13, color: "hsl(var(--chart-3))" },
  { name: "Task Success", icon: Brain, pass: 84, fail: 16, color: "hsl(var(--chart-4))" },
];

const trend = Array.from({ length: 14 }).map((_, i) => ({
  day: `D${i + 1}`,
  hallucination: 88 + Math.round(Math.random() * 8),
  relevance: 82 + Math.round(Math.random() * 10),
  taskSuccess: 80 + Math.round(Math.random() * 10),
}));

const reviewQueue = [
  { id: "eval_881", trace: "trace_8a92f1", scorer: "Task Success", score: 0.2, reviewer: "—", status: "pending" },
  { id: "eval_880", trace: "trace_8a92f0", scorer: "Hallucination", score: 0.1, reviewer: "alex", status: "reviewed" },
  { id: "eval_879", trace: "trace_8a92ee", scorer: "Relevance", score: 0.6, reviewer: "—", status: "pending" },
  { id: "eval_878", trace: "trace_8a92ed", scorer: "Toxicity", score: 0.0, reviewer: "sam", status: "reviewed" },
];

const feedback = { up: 1842, down: 187 };

const Evaluations = () => {
  const total = feedback.up + feedback.down;
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Evaluations</h1>
            <p className="text-muted-foreground">Automated scorers, human feedback and reviewer queue</p>
          </div>
          <Button><Plus className="w-4 h-4 mr-2" />New evaluator</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {scorers.map((s) => (
            <Card key={s.name} className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10"><s.icon className="w-4 h-4 text-primary" /></div>
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{s.pass}%</span>
                  <span className="text-xs text-muted-foreground">pass rate</span>
                </div>
                <Progress value={s.pass} className="mt-2 h-1.5" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader><CardTitle className="text-base font-medium">Score trend (14 days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[60, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="hallucination" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="relevance" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="taskSuccess" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="text-base font-medium">Human feedback</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-around py-4">
                <div className="text-center">
                  <ThumbsUp className="w-8 h-8 text-chart-success mx-auto" />
                  <p className="text-2xl font-bold mt-2">{feedback.up}</p>
                  <p className="text-xs text-muted-foreground">{((feedback.up / total) * 100).toFixed(1)}%</p>
                </div>
                <div className="text-center">
                  <ThumbsDown className="w-8 h-8 text-destructive mx-auto" />
                  <p className="text-2xl font-bold mt-2">{feedback.down}</p>
                  <p className="text-xs text-muted-foreground">{((feedback.down / total) * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">CSAT proxy: {((feedback.up / total) * 100).toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Reviewer queue</CardTitle>
            <Badge variant="outline">{reviewQueue.filter((r) => r.status === "pending").length} pending</Badge>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="text-left py-2">Eval</th>
                  <th className="text-left">Trace</th>
                  <th className="text-left">Scorer</th>
                  <th className="text-left">Score</th>
                  <th className="text-left">Reviewer</th>
                  <th className="text-left">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map((r) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-2 font-mono text-xs">{r.id}</td>
                    <td className="font-mono text-xs">{r.trace}</td>
                    <td>{r.scorer}</td>
                    <td>
                      <Badge variant={r.score < 0.5 ? "destructive" : "secondary"}>{r.score.toFixed(2)}</Badge>
                    </td>
                    <td className="text-muted-foreground">{r.reviewer}</td>
                    <td>
                      <Badge variant={r.status === "pending" ? "outline" : "secondary"}>{r.status}</Badge>
                    </td>
                    <td><Button size="sm" variant="ghost">Review</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Evaluations;

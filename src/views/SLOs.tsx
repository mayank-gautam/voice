"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Target, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const slos = [
  { id: 1, name: "Voice latency < 800ms", target: 95, current: 96.4, budgetUsed: 38, burn: 0.7, status: "healthy" },
  { id: 2, name: "Call success rate > 99%", target: 99, current: 98.6, budgetUsed: 78, burn: 2.4, status: "warning" },
  { id: 3, name: "LLM error rate < 1%", target: 99, current: 99.4, budgetUsed: 22, burn: 0.3, status: "healthy" },
  { id: 4, name: "STT confidence > 90%", target: 95, current: 91.2, budgetUsed: 102, burn: 4.1, status: "breached" },
];

const burnTrend = Array.from({ length: 24 }).map((_, i) => ({
  hour: `${i}:00`,
  budget: Math.max(0, 100 - i * 1.5 - Math.random() * 5),
}));

const statusStyle = {
  healthy: "text-chart-success border-chart-success/30",
  warning: "text-chart-warning border-chart-warning/30",
  breached: "text-destructive border-destructive/30",
} as const;

const SLOs = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">SLOs & Error Budgets</h1>
            <p className="text-muted-foreground">Reliability objectives, burn rate and budget remaining</p>
          </div>
          <Button><Plus className="w-4 h-4 mr-2" />New SLO</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slos.map((s) => (
            <Card key={s.id} className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{s.name}</span>
                  </div>
                  <Badge variant="outline" className={cn(statusStyle[s.status as keyof typeof statusStyle])}>
                    {s.status === "breached" && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {s.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Target</p>
                    <p className="text-base font-bold">{s.target}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="text-base font-bold">{s.current}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Burn rate</p>
                    <p className={cn("text-base font-bold", s.burn > 2 ? "text-destructive" : "text-foreground")}>{s.burn}x</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Error budget used</span>
                    <span className={cn(s.budgetUsed > 100 ? "text-destructive" : s.budgetUsed > 75 ? "text-chart-warning" : "text-muted-foreground")}>
                      {s.budgetUsed}%
                    </span>
                  </div>
                  <Progress value={Math.min(s.budgetUsed, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-base font-medium">Error budget remaining (24h)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={burnTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="budget" stroke="hsl(var(--chart-warning))" fill="hsl(var(--chart-warning))" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SLOs;

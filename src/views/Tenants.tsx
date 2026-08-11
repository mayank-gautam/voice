"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, Search, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

const tenants = [
  { id: "acme", name: "Acme Corp", calls: 8421, cost: 412.3, errorRate: 0.8, topIntent: "check_balance", plan: "Enterprise" },
  { id: "globex", name: "Globex Inc", calls: 5210, cost: 289.1, errorRate: 1.2, topIntent: "transfer_funds", plan: "Pro" },
  { id: "initech", name: "Initech", calls: 3104, cost: 142.7, errorRate: 0.5, topIntent: "account_info", plan: "Pro" },
  { id: "umbrella", name: "Umbrella LLC", calls: 1842, cost: 88.4, errorRate: 2.4, topIntent: "report_issue", plan: "Starter" },
  { id: "wayne", name: "Wayne Enterprises", calls: 920, cost: 41.2, errorRate: 0.3, topIntent: "speak_to_agent", plan: "Starter" },
];

const topUsersByCost = tenants.map((t) => ({ name: t.name, cost: t.cost }));

const Tenants = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Users & Tenants</h1>
          <p className="text-muted-foreground">Per-tenant usage, cost attribution and quality drill-down</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10"><Users className="w-6 h-6 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active tenants</p>
                <p className="text-2xl font-bold">42</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-chart-success/10"><TrendingUp className="w-6 h-6 text-chart-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Calls today</p>
                <p className="text-2xl font-bold">19.5k</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-chart-warning/10"><DollarSign className="w-6 h-6 text-chart-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Cost today</p>
                <p className="text-2xl font-bold">$973</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10"><AlertCircle className="w-6 h-6 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Tenants over budget</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader><CardTitle className="text-base font-medium">Top tenants by cost</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topUsersByCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="cost" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">All tenants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search tenants..." className="pl-9 h-8" />
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="text-left py-2">Tenant</th>
                  <th className="text-left">Plan</th>
                  <th className="text-right">Calls</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Error rate</th>
                  <th className="text-left">Top intent</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 font-medium">{t.name}</td>
                    <td><Badge variant="outline">{t.plan}</Badge></td>
                    <td className="text-right font-mono">{t.calls.toLocaleString()}</td>
                    <td className="text-right font-mono">${t.cost.toFixed(2)}</td>
                    <td className="text-right">
                      <Badge variant={t.errorRate > 2 ? "destructive" : "secondary"}>{t.errorRate}%</Badge>
                    </td>
                    <td className="text-muted-foreground">{t.topIntent}</td>
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

export default Tenants;

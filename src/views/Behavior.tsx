"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Target, AlertCircle, CheckCircle, TrendingUp, MessageSquare, RotateCcw, ThumbsDown, Zap } from "lucide-react";

const intentData = [
  { intent: "Check Balance", count: 1250, accuracy: 94 },
  { intent: "Make Payment", count: 890, accuracy: 91 },
  { intent: "Transfer Funds", count: 720, accuracy: 88 },
  { intent: "Account Info", count: 650, accuracy: 96 },
  { intent: "Report Issue", count: 480, accuracy: 82 },
  { intent: "Speak to Agent", count: 320, accuracy: 99 },
];

const failedIntents = [
  { intent: "Unknown", count: 245 },
  { intent: "Ambiguous Request", count: 180 },
  { intent: "Multiple Intents", count: 120 },
  { intent: "Incomplete Query", count: 95 },
  { intent: "Technical Jargon", count: 60 },
];

const taskCompletionData = [
  { day: "Mon", completed: 85, abandoned: 15 },
  { day: "Tue", completed: 88, abandoned: 12 },
  { day: "Wed", completed: 82, abandoned: 18 },
  { day: "Thu", completed: 90, abandoned: 10 },
  { day: "Fri", completed: 87, abandoned: 13 },
  { day: "Sat", completed: 78, abandoned: 22 },
  { day: "Sun", completed: 75, abandoned: 25 },
];

const repairAttempts = [
  { hour: "00:00", attempts: 12 },
  { hour: "04:00", attempts: 8 },
  { hour: "08:00", attempts: 45 },
  { hour: "12:00", attempts: 52 },
  { hour: "16:00", attempts: 48 },
  { hour: "20:00", attempts: 28 },
];

const frustrationIndicators = [
  { name: "Repeated Questions", value: 35, color: "hsl(var(--chart-warning))" },
  { name: "Raised Voice", value: 25, color: "hsl(var(--chart-error))" },
  { name: "Negative Sentiment", value: 20, color: "hsl(var(--chart-4))" },
  { name: "Escalation Request", value: 20, color: "hsl(var(--chart-5))" },
];

const deadEndLoops = [
  { id: 1, pattern: "Intent → Clarify → Intent → Clarify", occurrences: 45, avgDuration: "2m 30s" },
  { id: 2, pattern: "Auth → Fail → Auth → Fail → Escalate", occurrences: 32, avgDuration: "3m 15s" },
  { id: 3, pattern: "Unknown → Rephrase → Unknown → Agent", occurrences: 28, avgDuration: "1m 45s" },
  { id: 4, pattern: "Menu → Back → Menu → Back → Exit", occurrences: 21, avgDuration: "2m 00s" },
];

const Behavior = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Behavioral & Intelligence Metrics</h1>
          <p className="text-muted-foreground">Intent detection accuracy, task completion, and user behavior analysis</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-success/10">
                  <Target className="w-6 h-6 text-chart-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Intent Accuracy</p>
                  <p className="text-2xl font-bold">91.2%</p>
                  <p className="text-xs text-chart-success">+2.3% from last week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <CheckCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Task Completion</p>
                  <p className="text-2xl font-bold">84.5%</p>
                  <p className="text-xs text-muted-foreground">Target: 85%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-warning/10">
                  <RotateCcw className="w-6 h-6 text-chart-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Repair Attempts</p>
                  <p className="text-2xl font-bold">193</p>
                  <p className="text-xs text-chart-warning">+15% today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-error/10">
                  <ThumbsDown className="w-6 h-6 text-chart-error" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Frustration Events</p>
                  <p className="text-2xl font-bold">47</p>
                  <p className="text-xs text-chart-success">-8% from yesterday</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Intent Detection Accuracy */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Intent Detection Accuracy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={intentData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="intent" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="accuracy" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Failed Intents */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-chart-error" />
                Top Failed Intents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={failedIntents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="intent" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--chart-error))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Completion Rate */}
          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-chart-success" />
                Task Completion Rate by Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={taskCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--chart-success))" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="abandoned" name="Abandoned" fill="hsl(var(--chart-error))" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Frustration Indicators */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <ThumbsDown className="w-4 h-4 text-chart-warning" />
                Frustration Indicators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={frustrationIndicators}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {frustrationIndicators.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {frustrationIndicators.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Repair Attempts Over Time */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-chart-warning" />
                Repair Attempts ("Sorry, can you repeat?")
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={repairAttempts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="attempts" 
                    stroke="hsl(var(--chart-warning))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-warning))', strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dead-End Loops */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-chart-error" />
                Dead-End Loop Detection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deadEndLoops.map((loop) => (
                  <div key={loop.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-foreground truncate">{loop.pattern}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {loop.occurrences} occurrences
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Avg: {loop.avgDuration}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-chart-error border-chart-error/30">
                        Loop
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Behavior;

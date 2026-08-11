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
import { Shield, AlertTriangle, Eye, Lock, UserX, FileWarning, Activity, Users } from "lucide-react";

const piiDetectionData = [
  { day: "Mon", ssn: 12, creditCard: 8, phone: 25, email: 45 },
  { day: "Tue", ssn: 15, creditCard: 10, phone: 28, email: 52 },
  { day: "Wed", ssn: 8, creditCard: 5, phone: 22, email: 38 },
  { day: "Thu", ssn: 18, creditCard: 12, phone: 30, email: 48 },
  { day: "Fri", ssn: 14, creditCard: 9, phone: 26, email: 42 },
  { day: "Sat", ssn: 6, creditCard: 3, phone: 15, email: 25 },
  { day: "Sun", ssn: 4, creditCard: 2, phone: 12, email: 20 },
];

const authFailures = [
  { time: "00:00", failures: 5 },
  { time: "04:00", failures: 3 },
  { time: "08:00", failures: 18 },
  { time: "12:00", failures: 25 },
  { time: "16:00", failures: 22 },
  { time: "20:00", failures: 12 },
];

const riskPatterns = [
  { name: "Brute Force Attempt", value: 15, color: "hsl(var(--chart-error))" },
  { name: "Unusual Location", value: 25, color: "hsl(var(--chart-warning))" },
  { name: "After Hours Access", value: 30, color: "hsl(var(--chart-4))" },
  { name: "Multiple Failures", value: 20, color: "hsl(var(--chart-5))" },
  { name: "Suspicious Query", value: 10, color: "hsl(var(--primary))" },
];

const roleActivityData = [
  { role: "Admin", actions: 145, users: 3 },
  { role: "Supervisor", actions: 320, users: 12 },
  { role: "Agent", actions: 1250, users: 45 },
  { role: "Viewer", actions: 85, users: 8 },
  { role: "API Service", actions: 4500, users: 5 },
];

const securityEvents = [
  { id: 1, type: "PII Detected", severity: "warning", message: "SSN pattern detected in call transcript", time: "2 min ago", callId: "CALL-1234" },
  { id: 2, type: "Auth Failure", severity: "error", message: "Multiple failed authentication attempts from IP 192.168.1.45", time: "5 min ago", callId: null },
  { id: 3, type: "Masking Applied", severity: "info", message: "Credit card number masked in recording", time: "8 min ago", callId: "CALL-1231" },
  { id: 4, type: "Unusual Pattern", severity: "warning", message: "High volume API requests detected", time: "12 min ago", callId: null },
  { id: 5, type: "Access Granted", severity: "info", message: "New admin user provisioned: john.doe@company.com", time: "25 min ago", callId: null },
  { id: 6, type: "Policy Violation", severity: "error", message: "Attempted access to restricted data segment", time: "32 min ago", callId: "CALL-1228" },
];

const Security = () => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "text-chart-error border-chart-error/30 bg-chart-error/10";
      case "warning": return "text-chart-warning border-chart-warning/30 bg-chart-warning/10";
      default: return "text-primary border-primary/30 bg-primary/10";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Security & Governance</h1>
          <p className="text-muted-foreground">PII detection, authentication monitoring, and compliance tracking</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-warning/10">
                  <Eye className="w-6 h-6 text-chart-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PII Detected Today</p>
                  <p className="text-2xl font-bold">127</p>
                  <p className="text-xs text-chart-success">All masked successfully</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-error/10">
                  <UserX className="w-6 h-6 text-chart-error" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Auth Failures</p>
                  <p className="text-2xl font-bold">85</p>
                  <p className="text-xs text-chart-error">+12% from yesterday</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Masking Rate</p>
                  <p className="text-2xl font-bold">99.8%</p>
                  <p className="text-xs text-muted-foreground">3 anomalies detected</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-chart-success/10">
                  <Lock className="w-6 h-6 text-chart-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Compliance Score</p>
                  <p className="text-2xl font-bold">98.5%</p>
                  <p className="text-xs text-chart-success">HIPAA, PCI-DSS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PII Detection Events */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Eye className="w-4 h-4 text-chart-warning" />
                PII Detection by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={piiDetectionData}>
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
                  <Bar dataKey="ssn" name="SSN" fill="hsl(var(--chart-error))" stackId="a" />
                  <Bar dataKey="creditCard" name="Credit Card" fill="hsl(var(--chart-warning))" stackId="a" />
                  <Bar dataKey="phone" name="Phone" fill="hsl(var(--primary))" stackId="a" />
                  <Bar dataKey="email" name="Email" fill="hsl(var(--chart-success))" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Authentication Failures */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <UserX className="w-4 h-4 text-chart-error" />
                Authentication Failures Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={authFailures}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                    dataKey="failures" 
                    stroke="hsl(var(--chart-error))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-error))', strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* High-Risk Pattern Detection */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-chart-warning" />
                High-Risk Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={riskPatterns}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {riskPatterns.map((entry, index) => (
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
              <div className="grid grid-cols-1 gap-1 mt-2">
                {riskPatterns.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Role-Based Activity */}
          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Role-Based Usage Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {roleActivityData.map((role, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium">{role.role}</div>
                    <div className="flex-1">
                      <div className="h-6 bg-muted/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
                          style={{ width: `${(role.actions / 4500) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-sm font-medium">{role.actions.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{role.users} users</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Events Log */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Security Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {securityEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className={`p-2 rounded-lg ${getSeverityColor(event.severity)}`}>
                    {event.severity === "error" ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : event.severity === "warning" ? (
                      <FileWarning className="w-4 h-4" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getSeverityColor(event.severity)}>
                        {event.type}
                      </Badge>
                      {event.callId && (
                        <span className="text-xs text-muted-foreground font-mono">{event.callId}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1">{event.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Security;

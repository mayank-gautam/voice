"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Plus,
  Settings,
} from "lucide-react";
import { alerts } from "@/lib/mockData";

const alertRules = [
  { name: 'High LLM Latency', condition: 'P99 > 1500ms', enabled: true },
  { name: 'Call Failure Spike', condition: 'Failure rate > 5%', enabled: true },
  { name: 'Low STT Confidence', condition: 'Avg < 85%', enabled: true },
  { name: 'CosmosDB Throttling', condition: 'Throttle events > 5/hr', enabled: true },
  { name: 'OpenAI Quota', condition: 'Usage > 80%', enabled: true },
  { name: 'Queue Backup', condition: 'Depth > 1000', enabled: false },
];

const Alerts = () => {
  const activeAlerts = alerts.filter(a => a.status === 'active');
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alerts & Anomalies</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitor and manage system alerts
            </p>
          </div>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            New Alert Rule
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Active Alerts"
            value={activeAlerts.length}
            icon={<AlertCircle className="w-4 h-4" />}
            variant="destructive"
            glow={activeAlerts.length > 0}
          />
          <MetricCard
            title="Acknowledged"
            value={acknowledgedAlerts.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            variant="warning"
          />
          <MetricCard
            title="Resolved (24h)"
            value={resolvedAlerts.length}
            icon={<CheckCircle className="w-4 h-4" />}
            variant="success"
          />
          <MetricCard
            title="Alert Rules"
            value={alertRules.filter(r => r.enabled).length}
            icon={<Bell className="w-4 h-4" />}
          />
        </div>

        {/* Alerts List and Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AlertsPanel alerts={alerts} maxItems={10} />
          
          {/* Alert Rules */}
          <div className="glass-card border border-border/50 rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Alert Rules</h3>
              </div>
            </div>
            <div className="divide-y divide-border/30">
              {alertRules.map((rule, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trigger: {rule.condition}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    rule.enabled
                      ? "bg-success/20 text-success"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {rule.enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Alerts;

"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HealthScore } from "@/components/dashboard/HealthScore";
import { SystemHealthGrid } from "@/components/dashboard/SystemHealthGrid";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { MiniChart } from "@/components/dashboard/MiniChart";
import { cn } from "@/lib/utils";
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  Activity,
  Zap,
  TrendingUp,
} from "lucide-react";
import { systemHealthMetrics, systemHealthScore, generateTimeSeriesData } from "@/lib/mockData";

const SystemHealth = () => {
  const cpuData = generateTimeSeriesData(12, 45, 15);
  const memoryData = generateTimeSeriesData(12, 65, 10);
  const requestData = generateTimeSeriesData(12, 120, 40);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">System Health</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Infrastructure and service monitoring
            </p>
          </div>
          <HealthScore score={systemHealthScore} size="md" />
        </div>

        {/* All Services Grid */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Service Status</h3>
          <SystemHealthGrid services={systemHealthMetrics} />
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* App Service */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Voice Assistant App</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">CPU Usage</span>
                  <span className="font-medium">{systemHealthMetrics.appService.cpu}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      systemHealthMetrics.appService.cpu > 80 ? "bg-destructive" :
                      systemHealthMetrics.appService.cpu > 60 ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${systemHealthMetrics.appService.cpu}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Memory</span>
                  <span className="font-medium">{systemHealthMetrics.appService.memory}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      systemHealthMetrics.appService.memory > 80 ? "bg-destructive" :
                      systemHealthMetrics.appService.memory > 60 ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${systemHealthMetrics.appService.memory}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Instances</span>
                <span className="font-medium">{systemHealthMetrics.appService.instances}</span>
              </div>
              <MiniChart data={cpuData} color="hsl(var(--primary))" height={50} />
            </div>
          </div>

          {/* CosmosDB */}
          <div className="glass-card border border-warning/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-sm">CosmosDB</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">RU Consumption</span>
                  <span className="font-medium text-warning">{systemHealthMetrics.cosmosDb.ruUsage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-warning"
                    style={{ width: `${systemHealthMetrics.cosmosDb.ruUsage}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Throttling (429)</span>
                <span className="font-medium text-warning">{systemHealthMetrics.cosmosDb.throttling}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg Latency</span>
                <span className="font-medium">{systemHealthMetrics.cosmosDb.latency}ms</span>
              </div>
              <MiniChart data={memoryData} color="hsl(var(--warning))" height={50} />
            </div>
          </div>

          {/* Function App */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-chart-4" />
              <h3 className="font-semibold text-sm">LLM Engine Functions</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Executions (24h)</span>
                <span className="font-medium">{systemHealthMetrics.functionApp.executions.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Failures</span>
                <span className="font-medium text-destructive">{systemHealthMetrics.functionApp.failures}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cold Starts</span>
                <span className="font-medium text-warning">{systemHealthMetrics.functionApp.coldStarts}</span>
              </div>
              <MiniChart data={requestData} color="hsl(var(--chart-4))" height={50} />
            </div>
          </div>
        </div>

        {/* Queue and Azure Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Storage Queue</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Queue Depth"
                value={systemHealthMetrics.queue.depth}
                size="sm"
                variant={systemHealthMetrics.queue.depth > 500 ? "warning" : "default"}
              />
              <MetricCard
                title="Processing Latency"
                value={`${systemHealthMetrics.queue.processingLatency}ms`}
                size="sm"
              />
            </div>
          </div>

          <div className="glass-card border border-warning/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-warning" />
              <h3 className="font-semibold text-sm">Azure OpenAI</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                title="Quota Used"
                value={`${systemHealthMetrics.azureOpenai.quotaUsed}%`}
                size="sm"
                variant="warning"
              />
              <MetricCard
                title="Throttling"
                value={systemHealthMetrics.azureOpenai.throttling}
                size="sm"
                variant={systemHealthMetrics.azureOpenai.throttling > 5 ? "destructive" : "warning"}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SystemHealth;

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { HealthScore } from "@/components/dashboard/HealthScore";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { SystemHealthGrid } from "@/components/dashboard/SystemHealthGrid";
import { CallVolumeChart } from "@/components/dashboard/CallVolumeChart";
import { LatencyChart } from "@/components/dashboard/LatencyChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { CostBreakdown } from "@/components/dashboard/CostBreakdown";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  PhoneCall,
  CheckCircle,
  Clock,
  Zap,
  DollarSign,
  Loader2,
  Timer,
} from "lucide-react";
import {
  overviewMetrics as mockOverview,
  latencyData,
  systemHealthMetrics,
} from "@/lib/mockData";
import { useProjects } from "@/lib/projectConfig";
import { useTimeRange } from "@/lib/timeRange";
import { toast } from "sonner";

type VolumePoint = { time: string; inbound: number; outbound: number };
type StatusSlice = { name: string; value: number; color: string };
type AlertItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
  status: "active" | "acknowledged" | "resolved";
};

type OverviewPayload = {
  metrics: {
    totalCalls: number;
    activeCalls: number;
    successRate: number;
    avgDuration: number;
    costTotal: number;
  };
  longestCall?: {
    id: string;
    duration: number;
    callerNumber?: string;
    timestamp?: string;
  } | null;
  changes: {
    totalCalls?: number;
    successRate?: number;
    avgDuration?: number;
    costTotal?: number;
  };
  volume: VolumePoint[];
  statusBreakdown: StatusSlice[];
  alerts: AlertItem[];
  healthScore: number;
  telephonyCost: {
    category: string;
    daily: number;
    monthly: number;
    trend: number;
  };
  truncated?: boolean;
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const OverviewContent = () => {
  const { activeId, active, loading: projectsLoading } = useProjects();
  const { timeRange, dateRange, getBounds, refreshToken } = useTimeRange();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [source, setSource] = useState<"twilio" | "empty">("empty");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGenRef = useRef(0);
  const previousProjectRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (previousProjectRef.current === undefined) {
      previousProjectRef.current = activeId;
      return;
    }
    if (previousProjectRef.current === activeId) return;
    previousProjectRef.current = activeId;
    setData(null);
    setSource("empty");
    setError(null);
    setLoading(true);
  }, [activeId]);

  const load = useCallback(async () => {
    const requestGen = ++requestGenRef.current;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      if (!activeId) {
        setSource("empty");
        setError("No project selected for this AWS account.");
        return;
      }

      const bounds = getBounds();
      const params = new URLSearchParams({ limit: "1000" });
      params.set("projectId", activeId);
      if (bounds.after) params.set("startTimeAfter", bounds.after.toISOString());
      if (bounds.before) params.set("startTimeBefore", bounds.before.toISOString());

      const res = await fetch(`/api/calls/overview?${params}`, { credentials: "include" });
      const json = await res.json();
      if (requestGen !== requestGenRef.current) return;

      if (!res.ok) {
        if (json?.error?.code === "NO_PROJECT") {
          setSource("empty");
          setError(
            json?.error?.message ||
              "No project configured for the selected AWS account/role.",
          );
          return;
        }
        throw new Error(json?.error?.message || "Failed to load overview");
      }
      setData(json as OverviewPayload);
      setSource("twilio");
    } catch (e) {
      if (requestGen !== requestGenRef.current) return;
      setData(null);
      setSource("empty");
      const msg = e instanceof Error ? e.message : "Failed to load overview";
      setError(msg);
      toast.error(msg);
    } finally {
      if (requestGen === requestGenRef.current) {
        setLoading(false);
      }
    }
  }, [activeId, getBounds]);

  useEffect(() => {
    if (projectsLoading) return;
    void load();
  }, [projectsLoading, load, refreshToken, timeRange, dateRange]);

  const showLoader = loading || projectsLoading;
  const live = source === "twilio" && data;

  const emptyMetrics = {
    totalCalls: 0,
    totalCallsChange: 0,
    activeCalls: 0,
    successRate: 0,
    successRateChange: 0,
    avgDuration: 0,
    avgDurationChange: 0,
    costToday: 0,
    costChange: 0,
    avgLatency: 0,
    avgLatencyChange: 0,
  };

  const metrics = live
    ? {
        totalCalls: data.metrics.totalCalls,
        totalCallsChange: data.changes.totalCalls,
        activeCalls: data.metrics.activeCalls,
        successRate: data.metrics.successRate,
        successRateChange: data.changes.successRate,
        avgDuration: data.metrics.avgDuration,
        avgDurationChange: data.changes.avgDuration,
        costToday: data.metrics.costTotal,
        costChange: data.changes.costTotal,
        avgLatency: mockOverview.avgLatency,
        avgLatencyChange: mockOverview.avgLatencyChange,
      }
    : emptyMetrics;

  const volume = live ? data.volume : [];
  const emptyStatus: StatusSlice[] = [
    { name: "Completed", value: 0, color: "hsl(var(--success))" },
    { name: "Failed", value: 0, color: "hsl(var(--destructive))" },
    { name: "Dropped", value: 0, color: "hsl(var(--warning))" },
    { name: "Active / In progress", value: 0, color: "hsl(var(--info))" },
  ];
  const statusBreakdown = live
    ? data.statusBreakdown.length
      ? data.statusBreakdown
      : emptyStatus
    : emptyStatus;
  const healthScore = live ? data.healthScore : 0;
  const alerts = live ? data.alerts : [];
  const costs = live
    ? [
        {
          category: data.telephonyCost.category,
          daily: data.telephonyCost.daily,
          monthly: data.telephonyCost.monthly,
          trend: data.telephonyCost.trend,
        },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showLoader
              ? "Loading Twilio overview…"
              : live
                ? `Live Twilio metrics${active?.name ? ` · ${active.name}` : ""}${
                    data.truncated ? " · showing latest 1,000 calls in range" : ""
                  }`
                : "No live metrics yet — select a project with Twilio configured for this AWS account"}
          </p>
        </div>
        {showLoader ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        ) : (
          <HealthScore score={healthScore} size="sm" />
        )}
      </div>

      {error && !showLoader && (
        <p className="text-xs text-chart-warning border border-chart-warning/30 bg-chart-warning/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {showLoader ? (
          Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="Total Calls"
              value={metrics.totalCalls.toLocaleString()}
              change={metrics.totalCallsChange}
              changeLabel="vs prior period"
              icon={<Phone className="w-4 h-4" />}
            />
            <MetricCard
              title="Active Calls"
              value={metrics.activeCalls}
              icon={<PhoneCall className="w-4 h-4" />}
              variant="info"
              glow
            />
            <MetricCard
              title="Success Rate"
              value={`${metrics.successRate}%`}
              change={metrics.successRateChange}
              changeLabel="vs prior period"
              icon={<CheckCircle className="w-4 h-4" />}
              variant="success"
            />
            <MetricCard
              title="Avg Duration"
              value={formatDuration(metrics.avgDuration)}
              change={metrics.avgDurationChange}
              changeLabel="vs prior period"
              icon={<Clock className="w-4 h-4" />}
            />
            <MetricCard
              title="Longest Call"
              value={
                live && data.longestCall
                  ? formatDuration(data.longestCall.duration)
                  : live
                    ? "—"
                    : formatDuration(mockOverview.longestDuration)
              }
              icon={<Timer className="w-4 h-4" />}
              variant="info"
              href={live && data.longestCall?.id ? `/calls/${data.longestCall.id}` : undefined}
              clickHint={
                live && data.longestCall?.id
                  ? "Open call detail"
                  : live
                    ? "No calls in range"
                    : undefined
              }
            />
            <MetricCard
              title="Avg Latency"
              value={`${metrics.avgLatency}ms`}
              change={metrics.avgLatencyChange}
              changeLabel="sample (not Twilio)"
              icon={<Zap className="w-4 h-4" />}
              variant="warning"
            />
            <MetricCard
              title="Total Cost"
              value={`$${Number(metrics.costToday).toFixed(live ? 4 : 2)}`}
              change={metrics.costChange}
              changeLabel="vs prior period"
              icon={<DollarSign className="w-4 h-4" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showLoader ? (
          <>
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </>
        ) : (
          <>
            <CallVolumeChart
              data={volume}
              title={live ? "Call Volume (Twilio)" : "Call Volume"}
            />
            <LatencyChart data={latencyData} title="Latency Breakdown (sample)" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {showLoader ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : (
          <DonutChart
            data={statusBreakdown}
            title={live ? "Call Status (Twilio)" : "Call Status Distribution"}
            centerValue={`${metrics.successRate}%`}
            centerLabel="Success"
          />
        )}
        <div className="lg:col-span-2">
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-1">System Components</h3>
            <p className="text-[11px] text-muted-foreground mb-4">Sample infrastructure health</p>
            <SystemHealthGrid services={systemHealthMetrics} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showLoader ? (
          <>
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </>
        ) : (
          <>
            <AlertsPanel
              alerts={alerts}
              maxItems={6}
            />
            <div className="relative">
              <CostBreakdown costs={costs} />
              {live && (
                <p className="px-4 pb-3 text-[11px] text-muted-foreground">
                  Other service costs default to $0 until those integrations are connected. Total matches Telephony (Twilio) for now.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Index = () => (
  <DashboardLayout>
    <OverviewContent />
  </DashboardLayout>
);

export default Index;

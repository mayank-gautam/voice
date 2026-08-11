import type { CallListItem } from "@/lib/server/twilio";
import { format, startOfHour, startOfDay } from "date-fns";

export type OverviewMetrics = {
  totalCalls: number;
  activeCalls: number;
  successRate: number;
  avgDuration: number;
  costTotal: number;
  completed: number;
  failed: number;
  dropped: number;
  escalated: number;
  inbound: number;
  outbound: number;
};

export type VolumePoint = {
  time: string;
  inbound: number;
  outbound: number;
  key: string;
};

export type StatusSlice = {
  name: string;
  value: number;
  color: string;
};

export type OverviewAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  timestamp: string;
  status: "active" | "acknowledged" | "resolved";
};

function bucketKey(iso: string, mode: "hour" | "day"): string {
  const d = new Date(iso);
  return mode === "hour" ? startOfHour(d).toISOString() : startOfDay(d).toISOString();
}

function bucketLabel(key: string, mode: "hour" | "day"): string {
  const d = new Date(key);
  return mode === "hour"
    ? format(d, "HH:mm")
    : format(d, "MMM d");
}

export function resolveVolumeMode(after?: Date | null, before?: Date | null): "hour" | "day" {
  const end = before ?? new Date();
  const start = after ?? new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return hours <= 48 ? "hour" : "day";
}

export function buildVolumeSeries(
  calls: CallListItem[],
  after?: Date | null,
  before?: Date | null
): VolumePoint[] {
  const mode = resolveVolumeMode(after, before);
  const end = before ?? new Date();
  const start = after ?? new Date(end.getTime() - 24 * 60 * 60 * 1000);

  const map = new Map<string, { inbound: number; outbound: number }>();

  // Seed empty buckets so the chart has a continuous axis
  if (mode === "hour") {
    let cursor = startOfHour(start).getTime();
    const last = startOfHour(end).getTime();
    const step = 60 * 60 * 1000;
    while (cursor <= last) {
      map.set(new Date(cursor).toISOString(), { inbound: 0, outbound: 0 });
      cursor += step;
    }
  } else {
    let cursor = startOfDay(start).getTime();
    const last = startOfDay(end).getTime();
    const step = 24 * 60 * 60 * 1000;
    while (cursor <= last) {
      map.set(new Date(cursor).toISOString(), { inbound: 0, outbound: 0 });
      cursor += step;
    }
  }

  for (const call of calls) {
    const key = bucketKey(call.timestamp, mode);
    const slot = map.get(key) ?? { inbound: 0, outbound: 0 };
    if (call.callType === "outbound") slot.outbound += 1;
    else slot.inbound += 1;
    map.set(key, slot);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      time: bucketLabel(key, mode),
      inbound: v.inbound,
      outbound: v.outbound,
    }));
}

export function aggregateCallMetrics(calls: CallListItem[]): OverviewMetrics {
  const totalCalls = calls.length;
  let completed = 0;
  let failed = 0;
  let dropped = 0;
  let escalated = 0;
  let inbound = 0;
  let outbound = 0;
  let durationSum = 0;
  let costTotal = 0;
  let activeCalls = 0;

  for (const c of calls) {
    if (c.callType === "outbound") outbound += 1;
    else inbound += 1;
    durationSum += c.duration || 0;
    costTotal += Number(c.cost) || 0;
    switch (c.status) {
      case "failed":
        failed += 1;
        break;
      case "dropped":
        dropped += 1;
        break;
      case "escalated":
        escalated += 1;
        break;
      case "active":
        activeCalls += 1;
        escalated += 1; // status donut "Active / In progress"
        break;
      default:
        completed += 1;
    }
  }

  const finished = completed + failed + dropped;
  const successRate = finished > 0 ? Math.round((completed / finished) * 1000) / 10 : 0;
  const avgDuration = totalCalls > 0 ? Math.round(durationSum / totalCalls) : 0;

  return {
    totalCalls,
    activeCalls,
    successRate,
    avgDuration,
    costTotal: Math.round(costTotal * 10000) / 10000,
    completed,
    failed,
    dropped,
    escalated,
    inbound,
    outbound,
  };
}

/** Longest call in the set (by duration); ties prefer the more recent timestamp. */
export function findLongestCall(
  calls: CallListItem[]
): { id: string; duration: number; callerNumber: string; timestamp: string } | null {
  if (!calls.length) return null;

  let best = calls[0];
  for (let i = 1; i < calls.length; i++) {
    const c = calls[i];
    const bestDur = best.duration || 0;
    const dur = c.duration || 0;
    if (dur > bestDur) {
      best = c;
    } else if (dur === bestDur && c.timestamp > best.timestamp) {
      best = c;
    }
  }

  return {
    id: best.id,
    duration: best.duration || 0,
    callerNumber: best.callerNumber,
    timestamp: best.timestamp,
  };
}

export function buildStatusBreakdown(metrics: OverviewMetrics): StatusSlice[] {
  return [
    { name: "Completed", value: metrics.completed, color: "hsl(var(--success))" },
    { name: "Failed", value: metrics.failed, color: "hsl(var(--destructive))" },
    { name: "Dropped", value: metrics.dropped, color: "hsl(var(--warning))" },
    { name: "Active / In progress", value: metrics.escalated, color: "hsl(var(--info))" },
  ];
}

export function buildTwilioAlerts(calls: CallListItem[], metrics: OverviewMetrics): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];
  const now = new Date().toISOString();

  if (metrics.activeCalls > 0) {
    alerts.push({
      id: "active-calls",
      severity: "info",
      title: `${metrics.activeCalls} active call${metrics.activeCalls === 1 ? "" : "s"}`,
      description: "Calls currently in progress, ringing, or queued on Twilio.",
      timestamp: now,
      status: "active",
    });
  }

  const failRate =
    metrics.totalCalls > 0
      ? ((metrics.failed + metrics.dropped) / metrics.totalCalls) * 100
      : 0;

  if (failRate >= 15) {
    alerts.push({
      id: "high-fail-rate",
      severity: "critical",
      title: "High failure / drop rate",
      description: `${failRate.toFixed(1)}% of calls in this range failed or were not answered.`,
      timestamp: now,
      status: "active",
    });
  } else if (failRate >= 8) {
    alerts.push({
      id: "elevated-fail-rate",
      severity: "warning",
      title: "Elevated failure / drop rate",
      description: `${failRate.toFixed(1)}% of calls in this range failed or were not answered.`,
      timestamp: now,
      status: "active",
    });
  }

  const recentIssues = calls
    .filter((c) => c.status === "failed" || c.status === "dropped")
    .slice(0, 4);

  for (const c of recentIssues) {
    alerts.push({
      id: c.id,
      severity: c.status === "failed" ? "critical" : "warning",
      title: c.status === "failed" ? "Failed call" : "Dropped / no-answer",
      description: `${c.callerNumber} · ${c.callType} · ${c.twilioStatus || c.status}`,
      timestamp: c.timestamp,
      status: "active",
    });
  }

  return alerts;
}

export function healthScoreFromMetrics(metrics: OverviewMetrics): number {
  if (metrics.totalCalls === 0 && metrics.activeCalls === 0) return 0;
  let score = metrics.successRate;
  if (metrics.activeCalls > 20) score -= 5;
  if (metrics.failed + metrics.dropped > metrics.completed * 0.2) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function pctChange(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Globe, Signal, Radio } from "lucide-react";
import {
  qualityThresholds,
  gradeJitter,
  gradeLoss,
  gradeLatency,
  levelColor,
} from "@/lib/realCallAnalytics";
import { cn } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};
const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

const Chip = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-border/60 bg-secondary/40">
    {icon}
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

export type TelephonyData = {
  codec: string;
  mediaRegion: string;
  signalingRegion: string;
  edgeLocation: string;
  pddMs: number;
  disconnectedBy: string;
  lastSipResponse: number;
  inbound: { jitterAvgMs: number; jitterMaxMs: number; packets: number; lossPct: number };
  outbound: { jitterAvgMs: number; jitterMaxMs: number; packets: number; lossPct: number };
};

export const EMPTY_TELEPHONY: TelephonyData = {
  codec: "",
  mediaRegion: "",
  signalingRegion: "",
  edgeLocation: "",
  pddMs: 0,
  disconnectedBy: "",
  lastSipResponse: 0,
  inbound: { jitterAvgMs: 0, jitterMaxMs: 0, packets: 0, lossPct: 0 },
  outbound: { jitterAvgMs: 0, jitterMaxMs: 0, packets: 0, lossPct: 0 },
};

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Poor";
}

interface Props {
  telephony?: TelephonyData;
  qualityScore?: number;
  loading?: boolean;
  error?: string | null;
  audioUrl?: string | null;
}

export const CallTelephonyQuality = ({
  telephony = EMPTY_TELEPHONY,
  qualityScore = 0,
  loading,
  error,
  audioUrl,
}: Props) => {
  if (loading) {
    return <p className="text-sm text-muted-foreground p-4">Loading telephony insights…</p>;
  }

  const jitterData = [
    { leg: "Inbound", avg: telephony.inbound.jitterAvgMs, max: telephony.inbound.jitterMaxMs },
    { leg: "Outbound", avg: telephony.outbound.jitterAvgMs, max: telephony.outbound.jitterMaxMs },
  ];

  const lossData = [
    { leg: "Inbound", loss: telephony.inbound.lossPct },
    { leg: "Outbound", loss: telephony.outbound.lossPct },
  ];

  const thresholdRows = [
    { metric: "Inbound Avg Jitter", value: `${telephony.inbound.jitterAvgMs} ms`, level: gradeJitter(telephony.inbound.jitterAvgMs) },
    { metric: "Inbound Max Jitter", value: `${telephony.inbound.jitterMaxMs} ms`, level: gradeJitter(telephony.inbound.jitterMaxMs) },
    { metric: "Outbound Avg Jitter", value: `${telephony.outbound.jitterAvgMs} ms`, level: gradeJitter(telephony.outbound.jitterAvgMs) },
    { metric: "Outbound Max Jitter", value: `${telephony.outbound.jitterMaxMs} ms`, level: gradeJitter(telephony.outbound.jitterMaxMs) },
    { metric: "Inbound Packet Loss", value: `${telephony.inbound.lossPct}%`, level: gradeLoss(telephony.inbound.lossPct) },
    { metric: "Outbound Packet Loss", value: `${telephony.outbound.lossPct}%`, level: gradeLoss(telephony.outbound.lossPct) },
    { metric: "Post-Dial Delay", value: `${telephony.pddMs} ms`, level: gradeLatency(telephony.pddMs) },
  ];

  const yLossMax = Math.max(1, ...lossData.map((d) => d.loss), qualityThresholds.packetLossPercent.good);

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-chart-warning border border-chart-warning/30 bg-chart-warning/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {audioUrl && (
        <div className="glass-card border border-border/50 rounded-xl p-3">
          <p className="text-xs font-medium mb-2">Call recording</p>
          <audio controls className="w-full h-9" src={audioUrl} preload="metadata">
            Your browser does not support audio playback.
          </audio>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip label="Codec" value={telephony.codec || "—"} icon={<Radio className="w-3 h-3" />} />
        <Chip label="Edge" value={telephony.edgeLocation || "—"} icon={<Globe className="w-3 h-3" />} />
        <Chip label="Media region" value={telephony.mediaRegion || "—"} />
        <Chip label="Signaling" value={telephony.signalingRegion || "—"} />
        <Chip label="Disconnected by" value={telephony.disconnectedBy || "—"} />
        <Chip label="Last SIP" value={String(telephony.lastSipResponse || "—")} />
        <Chip
          label="Packets"
          value={`${telephony.inbound.packets} / ${telephony.outbound.packets}`}
          icon={<Signal className="w-3 h-3" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="glass-card border border-border/50 rounded-xl p-4 flex flex-col items-center justify-center">
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" stroke="hsl(var(--border))" strokeWidth="8" fill="none" />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="hsl(var(--success))"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(qualityScore / 100) * 264} 264`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{qualityScore}</span>
              <span className="text-[10px] text-muted-foreground uppercase">/ 100</span>
            </div>
          </div>
          <p className="mt-3 text-sm font-medium text-success">{scoreLabel(qualityScore)}</p>
          <p className="text-[11px] text-muted-foreground text-center px-2">
            Derived from jitter, packet loss, and PDD
          </p>
        </div>

        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Jitter (ms) vs 30 ms threshold</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jitterData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="leg" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ms`} />
                <Legend verticalAlign="top" height={24} formatter={(v) => <span className="text-xs">{v}</span>} />
                <ReferenceLine y={qualityThresholds.jitterMs.good} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
                <Bar dataKey="avg" name="Avg" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="max" name="Max" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Packet Loss (%) vs 1% threshold</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lossData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="leg" tick={axis} axisLine={false} tickLine={false} />
                <YAxis domain={[0, yLossMax]} tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                <ReferenceLine
                  y={qualityThresholds.packetLossPercent.good}
                  stroke="hsl(var(--warning))"
                  strokeDasharray="4 4"
                />
                <Bar dataKey="loss" name="Loss" radius={[3, 3, 0, 0]}>
                  {lossData.map((d) => (
                    <Cell key={d.leg} fill={levelColor[gradeLoss(d.loss)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/50">
          <h3 className="font-semibold text-sm">Threshold Evaluation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Metric</th>
                <th className="text-left font-medium px-4 py-2">Value</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2 hidden md:table-cell">Rule</th>
              </tr>
            </thead>
            <tbody>
              {thresholdRows.map((r) => (
                <tr key={r.metric} className="border-t border-border/40">
                  <td className="px-4 py-2">{r.metric}</td>
                  <td className="px-4 py-2 font-mono">{r.value}</td>
                  <td className="px-4 py-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
                      style={{ color: levelColor[r.level], backgroundColor: `${levelColor[r.level]}1a` }}
                    >
                      {r.level}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                    {r.metric.includes("Jitter")
                      ? "Good ≤30 ms · Warn ≤50 · Poor ≤100"
                      : r.metric.includes("Loss")
                        ? "Good ≤1% · Warn ≤3% · Poor ≤5%"
                        : "Good ≤150 ms · Warn ≤300 ms"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Media Path</h3>
        <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
          <span className="px-2 py-1 rounded bg-secondary">Caller (SIP)</span>
          <span className="text-muted-foreground">→</span>
          <span className={cn("px-2 py-1 rounded bg-primary/10 border border-primary/30")}>
            {telephony.edgeLocation || "edge"} ({telephony.mediaRegion || "region"})
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="px-2 py-1 rounded bg-secondary">Voice Agent</span>
        </div>
      </div>
    </div>
  );
};

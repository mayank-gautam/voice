"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TwilioInsightsAggregate } from "@/components/dashboard/TwilioInsightsAggregate";
import { MiniChart } from "@/components/dashboard/MiniChart";
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Radio,
  AlertTriangle,
  Activity,
  Waves,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Mock data for voice quality metrics
const audioAmplitudeData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  avgAmplitude: 45 + Math.random() * 20,
  peakAmplitude: 70 + Math.random() * 25,
  noiseFloor: 10 + Math.random() * 8,
}));

const silenceDetectionData = Array.from({ length: 7 }, (_, i) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    day: days[i],
    silenceEvents: Math.floor(50 + Math.random() * 100),
    longPauses: Math.floor(20 + Math.random() * 40),
    deadAir: Math.floor(5 + Math.random() * 15),
  };
});

const sttFailureData = Array.from({ length: 12 }, (_, i) => ({
  time: `${i * 2}:00`,
  failures: Math.floor(Math.random() * 20),
  noSpeech: Math.floor(Math.random() * 15),
  lowConfidence: Math.floor(Math.random() * 25),
}));

const bargeInData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  count: Math.floor(10 + Math.random() * 30),
}));

const qualityDistribution = [
  { name: 'Excellent', value: 45, color: 'hsl(var(--success))' },
  { name: 'Good', value: 30, color: 'hsl(var(--chart-1))' },
  { name: 'Fair', value: 15, color: 'hsl(var(--warning))' },
  { name: 'Poor', value: 10, color: 'hsl(var(--destructive))' },
];

const ttsMetrics = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  truncationRate: Math.random() * 5,
  generationLatency: 80 + Math.random() * 60,
}));

const jitterData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  jitter: 5 + Math.random() * 15,
  packetLoss: Math.random() * 2,
}));

const recentIssues = [
  { id: 1, type: 'No Speech Detected', callId: 'call_8x7k2', time: '2 min ago', severity: 'warning' },
  { id: 2, type: 'High Jitter', callId: 'call_9m3n1', time: '5 min ago', severity: 'critical' },
  { id: 3, type: 'TTS Truncation', callId: 'call_2p5q8', time: '8 min ago', severity: 'warning' },
  { id: 4, type: 'Low STT Confidence', callId: 'call_7r4s9', time: '12 min ago', severity: 'info' },
  { id: 5, type: 'Silence Timeout', callId: 'call_1t6u3', time: '15 min ago', severity: 'warning' },
];

export default function VoiceQuality() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold">Voice Quality</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor audio quality, speech detection, and voice processing metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Avg Audio Amplitude"
            value="52.3 dB"
            change={2.1}
            icon={<Volume2 className="w-4 h-4" />}
            variant="info"
          />
          <MetricCard
            title="Silence Events"
            value="847"
            change={-5.2}
            icon={<VolumeX className="w-4 h-4" />}
            variant="warning"
          />
          <MetricCard
            title="Barge-in Rate"
            value="12.4%"
            change={1.8}
            icon={<Mic className="w-4 h-4" />}
            variant="default"
          />
          <MetricCard
            title="STT Failure Rate"
            value="2.1%"
            change={-0.3}
            icon={<MicOff className="w-4 h-4" />}
            variant="success"
          />
        </div>

        {/* Twilio Voice Insights (fleet aggregate) */}
        <TwilioInsightsAggregate />



        {/* Audio Amplitude Chart */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Waves className="w-4 h-4 text-primary" />
            Audio Amplitude Over Time
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={audioAmplitudeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="amplitudeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value}dB`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area
                  type="monotone"
                  dataKey="peakAmplitude"
                  name="Peak"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  fill="url(#peakGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="avgAmplitude"
                  name="Average"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#amplitudeGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="noiseFloor"
                  name="Noise Floor"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Silence Detection */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-warning" />
              Silence Detection Events
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={silenceDetectionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="silenceEvents" name="Silence Events" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="longPauses" name="Long Pauses" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deadAir" name="Dead Air" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quality Distribution */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-success" />
              Call Quality Distribution
            </h3>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={qualityDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {qualityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Calls']}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* STT Failures & Barge-in */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* STT Failure Analysis */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <MicOff className="w-4 h-4 text-destructive" />
              STT Failure Analysis
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sttFailureData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line type="monotone" dataKey="failures" name="Failures" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="noSpeech" name="No Speech" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="lowConfidence" name="Low Confidence" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Barge-in Events */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Mic className="w-4 h-4 text-chart-1" />
              Barge-in Events (Interruptions)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bargeInData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Barge-ins" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Network Quality & TTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Jitter & Packet Loss */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-info" />
              Network Quality (Jitter & Packet Loss)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={jitterData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}ms`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line yAxisId="left" type="monotone" dataKey="jitter" name="Jitter (ms)" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="packetLoss" name="Packet Loss (%)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TTS Metrics */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-chart-2" />
              TTS Performance
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ttsMetrics} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Line yAxisId="left" type="monotone" dataKey="truncationRate" name="Truncation Rate (%)" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="generationLatency" name="Generation Latency (ms)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Issues */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Recent Voice Quality Issues
          </h3>
          <div className="space-y-2">
            {recentIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      issue.severity === 'critical'
                        ? 'bg-destructive'
                        : issue.severity === 'warning'
                        ? 'bg-warning'
                        : 'bg-info'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{issue.type}</p>
                    <p className="text-xs text-muted-foreground">{issue.callId}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{issue.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

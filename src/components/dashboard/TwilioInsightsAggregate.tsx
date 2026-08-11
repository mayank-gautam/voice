import { useMemo } from "react";
import {
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
import { Radio } from "lucide-react";
import { buildAggregate, mockInsightsForCall } from "@/lib/twilioInsights";

export const TwilioInsightsAggregate = () => {
  const agg = useMemo(() => {
    const samples = Array.from({ length: 200 }, (_, i) =>
      mockInsightsForCall(`CA${i.toString(16).padStart(8, "0")}`, 30 + Math.floor(Math.random() * 400)),
    );
    return buildAggregate(samples);
  }, []);

  const tooltip = {
    contentStyle: {
      backgroundColor: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      fontSize: "12px",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-semibold">Twilio Voice Insights (Fleet)</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MOS trend */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Mean Opinion Score (24h)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.mosTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} />
                <Line type="monotone" dataKey="mos" name="MOS" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PDD percentiles */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Post-Dial Delay Percentiles</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.pddPercentiles} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                <Tooltip {...tooltip} formatter={(v: number) => `${v} ms`} />
                <Legend verticalAlign="top" height={28} formatter={(v) => <span className="text-xs">{v}</span>} />
                <Line type="monotone" dataKey="p50" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p90" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="p99" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jitter histogram */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Jitter Distribution (ms buckets)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.jitterHistogram} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltip} />
                <Legend verticalAlign="top" height={28} formatter={(v) => <span className="text-xs">{v}</span>} />
                <Bar dataKey="inbound" name="Inbound" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" name="Outbound" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Loss trend */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Packet Loss % (24h)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.lossTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={3} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip {...tooltip} formatter={(v: number) => `${v}%`} />
                <Line type="monotone" dataKey="loss" name="Loss %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Codec mix */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Codec Mix</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agg.codecMix} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                  {agg.codecMix.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...tooltip} />
                <Legend verticalAlign="bottom" formatter={(v) => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Edge locations */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Calls by Edge Location</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.edgeMix} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="edge" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip {...tooltip} />
                <Bar dataKey="calls" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Disconnected by */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-4">Disconnected By</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agg.disconnectedBy} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                  {agg.disconnectedBy.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...tooltip} />
                <Legend verticalAlign="bottom" formatter={(v) => <span className="text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

interface LatencyChartProps {
  data: Array<{
    time: string;
    stt: number;
    llm: number;
    tts: number;
  }>;
  className?: string;
  title?: string;
}

export const LatencyChart = ({ data, className, title = "Latency Breakdown" }: LatencyChartProps) => {
  return (
    <div className={cn("glass-card border border-border/50 rounded-xl p-4", className)}>
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="sttGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="llmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ttsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
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
              tickFormatter={(value) => `${value}ms`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [`${value}ms`, name.toUpperCase()]}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => <span className="text-xs uppercase">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="stt"
              name="STT"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#sttGradient)"
            />
            <Area
              type="monotone"
              dataKey="llm"
              name="LLM"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              fill="url(#llmGradient)"
            />
            <Area
              type="monotone"
              dataKey="tts"
              name="TTS"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill="url(#ttsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

interface MiniChartProps {
  data: Array<{ time: string; value: number }>;
  color?: string;
  height?: number;
  showAxis?: boolean;
  className?: string;
  gradient?: boolean;
}

export const MiniChart = ({
  data,
  color = "hsl(var(--primary))",
  height = 60,
  showAxis = false,
  className,
  gradient = true,
}: MiniChartProps) => {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showAxis && (
            <>
              <XAxis dataKey="time" hide />
              <YAxis hide />
            </>
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={gradient ? `url(#gradient-${color})` : 'none'}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

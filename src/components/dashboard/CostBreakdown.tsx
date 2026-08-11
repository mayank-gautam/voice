import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface CostItem {
  category: string;
  daily: number;
  monthly: number;
  trend: number;
}

interface CostBreakdownProps {
  costs: CostItem[];
  className?: string;
}

export const CostBreakdown = ({ costs, className }: CostBreakdownProps) => {
  const totalDaily = costs.reduce((sum, c) => sum + c.daily, 0);
  const totalMonthly = costs.reduce((sum, c) => sum + c.monthly, 0);

  const chartData = costs.map((c) => {
    const lower = c.category.toLowerCase();
    let name = c.category.split(" ")[0];
    if (lower.includes("twilio") || lower.includes("telephony")) name = "Telephony";
    else if (lower.includes("stt")) name = "STT";
    else if (lower.includes("tts")) name = "TTS";
    else if (lower.includes("openai")) name = "OpenAI";
    else if (lower.includes("cosmos")) name = "Cosmos";
    else if (lower.includes("app service")) name = "AppSvc";
    return { name, value: c.daily, fullName: c.category };
  });

  return (
    <div className={cn("glass-card border border-border/50 rounded-xl", className)}>
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Cost Breakdown</h3>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">${totalDaily.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="h-40 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
            >
              <XAxis type="number" hide domain={[0, "auto"]} />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, _name: string, item) => [
                  `$${Number(value).toFixed(4)}`,
                  (item?.payload as { fullName?: string } | undefined)?.fullName || "Cost",
                ]}
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                minPointSize={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {costs.slice(0, 4).map((cost, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
            >
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {cost.category}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium">${cost.daily.toFixed(2)}</span>
                <div className={cn(
                  "flex items-center gap-0.5 text-xs",
                  cost.trend > 0 ? "text-destructive" : cost.trend < 0 ? "text-success" : "text-muted-foreground"
                )}>
                  {cost.trend > 0 ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : cost.trend < 0 ? (
                    <ArrowDown className="w-3 h-3" />
                  ) : null}
                  {Math.abs(cost.trend)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Monthly Estimate</span>
            <span className="text-lg font-bold text-primary">
              ${totalMonthly.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

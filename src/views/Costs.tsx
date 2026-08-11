"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CostBreakdown } from "@/components/dashboard/CostBreakdown";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { costBreakdown, generateTimeSeriesData } from "@/lib/mockData";
import { toast } from "sonner";

type RangeKey = "1h" | "24h" | "7d" | "30d" | "90d" | "custom";

const RANGE_OPTIONS: { value: RangeKey; label: string; days: number }[] = [
  { value: "1h", label: "Last 1 hour", days: 1 },
  { value: "24h", label: "Last 24 hours", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "custom", label: "Custom range", days: 0 },
];

const Costs = () => {
  const [range, setRange] = useState<RangeKey>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [customOpen, setCustomOpen] = useState(false);

  const days = useMemo(() => {
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      const diff = Math.ceil(
        (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(1, diff);
    }
    return RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 30;
  }, [range, dateRange]);

  const rangeLabel = useMemo(() => {
    if (range === "custom" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    return RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "";
  }, [range, dateRange]);

  const totalDaily = costBreakdown.reduce((sum, c) => sum + c.daily, 0);
  const totalForRange = totalDaily * days;
  const totalMonthly = costBreakdown.reduce((sum, c) => sum + c.monthly, 0);
  const callsInRange = Math.max(1, 500 * days);
  const avgCostPerCall = (totalForRange / callsInRange).toFixed(4);

  const costTrendData = useMemo(
    () =>
      generateTimeSeriesData(days, totalDaily, totalDaily * 0.15).map((d, i) => ({
        ...d,
        day: `Day ${days - i}`,
      })),
    [days, totalDaily]
  );

  const monthlyCostData = costBreakdown.map((c) => ({
    name: c.category.split(" ")[0],
    value: c.monthly,
  }));

  const filteredBreakdown = costBreakdown.map((c) => ({
    ...c,
    rangeTotal: +(c.daily * days).toFixed(2),
  }));

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fileBase = `cost-report-${range}-${new Date().toISOString().slice(0, 10)}`;

  const exportJSON = () => {
    const payload = {
      report: "Cost Analytics",
      generatedAt: new Date().toISOString(),
      timeRange: {
        key: range,
        label: rangeLabel,
        days,
        from: dateRange?.from?.toISOString() ?? null,
        to: dateRange?.to?.toISOString() ?? null,
      },
      summary: {
        totalForRange: +totalForRange.toFixed(2),
        dailyAverage: +totalDaily.toFixed(2),
        monthlyEstimate: totalMonthly,
        costPerCall: +avgCostPerCall,
        callsInRange,
      },
      breakdown: filteredBreakdown,
      trend: costTrendData,
    };
    triggerDownload(`${fileBase}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast.success("JSON report exported");
  };

  const exportCSV = () => {
    const lines: string[] = [];
    lines.push("Cost Analytics Report");
    lines.push(`Generated At,${new Date().toISOString()}`);
    lines.push(`Time Range,${rangeLabel}`);
    lines.push(`Days,${days}`);
    lines.push("");
    lines.push("Summary");
    lines.push("Metric,Value");
    lines.push(`Total for Range,$${totalForRange.toFixed(2)}`);
    lines.push(`Daily Average,$${totalDaily.toFixed(2)}`);
    lines.push(`Monthly Estimate,$${totalMonthly}`);
    lines.push(`Cost per Call,$${avgCostPerCall}`);
    lines.push(`Calls in Range,${callsInRange}`);
    lines.push("");
    lines.push("Breakdown");
    lines.push("Category,Daily,Monthly,Range Total,Trend %,% of Monthly Total");
    filteredBreakdown.forEach((c) => {
      lines.push(
        `${c.category},${c.daily.toFixed(2)},${c.monthly},${c.rangeTotal.toFixed(2)},${c.trend},${((c.monthly / totalMonthly) * 100).toFixed(1)}`
      );
    });
    lines.push("");
    lines.push("Daily Trend");
    lines.push("Day,Cost");
    costTrendData.forEach((d) => {
      lines.push(`${d.day},${d.value.toFixed(2)}`);
    });
    triggerDownload(`${fileBase}.csv`, lines.join("\n"), "text/csv");
    toast.success("CSV report exported");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cost Analytics</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track and optimize your infrastructure costs · {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={range}
              onValueChange={(v) => {
                setRange(v as RangeKey);
                if (v === "custom") setCustomOpen(true);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {range === "custom" && (
              <Popover open={customOpen} onOpenChange={setCustomOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                      : "Pick dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export Report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportJSON}>
                  <FileJson className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title={`Total (${days}d)`}
            value={`$${totalForRange.toFixed(2)}`}
            change={5.7}
            icon={<DollarSign className="w-4 h-4" />}
            size="md"
          />
          <MetricCard
            title="Monthly Estimate"
            value={`$${totalMonthly.toLocaleString()}`}
            icon={<Calendar className="w-4 h-4" />}
            variant="info"
            size="md"
          />
          <MetricCard
            title="Cost per Call"
            value={`$${avgCostPerCall}`}
            change={-2.3}
            icon={<TrendingDown className="w-4 h-4" />}
            variant="success"
            size="md"
          />
          <MetricCard
            title="YoY Change"
            value="+12.4%"
            icon={<TrendingUp className="w-4 h-4" />}
            variant="warning"
            size="md"
          />
        </div>

        {/* Cost Trend Chart */}
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Daily Cost Trend ({days} {days === 1 ? "day" : "days"})</h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {rangeLabel}
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Daily Cost']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CostBreakdown costs={costBreakdown} />

          {/* Monthly by Category */}
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-4">Monthly Cost by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyCostData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={70}
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
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monthly Cost']}
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Cost Table */}
        <div className="glass-card border border-border/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h3 className="font-semibold text-sm">Detailed Cost Breakdown · {rangeLabel}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Category</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Daily</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Range Total</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Monthly</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Trend</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredBreakdown.map((cost, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-sm">{cost.category}</td>
                    <td className="p-4 text-sm text-right font-mono">${cost.daily.toFixed(2)}</td>
                    <td className="p-4 text-sm text-right font-mono">${cost.rangeTotal.toFixed(2)}</td>
                    <td className="p-4 text-sm text-right font-mono">${cost.monthly.toLocaleString()}</td>
                    <td className="p-4 text-sm text-right">
                      <span className={cn(
                        "font-medium",
                        cost.trend > 0 ? "text-destructive" : cost.trend < 0 ? "text-success" : "text-muted-foreground"
                      )}>
                        {cost.trend > 0 ? '+' : ''}{cost.trend}%
                      </span>
                    </td>
                    <td className="p-4 text-sm text-right font-mono">
                      {((cost.monthly / totalMonthly) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/50 bg-muted/30">
                  <td className="p-4 text-sm font-semibold">Total</td>
                  <td className="p-4 text-sm text-right font-mono font-semibold">${totalDaily.toFixed(2)}</td>
                  <td className="p-4 text-sm text-right font-mono font-semibold">${totalForRange.toFixed(2)}</td>
                  <td className="p-4 text-sm text-right font-mono font-semibold">${totalMonthly.toLocaleString()}</td>
                  <td className="p-4"></td>
                  <td className="p-4 text-sm text-right font-mono font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Costs;

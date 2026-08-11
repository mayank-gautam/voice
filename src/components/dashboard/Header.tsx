"use client";

import { cn } from "@/lib/utils";
import { Bell, Calendar, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ProjectSwitcher } from "@/components/project/ProjectSwitcher";
import { useTimeRange, type TimeRangeKey } from "@/lib/timeRange";

interface HeaderProps {
  className?: string;
}

export const Header = ({ className }: HeaderProps) => {
  const { timeRange, dateRange, setTimeRange, setDateRange, triggerRefresh } = useTimeRange();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const openCustomCalendar = () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    // Defer until Radix Select finishes closing; otherwise it dismisses the popover
    openTimerRef.current = setTimeout(() => {
      setIsCustomOpen(true);
      openTimerRef.current = null;
    }, 150);
  };

  const handleTimeRangeChange = (value: string) => {
    if (value === "custom") {
      openCustomCalendar();
      return;
    }
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsCustomOpen(false);
    setTimeRange(value as TimeRangeKey);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      setIsCustomOpen(false);
    }
  };

  const getDisplayValue = () => {
    if (timeRange === "custom" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`;
    }
    const labels: Record<string, string> = {
      "1h": "Last 1 hour",
      "6h": "Last 6 hours",
      "24h": "Last 24 hours",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
    };
    return labels[timeRange] || timeRange;
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6",
        className
      )}
    >
      <div className="flex-1 flex items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search calls, logs..."
            className="pl-9 bg-muted/50 border-border/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ProjectSwitcher />

        <Popover
          open={isCustomOpen}
          onOpenChange={(open) => {
            if (!open && openTimerRef.current) return; // ignore dismiss while waiting to open
            setIsCustomOpen(open);
          }}
        >
          <PopoverAnchor asChild>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger className="w-[160px] bg-muted/50 border-border/50">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <span className="truncate">{getDisplayValue()}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                  <SelectItem value="6h">Last 6 hours</SelectItem>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom Range...</SelectItem>
                </SelectContent>
              </Select>

              {timeRange === "custom" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-border/50 bg-muted/50"
                  onClick={() => setIsCustomOpen(true)}
                >
                  <Calendar className="w-4 h-4" />
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                    : "Pick dates"}
                </Button>
              )}
            </div>
          </PopoverAnchor>

          <PopoverContent
            className="w-auto p-0"
            align="end"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <CalendarComponent
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              defaultMonth={dateRange?.from}
              className="p-3"
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="sm"
          onClick={() => triggerRefresh()}
          className="border-border/50"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>

        <ThemeToggle />

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
            3
          </span>
        </Button>
      </div>
    </header>
  );
};

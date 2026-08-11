"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { endOfDay, startOfDay, subDays, subHours } from "date-fns";
import type { DateRange } from "react-day-picker";

export type TimeRangeKey = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";

export type TimeRangeBounds = {
  after?: Date;
  before?: Date;
};

type TimeRangeContextValue = {
  timeRange: TimeRangeKey;
  dateRange: DateRange | undefined;
  setTimeRange: (key: TimeRangeKey) => void;
  setDateRange: (range: DateRange | undefined) => void;
  /** Resolve current filter bounds (relative ranges use "now"). */
  getBounds: () => TimeRangeBounds;
  refreshToken: number;
  triggerRefresh: () => void;
};

const STORAGE_KEY = "voiceai.timeRange";

type StoredTimeRange = {
  timeRange: TimeRangeKey;
  dateRange?: { from?: string; to?: string };
};

const VALID_KEYS: TimeRangeKey[] = ["1h", "6h", "24h", "7d", "30d", "custom"];

function loadStored(): { timeRange: TimeRangeKey; dateRange?: DateRange } {
  if (typeof window === "undefined") return { timeRange: "24h" };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { timeRange: "24h" };
    const parsed = JSON.parse(raw) as StoredTimeRange;
    const timeRange = VALID_KEYS.includes(parsed.timeRange) ? parsed.timeRange : "24h";
    let dateRange: DateRange | undefined;
    if (timeRange === "custom" && parsed.dateRange?.from) {
      const from = new Date(parsed.dateRange.from);
      const to = parsed.dateRange.to ? new Date(parsed.dateRange.to) : from;
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        dateRange = { from, to };
      }
    }
    if (timeRange === "custom" && !dateRange) {
      return { timeRange: "24h" };
    }
    return { timeRange, dateRange };
  } catch {
    return { timeRange: "24h" };
  }
}

function persist(timeRange: TimeRangeKey, dateRange: DateRange | undefined) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredTimeRange = {
      timeRange,
      ...(timeRange === "custom" && dateRange?.from
        ? {
            dateRange: {
              from: dateRange.from.toISOString(),
              to: (dateRange.to ?? dateRange.from).toISOString(),
            },
          }
        : {}),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

const TimeRangeContext = createContext<TimeRangeContextValue | null>(null);

export function resolveTimeRangeBounds(
  key: TimeRangeKey,
  custom?: DateRange
): TimeRangeBounds {
  const now = new Date();
  switch (key) {
    case "1h":
      return { after: subHours(now, 1) };
    case "6h":
      return { after: subHours(now, 6) };
    case "24h":
      return { after: subHours(now, 24) };
    case "7d":
      return { after: subDays(now, 7) };
    case "30d":
      return { after: subDays(now, 30) };
    case "custom":
      if (!custom?.from) return {};
      return {
        after: startOfDay(custom.from),
        before: endOfDay(custom.to ?? custom.from),
      };
    default:
      return { after: subHours(now, 24) };
  }
}

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRangeState] = useState<TimeRangeKey>("24h");
  const [dateRange, setDateRangeState] = useState<DateRange | undefined>();
  const [refreshToken, setRefreshToken] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    setTimeRangeState(stored.timeRange);
    setDateRangeState(stored.dateRange);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    persist(timeRange, dateRange);
  }, [timeRange, dateRange, ready]);

  const setTimeRange = useCallback((key: TimeRangeKey) => {
    setTimeRangeState(key);
    if (key !== "custom") setDateRangeState(undefined);
  }, []);

  const setDateRange = useCallback((range: DateRange | undefined) => {
    setDateRangeState(range);
    if (range?.from && range?.to) {
      setTimeRangeState("custom");
    }
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const getBounds = useCallback(
    () => resolveTimeRangeBounds(timeRange, dateRange),
    [timeRange, dateRange]
  );

  const value = useMemo(
    () => ({
      timeRange,
      dateRange,
      setTimeRange,
      setDateRange,
      getBounds,
      refreshToken,
      triggerRefresh,
    }),
    [timeRange, dateRange, setTimeRange, setDateRange, getBounds, refreshToken, triggerRefresh]
  );

  return <TimeRangeContext.Provider value={value}>{children}</TimeRangeContext.Provider>;
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) {
    throw new Error("useTimeRange must be used within TimeRangeProvider");
  }
  return ctx;
}

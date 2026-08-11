import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import {
  DEFAULT_CALLS_LIMIT,
  MAX_CALLS_LIMIT,
  fetchCallsForPeriod,
} from "@/lib/server/twilioCalls";
import {
  aggregateCallMetrics,
  buildStatusBreakdown,
  buildTwilioAlerts,
  buildVolumeSeries,
  findLongestCall,
  healthScoreFromMetrics,
  pctChange,
} from "@/lib/server/overviewStats";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const ctx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(ctx)) return ctx.response;

  try {
    const client = getTwilioClientFromConfig(ctx.twilio);
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") || DEFAULT_CALLS_LIMIT),
      MAX_CALLS_LIMIT
    );
    const startTimeAfter = parseDateParam(request.nextUrl.searchParams.get("startTimeAfter"));
    const startTimeBefore = parseDateParam(request.nextUrl.searchParams.get("startTimeBefore"));

    const end = startTimeBefore ?? new Date();
    const start = startTimeAfter ?? new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const windowMs = Math.max(60_000, end.getTime() - start.getTime());
    const prevEnd = start;
    const prevStart = new Date(start.getTime() - windowMs);

    const [current, previous] = await Promise.all([
      fetchCallsForPeriod(client, {
        after: startTimeAfter,
        before: startTimeBefore,
        limit,
        includeActive: true,
      }),
      fetchCallsForPeriod(client, {
        after: prevStart,
        before: prevEnd,
        limit: Math.min(limit, DEFAULT_CALLS_LIMIT),
        includeActive: false,
      }),
    ]);

    const metrics = aggregateCallMetrics(current.items);
    const prevMetrics = aggregateCallMetrics(previous.items);
    const longestCall = findLongestCall(current.items);
    const volume = buildVolumeSeries(current.items, start, end);
    const statusBreakdown = buildStatusBreakdown(metrics);
    const alerts = buildTwilioAlerts(current.items, metrics);
    const healthScore = healthScoreFromMetrics(metrics);

    return NextResponse.json({
      source: "twilio",
      truncated: current.truncated,
      filter: {
        startTimeAfter: start.toISOString(),
        startTimeBefore: end.toISOString(),
      },
      metrics,
      longestCall,
      changes: {
        totalCalls: pctChange(metrics.totalCalls, prevMetrics.totalCalls),
        successRate: pctChange(metrics.successRate, prevMetrics.successRate),
        avgDuration: pctChange(metrics.avgDuration, prevMetrics.avgDuration),
        costTotal: pctChange(metrics.costTotal, prevMetrics.costTotal),
      },
      volume,
      statusBreakdown,
      alerts,
      healthScore,
      telephonyCost: {
        category: "Telephony (Twilio)",
        rangeTotal: metrics.costTotal,
        daily: metrics.costTotal,
        monthly: metrics.costTotal,
        trend: pctChange(metrics.costTotal, prevMetrics.costTotal) ?? 0,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build Twilio overview";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}

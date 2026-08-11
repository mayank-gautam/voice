export type LogEventLike = {
  timestamp: number;
  message: string;
  logStreamName: string;
  logGroupName?: string;
};

export type MapNodeStatus = "healthy" | "degraded" | "down";

export type ServiceMapNode = {
  id: string;
  name: string;
  eventCount: number;
  errorCount: number;
  warnCount: number;
  errorRate: number;
  status: MapNodeStatus;
  firstTs: number;
  lastTs: number;
  /** Layout position in SVG space */
  x: number;
  y: number;
};

export type ServiceMapEdge = {
  from: string;
  to: string;
  count: number;
  errorRate: number;
};

export type CallServiceMap = {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
  eventCount: number;
  durationMs: number;
};

function inferLevel(message: string): "info" | "warn" | "error" | "debug" {
  const m = message.toLowerCase();
  if (/\berror\b|\bfatal\b|\bexception\b|\bfailed\b/.test(m)) return "error";
  if (/\bwarn\b|\bwarning\b/.test(m)) return "warn";
  if (/\bdebug\b|\btrace\b/.test(m)) return "debug";
  return "info";
}

/** Prefer JSON service field, then log group leaf, then stream. */
export function inferServiceName(e: LogEventLike): string {
  const raw = e.message?.trim() ?? "";
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const key of ["service", "serviceName", "svc", "component", "logger", "app", "application"]) {
        const v = parsed[key];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    } catch {
      /* fall through */
    }
  }

  const group = e.logGroupName?.trim();
  if (group) {
    // Insights @log is often `accountId:/aws/lambda/name`
    const normalized = group.includes(":") && group.includes("/")
      ? group.replace(/^\d+:/, "")
      : group;
    const parts = normalized.split("/").filter(Boolean);
    const leaf = parts[parts.length - 1] || normalized;
    if (leaf && leaf.toLowerCase() !== "cloudwatch") return leaf;
  }

  const stream = e.logStreamName?.trim();
  if (stream) {
    // Lambda streams look like `2024/01/15/[$LATEST]uuid` — prefer group leaf instead,
    // but if we only have stream, take a readable segment.
    if (!/^\d{4}\/\d{2}\/\d{2}\//.test(stream)) {
      const streamParts = stream.split("/").filter(Boolean);
      return streamParts[streamParts.length - 1] || stream;
    }
    return stream;
  }

  return "unknown";
}

function statusFromRates(errorRate: number, warnCount: number, eventCount: number): MapNodeStatus {
  if (errorRate >= 25 || (eventCount > 0 && errorRate >= 10 && errorRate > 0)) return "down";
  if (errorRate > 0 || warnCount > 0) return "degraded";
  return "healthy";
}

/** Layout nodes in rows of up to 4, left-to-right by first-seen time. */
function layoutNodes(
  orderedIds: string[],
  stats: Map<
    string,
    {
      eventCount: number;
      errorCount: number;
      warnCount: number;
      firstTs: number;
      lastTs: number;
    }
  >
): ServiceMapNode[] {
  const colW = 180;
  const rowH = 110;
  const padX = 80;
  const padY = 70;
  const cols = Math.min(4, Math.max(1, orderedIds.length));

  return orderedIds.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const s = stats.get(id)!;
    const errorRate = s.eventCount ? (s.errorCount / s.eventCount) * 100 : 0;
    return {
      id,
      name: id,
      eventCount: s.eventCount,
      errorCount: s.errorCount,
      warnCount: s.warnCount,
      errorRate: Math.round(errorRate * 10) / 10,
      status: statusFromRates(errorRate, s.warnCount, s.eventCount),
      firstTs: s.firstTs,
      lastTs: s.lastTs,
      x: padX + col * colW,
      y: padY + row * rowH,
    };
  });
}

/**
 * Build a service topology from call logs:
 * - Nodes = distinct services
 * - Edges = consecutive service transitions in time order
 */
export function buildServiceMapFromLogs(events: LogEventLike[]): CallServiceMap {
  if (!events.length) {
    return { nodes: [], edges: [], eventCount: 0, durationMs: 0 };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const stats = new Map<
    string,
    { eventCount: number; errorCount: number; warnCount: number; firstTs: number; lastTs: number }
  >();
  const order: string[] = [];
  const edgeCounts = new Map<string, { count: number; errors: number }>();

  let prevService: string | null = null;

  for (const e of sorted) {
    const service = inferServiceName(e);
    const level = inferLevel(e.message);
    let s = stats.get(service);
    if (!s) {
      s = {
        eventCount: 0,
        errorCount: 0,
        warnCount: 0,
        firstTs: e.timestamp,
        lastTs: e.timestamp,
      };
      stats.set(service, s);
      order.push(service);
    }
    s.eventCount += 1;
    if (level === "error") s.errorCount += 1;
    if (level === "warn") s.warnCount += 1;
    s.lastTs = e.timestamp;

    if (prevService && prevService !== service) {
      const key = `${prevService}→${service}`;
      const edge = edgeCounts.get(key) || { count: 0, errors: 0 };
      edge.count += 1;
      if (level === "error") edge.errors += 1;
      edgeCounts.set(key, edge);
    }
    prevService = service;
  }

  const nodes = layoutNodes(order, stats);
  const edges: ServiceMapEdge[] = [...edgeCounts.entries()].map(([key, v]) => {
    const [from, to] = key.split("→");
    return {
      from,
      to,
      count: v.count,
      errorRate: v.count ? Math.round((v.errors / v.count) * 1000) / 10 : 0,
    };
  });

  const first = sorted[0].timestamp;
  const last = sorted[sorted.length - 1].timestamp;

  return {
    nodes,
    edges,
    eventCount: events.length,
    durationMs: Math.max(0, last - first),
  };
}

export function serviceMapViewBox(nodes: ServiceMapNode[]): { width: number; height: number } {
  if (!nodes.length) return { width: 640, height: 280 };
  const maxX = Math.max(...nodes.map((n) => n.x)) + 100;
  const maxY = Math.max(...nodes.map((n) => n.y)) + 80;
  return { width: Math.max(640, maxX), height: Math.max(280, maxY) };
}

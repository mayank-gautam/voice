"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Network,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  buildServiceMapFromLogs,
  serviceMapViewBox,
  type LogEventLike,
  type MapNodeStatus,
  type ServiceMapNode,
} from "@/lib/serviceMapFromLogs";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: string;
  events: LogEventLike[];
  hasMore?: boolean;
};

const statusDot: Record<MapNodeStatus, string> = {
  healthy: "bg-chart-success",
  degraded: "bg-chart-warning",
  down: "bg-destructive",
};

const statusBorder: Record<MapNodeStatus, string> = {
  healthy: "border-chart-success/40",
  degraded: "border-chart-warning/40",
  down: "border-destructive/40",
};

export function CallLogServiceMapModal({
  open,
  onOpenChange,
  callId,
  events,
  hasMore,
}: Props) {
  const map = useMemo(() => buildServiceMapFromLogs(events), [events]);
  const { width, height } = serviceMapViewBox(map.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected: ServiceMapNode | null =
    map.nodes.find((n) => n.id === (selectedId || map.nodes[0]?.id)) || null;

  const nodeById = useMemo(() => {
    const m = new Map<string, ServiceMapNode>();
    for (const n of map.nodes) m.set(n.id, n);
    return m;
  }, [map.nodes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Service Map
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Built from logs for {callId}
            {map.eventCount > 0
              ? ` · ${map.eventCount}${hasMore ? "+" : ""} events · ${map.nodes.length} services`
              : ""}
            {hasMore ? " · load more logs for a fuller map" : ""}
          </DialogDescription>
        </DialogHeader>

        {map.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <AlertCircle className="w-8 h-8 opacity-50" />
            <p className="text-sm">No log events loaded yet to build a service map.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-chart-success" /> Healthy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-chart-warning" /> Degraded
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" /> Errors
              </span>
              <span className="text-muted-foreground/80 ml-auto flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Span {map.durationMs}ms
              </span>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 overflow-x-auto">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full min-h-[280px]"
                style={{ maxHeight: 420 }}
              >
                <defs>
                  <marker
                    id="call-log-map-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" opacity="0.6" />
                  </marker>
                </defs>

                {map.edges.map((e, i) => {
                  const from = nodeById.get(e.from);
                  const to = nodeById.get(e.to);
                  if (!from || !to) return null;
                  const isHot = e.errorRate > 10;
                  return (
                    <g key={`${e.from}-${e.to}-${i}`}>
                      <line
                        x1={from.x + 50}
                        y1={from.y}
                        x2={to.x - 50}
                        y2={to.y}
                        stroke={
                          isHot ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"
                        }
                        strokeWidth={isHot ? 2 : 1.5}
                        strokeOpacity={isHot ? 0.85 : 0.4}
                        strokeDasharray={isHot ? "0" : "4 4"}
                        markerEnd="url(#call-log-map-arrow)"
                      />
                      <text
                        x={(from.x + to.x) / 2}
                        y={(from.y + to.y) / 2 - 8}
                        fill="hsl(var(--muted-foreground))"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        {e.count}×
                      </text>
                    </g>
                  );
                })}

                {map.nodes.map((n) => {
                  const isSel = selected?.id === n.id;
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x - 55}, ${n.y - 32})`}
                      onClick={() => setSelectedId(n.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        width="110"
                        height="64"
                        rx="10"
                        fill="hsl(var(--card))"
                        stroke={
                          isSel ? "hsl(var(--primary))" : "hsl(var(--border))"
                        }
                        strokeWidth={isSel ? 2 : 1}
                      />
                      <foreignObject x="0" y="0" width="110" height="64">
                        <div className="p-2 h-full flex flex-col justify-center gap-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn("w-2 h-2 rounded-full shrink-0", statusDot[n.status])}
                            />
                            <span className="text-[11px] font-semibold truncate" title={n.name}>
                              {n.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate pl-3.5">
                            {n.eventCount} logs · {n.errorRate}% err
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>
            </div>

            {selected && (
              <div
                className={cn(
                  "rounded-xl border bg-card/50 p-4 space-y-3",
                  statusBorder[selected.status]
                )}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Activity className="w-4 h-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold truncate">{selected.name}</h3>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {selected.status === "healthy" ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertCircle className="w-3 h-3 mr-1" />
                    )}
                    {selected.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Stat label="Events" value={String(selected.eventCount)} />
                  <Stat label="Errors" value={String(selected.errorCount)} />
                  <Stat label="Warnings" value={String(selected.warnCount)} />
                  <Stat label="Error rate" value={`${selected.errorRate}%`} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Edges are inferred from consecutive service transitions in the log timeline for
                  this Call SID.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {map.nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  className={cn(
                    "text-left p-2.5 rounded-lg border transition-colors",
                    selected?.id === n.id
                      ? "bg-primary/10 border-primary/40"
                      : "bg-muted/20 border-border/50 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate">{n.name}</span>
                    <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot[n.status])} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {n.eventCount} events · {n.errorRate}% err
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

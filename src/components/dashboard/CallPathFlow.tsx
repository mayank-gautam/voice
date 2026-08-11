import { useMemo, useState } from "react";
import {
  PhoneCall,
  Bot,
  User,
  Flag,
  ShieldCheck,
  CornerDownRight,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { TestCase } from "@/lib/testSuite";

export interface PathStep {
  key: string;
  actor: "system" | "ai" | "customer" | "outcome";
  title: string;
  detail?: string;
  branch?: boolean;
}

export const buildCallPath = (tc: TestCase): PathStep[] => {
  const steps: PathStep[] = [
    {
      key: "start",
      actor: "system",
      title: "Outbound call connected",
      detail: tc.preconditions.join(" · "),
    },
  ];

  const turns = Math.max(tc.expected_ai_questions.length, tc.customer_responses.length);
  for (let i = 0; i < turns; i++) {
    const q = tc.expected_ai_questions[i];
    const a = tc.customer_responses[i];
    if (q) {
      steps.push({ key: `ai-${i}`, actor: "ai", title: `Turn ${i + 1} — AI prompt`, detail: q });
    }
    if (a) {
      const negative = /^(no|\(silence\)|it is one two three)/i.test(a.trim());
      steps.push({
        key: `cx-${i}`,
        actor: "customer",
        title: negative ? `Turn ${i + 1} — Customer (branch)` : `Turn ${i + 1} — Customer`,
        detail: a,
        branch: negative,
      });
    }
  }

  steps.push({
    key: "outcome",
    actor: "outcome",
    title: "Expected outcome",
    detail: tc.expected_outcome,
  });

  return steps;
};

const actorMeta = {
  system: { icon: PhoneCall, label: "Telephony", dot: "bg-info", text: "text-info" },
  ai: { icon: Bot, label: "AI Agent", dot: "bg-primary", text: "text-primary" },
  customer: { icon: User, label: "Customer", dot: "bg-muted-foreground", text: "text-foreground" },
  outcome: { icon: Flag, label: "Outcome", dot: "bg-chart-success", text: "text-chart-success" },
} as const;

// layout constants (service-map style topology)
const NODE_W = 150;
const NODE_H = 62;
const COL_GAP = 40;
const ROW_GAP = 26;
const PER_ROW = 3;

export const CallPathFlow = ({ tc }: { tc: TestCase }) => {
  const steps = useMemo(() => buildCallPath(tc), [tc]);
  const [selectedKey, setSelectedKey] = useState<string>(steps[0]?.key ?? "");
  const selected = steps.find((s) => s.key === selectedKey) ?? steps[0];

  const positions = steps.map((s, i) => {
    const row = Math.floor(i / PER_ROW);
    const idxInRow = i % PER_ROW;
    // serpentine layout so the path reads left→right, then right→left
    const col = row % 2 === 0 ? idxInRow : PER_ROW - 1 - idxInRow;
    return {
      step: s,
      x: 10 + col * (NODE_W + COL_GAP),
      y: 10 + row * (NODE_H + ROW_GAP),
    };
  });

  const rows = Math.ceil(steps.length / PER_ROW);
  const width = 20 + PER_ROW * NODE_W + (PER_ROW - 1) * COL_GAP;
  const height = 20 + rows * NODE_H + (rows - 1) * ROW_GAP;

  const SelIcon = actorMeta[selected.actor].icon;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border px-2 py-1 font-mono">{tc.id}</span>
        <span className="rounded-full border border-border px-2 py-1">{tc.priority}</span>
        <span className="rounded-full border border-border px-2 py-1">{steps.length} nodes</span>
        <span className="rounded-full border border-border px-2 py-1">
          {steps.filter((s) => s.actor === "ai").length} AI turns
        </span>
        <span className="rounded-full border border-border px-2 py-1">
          {steps.filter((s) => s.branch).length} branch points
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Topology */}
        <div className="lg:col-span-3 rounded-lg border border-border/50 bg-card/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-primary" />
              Call Path Topology
            </div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> AI</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground" /> Customer</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-warning" /> Branch</span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minHeight: 200 }}>
              <defs>
                <marker id="cp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" fill="hsl(var(--muted-foreground))" opacity="0.6" />
                </marker>
              </defs>

              {positions.slice(0, -1).map((p, i) => {
                const n = positions[i + 1];
                const sameRow = p.y === n.y;
                const hot = n.step.branch;
                const stroke = hot ? "hsl(var(--chart-warning))" : "hsl(var(--muted-foreground))";
                const d = sameRow
                  ? `M ${p.x + (n.x > p.x ? NODE_W : 0)} ${p.y + NODE_H / 2} L ${n.x + (n.x > p.x ? 0 : NODE_W)} ${n.y + NODE_H / 2}`
                  : `M ${p.x + NODE_W / 2} ${p.y + NODE_H} L ${p.x + NODE_W / 2} ${p.y + NODE_H + ROW_GAP / 2} L ${n.x + NODE_W / 2} ${p.y + NODE_H + ROW_GAP / 2} L ${n.x + NODE_W / 2} ${n.y}`;
                return (
                  <path
                    key={`e-${i}`}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={hot ? 2 : 1.5}
                    strokeOpacity={hot ? 0.9 : 0.4}
                    strokeDasharray={hot ? "0" : "4 4"}
                    markerEnd="url(#cp-arrow)"
                  />
                );
              })}

              {positions.map(({ step, x, y }, i) => {
                const meta = actorMeta[step.actor];
                const Icon = meta.icon;
                const isSel = step.key === selectedKey;
                return (
                  <g
                    key={step.key}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedKey(step.key)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx="10"
                      fill="hsl(var(--card))"
                      stroke={
                        isSel
                          ? "hsl(var(--primary))"
                          : step.branch
                          ? "hsl(var(--chart-warning))"
                          : "hsl(var(--border))"
                      }
                      strokeWidth={isSel ? 2 : 1}
                    />
                    <circle cx="14" cy="14" r="4" className={meta.dot} fill="currentColor" />
                    <text x={NODE_W - 10} y="18" textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">
                      {i + 1}/{steps.length}
                    </text>
                    <foreignObject x="8" y="22" width={NODE_W - 16} height={NODE_H - 26}>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("w-4 h-4 shrink-0", meta.text)} />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold truncate">{step.title}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {step.branch ? "branch • " : ""}
                            {step.detail ?? meta.label}
                          </div>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Click any node to inspect the turn. Amber edges mark branch points.
          </p>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 rounded-lg border border-border/50 bg-card/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium flex items-center gap-2">
              <SelIcon className={cn("w-4 h-4", actorMeta[selected.actor].text)} />
              {selected.title}
            </div>
            <Badge variant="outline" className="capitalize text-[10px]">
              {actorMeta[selected.actor].label}
            </Badge>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Utterance / detail
            </div>
            <p className="text-xs">{selected.detail ?? "—"}</p>
          </div>

          {selected.branch && (
            <div className="rounded-lg border border-chart-warning/40 bg-chart-warning/10 p-3 text-xs flex gap-2">
              <CornerDownRight className="h-3.5 w-3.5 text-chart-warning shrink-0 mt-0.5" />
              Branch point — the flow diverges from the happy path here.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase">Step</div>
              <div className="text-sm font-semibold mt-0.5">
                {steps.findIndex((s) => s.key === selected.key) + 1} of {steps.length}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-[10px] text-muted-foreground uppercase">Priority</div>
              <div className="text-sm font-semibold mt-0.5">{tc.priority}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-chart-success" />
              Pass criteria
            </p>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {tc.pass_criteria.map((c) => (
                <li key={c} className="text-xs text-muted-foreground">
                  • {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

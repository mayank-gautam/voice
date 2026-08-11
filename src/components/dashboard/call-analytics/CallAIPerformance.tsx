import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Brain, Mic, Volume2, AudioWaveform } from "lucide-react";
import {
  aiComponents,
  agentDistribution,
  conversationTurns,
  latencyRanges,
  llmP,
  tokenTotals,
} from "@/lib/realCallAnalytics";

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const axis = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };

const turnSeries = conversationTurns.map((t) => ({
  turn: `#${t.index}`,
  llm: t.llmMs,
  tokensIn: t.tokensIn,
  tokensOut: t.tokensOut,
}));

const CompCard = ({
  icon,
  title,
  provider,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  provider: string;
  rows: [string, string][];
}) => (
  <div className="glass-card border border-border/50 rounded-lg p-3">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-semibold">{title}</span>
    </div>
    <p className="text-[11px] text-muted-foreground truncate mb-2">{provider}</p>
    <div className="space-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between text-[11px]">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium font-mono">{v}</span>
        </div>
      ))}
    </div>
  </div>
);

export const CallAIPerformance = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <CompCard
        icon={<Brain className="w-4 h-4" />}
        title="LLM"
        provider={`${aiComponents.llm.provider} · temp ${aiComponents.llm.temperature}`}
        rows={[
          ["avg / max", `${aiComponents.llm.avg} / ${aiComponents.llm.max} ms`],
          ["p90 / p95", `${llmP.p90} / ${llmP.p95} ms`],
          ["tokens in/out", `${tokenTotals.in.toLocaleString()} / ${tokenTotals.out.toLocaleString()}`],
        ]}
      />
      <CompCard
        icon={<Mic className="w-4 h-4" />}
        title="STT"
        provider={aiComponents.stt.provider}
        rows={[
          ["final latency", `${aiComponents.stt.finalLatencyMs} ms`],
          ["chunks", aiComponents.stt.chunksWritten.toLocaleString()],
          ["bytes", `${(aiComponents.stt.bytesWritten / 1e6).toFixed(2)} MB`],
        ]}
      />
      <CompCard
        icon={<Volume2 className="w-4 h-4" />}
        title="TTS"
        provider={aiComponents.tts.provider}
        rows={[
          ["avg / max", `${aiComponents.tts.avg} / ${aiComponents.tts.max} ms`],
          ["min", `${aiComponents.tts.min} ms`],
          ["speed / stab", `${aiComponents.tts.speed} / ${aiComponents.tts.stability}`],
        ]}
      />
      <CompCard
        icon={<AudioWaveform className="w-4 h-4" />}
        title="VAD"
        provider={aiComponents.vad.provider}
        rows={[
          ["avg / max", `${aiComponents.vad.avg} / ${aiComponents.vad.max} ms`],
          ["segments", String(aiComponents.vad.segments)],
          ["max speech", `${aiComponents.vad.maxSpeechMs} ms`],
        ]}
      />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* LLM latency per turn */}
      <div className="glass-card border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-1">LLM Latency per Turn</h3>
        <p className="text-[11px] text-muted-foreground mb-2">
          Avg {aiComponents.llm.avg} ms · p50 {llmP.p50} ms · p95 {llmP.p95} ms
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={turnSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="turn" tick={axis} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ms`} />
              <ReferenceLine y={aiComponents.llm.avg} stroke="hsl(var(--warning))" strokeDasharray="4 4" />
              <Bar dataKey="llm" name="LLM ms" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Token usage per turn */}
      <div className="glass-card border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-1">Token Usage per Turn</h3>
        <p className="text-[11px] text-muted-foreground mb-2">
          Total in {tokenTotals.in.toLocaleString()} · out {tokenTotals.out.toLocaleString()}
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={turnSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="turn" tick={axis} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={axis} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" height={24} formatter={(v) => <span className="text-xs">{v}</span>} />
              <Bar dataKey="tokensIn" name="Prompt" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              <Line dataKey="tokensOut" name="Completion" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency ranges */}
      <div className="glass-card border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Component Latency Range (min / avg / max)</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={latencyRanges} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="component" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ms`} />
              <Legend verticalAlign="top" height={24} formatter={(v) => <span className="text-xs">{v}</span>} />
              <Bar dataKey="min" name="Min" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="avg" name="Avg" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="max" name="Max" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent distribution */}
      <div className="glass-card border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-sm mb-3">Turns by Agent Flow</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={agentDistribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                {agentDistribution.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                verticalAlign="bottom"
                height={48}
                formatter={(v) => <span className="text-[10px]">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* Pipeline side metrics */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[
        ["Audio pipeline completions", String(aiComponents.audioPipeline.completions)],
        ["SNS messages published", String(aiComponents.sns.messagesPublished)],
        ["Silence warnings / resets", `${aiComponents.silence.warningsStarted} / ${aiComponents.silence.activityResets}`],
        ["Silence timeouts", String(aiComponents.silence.timeouts)],
      ].map(([k, v]) => (
        <div key={k} className="glass-card border border-border/50 rounded-lg p-3">
          <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
          <p className="text-lg font-bold">{v}</p>
        </div>
      ))}
    </div>
  </div>
);

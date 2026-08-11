"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, GitBranch, ChevronRight, ChevronDown, Clock, CheckCircle2, XCircle } from "lucide-react";

type Span = {
  id: string;
  name: string;
  service: "STT" | "LLM" | "Tool" | "TTS" | "Router";
  start: number;
  duration: number;
  status: "ok" | "error";
  attributes: Record<string, string | number>;
  children?: Span[];
};

const traces = [
  {
    id: "trace_8a92f1",
    callId: "call_2384",
    user: "user_482",
    intent: "check_balance",
    model: "gpt-4o-mini",
    promptVersion: "v12",
    duration: 1840,
    spans: 11,
    status: "ok" as const,
    timestamp: "2026-06-24T10:14:22Z",
  },
  {
    id: "trace_8a92f0",
    callId: "call_2383",
    user: "user_117",
    intent: "transfer_funds",
    model: "gpt-4o",
    promptVersion: "v12",
    duration: 3210,
    spans: 17,
    status: "error" as const,
    timestamp: "2026-06-24T10:13:58Z",
  },
  {
    id: "trace_8a92ef",
    callId: "call_2382",
    user: "user_991",
    intent: "speak_to_agent",
    model: "gpt-4o-mini",
    promptVersion: "v11",
    duration: 920,
    spans: 6,
    status: "ok" as const,
    timestamp: "2026-06-24T10:13:31Z",
  },
];

const spanTree: Span[] = [
  {
    id: "s1",
    name: "voice.session",
    service: "Router",
    start: 0,
    duration: 1840,
    status: "ok",
    attributes: { session: "sess_29", tenant: "acme" },
    children: [
      {
        id: "s2",
        name: "stt.transcribe",
        service: "STT",
        start: 20,
        duration: 180,
        status: "ok",
        attributes: { provider: "deepgram", wer: 0.04, confidence: 0.94 },
      },
      {
        id: "s3",
        name: "llm.completion",
        service: "LLM",
        start: 210,
        duration: 980,
        status: "ok",
        attributes: { model: "gpt-4o-mini", inputTokens: 412, outputTokens: 86, cost: 0.0021 },
        children: [
          {
            id: "s4",
            name: "tool.get_balance",
            service: "Tool",
            start: 430,
            duration: 320,
            status: "ok",
            attributes: { account: "***4821", latency_ms: 320 },
          },
        ],
      },
      {
        id: "s5",
        name: "tts.synthesize",
        service: "TTS",
        start: 1200,
        duration: 620,
        status: "ok",
        attributes: { provider: "elevenlabs", voice: "rachel", chars: 184 },
      },
    ],
  },
];

const serviceColor: Record<Span["service"], string> = {
  Router: "bg-chart-5",
  STT: "bg-chart-1",
  LLM: "bg-chart-4",
  Tool: "bg-chart-3",
  TTS: "bg-chart-2",
};

const SpanRow = ({ span, depth, total }: { span: Span; depth: number; total: number }) => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(false);
  const hasKids = !!span.children?.length;
  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 hover:bg-muted/40 rounded cursor-pointer text-xs",
          selected && "bg-muted/60"
        )}
        onClick={() => setSelected(!selected)}
      >
        <div style={{ width: depth * 16 }} />
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="w-4"
        >
          {hasKids ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : null}
        </button>
        <Badge variant="outline" className="text-[10px] py-0 h-5">{span.service}</Badge>
        <span className="font-mono w-48 truncate">{span.name}</span>
        <div className="flex-1 relative h-4 bg-muted/30 rounded">
          <div
            className={cn("absolute h-full rounded", serviceColor[span.service], span.status === "error" && "bg-destructive")}
            style={{ left: `${(span.start / total) * 100}%`, width: `${(span.duration / total) * 100}%` }}
          />
        </div>
        <span className="w-16 text-right font-mono text-muted-foreground">{span.duration}ms</span>
        {span.status === "ok" ? (
          <CheckCircle2 className="w-3 h-3 text-chart-success" />
        ) : (
          <XCircle className="w-3 h-3 text-destructive" />
        )}
      </div>
      {selected && (
        <div className="ml-12 mb-2 p-3 bg-muted/30 rounded-lg border border-border/50 text-xs font-mono">
          <pre className="whitespace-pre-wrap text-muted-foreground">{JSON.stringify(span.attributes, null, 2)}</pre>
        </div>
      )}
      {open && hasKids && span.children!.map((c) => (
        <SpanRow key={c.id} span={c} depth={depth + 1} total={total} />
      ))}
    </>
  );
};

const Traces = () => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(traces[0]);
  const total = spanTree[0].duration;

  const filtered = traces.filter(
    (t) =>
      !query ||
      t.id.includes(query) ||
      t.intent.includes(query) ||
      t.user.includes(query) ||
      t.model.includes(query)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Traces</h1>
          <p className="text-muted-foreground">Distributed trace waterfall across STT, LLM, tools and TTS</p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by trace id, intent, user, model..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline">model:gpt-4o</Button>
          <Button variant="outline">status:error</Button>
          <Button variant="outline">prompt:v12</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-medium">Recent traces</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-colors",
                    selected.id === t.id ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/50 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{t.id}</span>
                    <Badge variant={t.status === "ok" ? "secondary" : "destructive"} className="text-[10px]">
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{t.intent}</span>
                    <span>•</span>
                    <span>{t.model}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.duration}ms</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{t.spans} spans • {t.user}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                {selected.id}
                <Badge variant="outline" className="ml-2 text-[10px]">prompt {selected.promptVersion}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0.5">
                {spanTree.map((s) => (
                  <SpanRow key={s.id} span={s} depth={0} total={total} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">Click a span to inspect raw attributes.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Traces;

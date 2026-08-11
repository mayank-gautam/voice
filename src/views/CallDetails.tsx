"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Phone,
  Clock,
  User,
  Bot,
  MessageSquare,
  Activity,
  AlertCircle,
  CheckCircle,
  Zap,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { generateTranscript, traceSpans } from "@/lib/mockData";
import { format } from "date-fns";
import { CallAnalyticsOverview } from "@/components/dashboard/call-analytics/CallAnalyticsOverview";
import { CallAIPerformance } from "@/components/dashboard/call-analytics/CallAIPerformance";
import {
  CallTelephonyQuality,
  EMPTY_TELEPHONY,
  type TelephonyData,
} from "@/components/dashboard/call-analytics/CallTelephonyQuality";
import { CallConversationLog } from "@/components/dashboard/call-analytics/CallConversationLog";
import { CallDetailLoader } from "@/components/dashboard/call-analytics/CallDetailLoader";
import {
  conversationTurns,
  aiComponents,
  insuranceDetails,
  workflowFunnel,
  verificationChecklist,
} from "@/lib/realCallAnalytics";
import { useProjects } from "@/lib/projectConfig";

type CallRow = {
  id: string;
  timestamp: string;
  endTimestamp?: string | null;
  callerNumber: string;
  calleeNumber?: string;
  callType: "inbound" | "outbound";
  duration: number;
  status: "completed" | "failed" | "dropped" | "escalated" | "active";
  twilioStatus?: string;
  answeredBy?: string | null;
  forwardedFrom?: string | null;
  parentCallSid?: string | null;
  priceUnit?: string;
  agentSteps: number;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  hasTranscript: boolean;
  cost: string;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
};

const CallDetails = () => {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { activeId } = useProjects();

  const [call, setCall] = useState<CallRow | null>(null);
  const [loadingCall, setLoadingCall] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);
  const [telephony, setTelephony] = useState<TelephonyData>(EMPTY_TELEPHONY);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [telephonyAvailable, setTelephonyAvailable] = useState(false);
  const [telephonyLoading, setTelephonyLoading] = useState(false);
  const [telephonyError, setTelephonyError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const transcript = generateTranscript();
  const projectQs = activeId ? `projectId=${encodeURIComponent(activeId)}` : "";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoadingCall(true);
      setCallError(null);
      try {
        const qs = projectQs ? `?${projectQs}` : "";
        const res = await fetch(`/api/calls/${encodeURIComponent(id)}${qs}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok || !data.call) {
          throw new Error(data?.error?.message || "Call not found in Twilio");
        }
        if (!cancelled) setCall(data.call as CallRow);
      } catch (e) {
        if (!cancelled) {
          setCall(null);
          setCallError(e instanceof Error ? e.message : "Failed to load call from Twilio");
        }
      } finally {
        if (!cancelled) setLoadingCall(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, projectQs]);

  useEffect(() => {
    if (!id || !id.startsWith("CA")) {
      setTelephony(EMPTY_TELEPHONY);
      setQualityScore(null);
      setTelephonyAvailable(false);
      setAudioUrl(null);
      setTelephonyError(null);
      return;
    }

    let cancelled = false;
    const loadTelemetry = async () => {
      setTelephonyLoading(true);
      setTelephonyError(null);
      const qs = projectQs ? `?${projectQs}` : "";
      try {
        const [telRes, recRes] = await Promise.all([
          fetch(`/api/calls/${encodeURIComponent(id)}/telephony${qs}`, { credentials: "include" }),
          fetch(`/api/calls/${encodeURIComponent(id)}/recording${qs}`, { credentials: "include" }),
        ]);
        const telData = await telRes.json();
        let telErr: string | null = null;
        if (telRes.ok && telData.telephony) {
          if (!cancelled) {
            setTelephony(telData.telephony);
            setQualityScore(typeof telData.qualityScore === "number" ? telData.qualityScore : null);
            setTelephonyAvailable(true);
          }
        } else if (!cancelled) {
          const code = telData?.error?.code as string | undefined;
          telErr =
            code === "INSIGHTS_NOT_FOUND" || telRes.status === 404
              ? "Voice Insights summary is not available for this call yet (or Insights is not enabled)."
              : telData?.error?.message || "Telephony insights unavailable";
          setTelephony(EMPTY_TELEPHONY);
          setQualityScore(null);
          setTelephonyAvailable(false);
        }

        const recData = await recRes.json();
        let hasAudio = false;
        if (recRes.ok && recData.recording?.proxyUrl && !cancelled) {
          let url = recData.recording.proxyUrl as string;
          if (activeId && !url.includes("projectId=")) {
            url += `${url.includes("?") ? "&" : "?"}projectId=${encodeURIComponent(activeId)}`;
          }
          setAudioUrl(url);
          hasAudio = true;
        } else if (!cancelled) {
          setAudioUrl(null);
        }

        if (!cancelled) {
          if (telErr) {
            const audioNote = hasAudio ? "" : " Call recording is not available for this call.";
            setTelephonyError(`${telErr}${audioNote}`);
          } else if (!hasAudio) {
            setTelephonyError("Call recording is not available for this call.");
          } else {
            setTelephonyError(null);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setTelephonyError(e instanceof Error ? e.message : "Failed to load telephony");
          setTelephony(EMPTY_TELEPHONY);
          setQualityScore(null);
          setTelephonyAvailable(false);
        }
      } finally {
        if (!cancelled) setTelephonyLoading(false);
      }
    };

    void loadTelemetry();
    return () => {
      cancelled = true;
    };
  }, [id, activeId, projectQs]);

  if (loadingCall) {
    return (
      <DashboardLayout>
        <CallDetailLoader callId={id} />
      </DashboardLayout>
    );
  }

  if (!call) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Call not found</p>
          {callError && <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">{callError}</p>}
          <Button variant="ghost" onClick={() => router.push("/calls")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Calls
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalLatency = call.sttLatency + call.llmLatency + call.ttsLatency || 1;

  const handleDownloadTranscript = () => {
    const payload = {
      metadata: {
        callId: call.id,
        timestamp: call.timestamp,
        endTimestamp: call.endTimestamp ?? null,
        callType: call.callType,
        callerNumber: call.callerNumber,
        calleeNumber: call.calleeNumber ?? null,
        duration: call.duration,
        twilioStatus: call.twilioStatus ?? call.status,
        cost: call.cost,
        priceUnit: call.priceUnit ?? "USD",
        answeredBy: call.answeredBy ?? null,
        parentCallSid: call.parentCallSid ?? null,
        qualityScore,
        telephony: telephonyAvailable ? telephony : null,
        exportedAt: new Date().toISOString(),
        source: "twilio",
      },
      transcript,
      trace: traceSpans,
      analytics: {
        workflowFunnel,
        verificationChecklist,
        insuranceDetails,
        aiComponents,
        conversationTurns,
        note: "Conversation/AI sections are sample app analytics until log-derived data is wired.",
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${call.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Call JSON downloaded");
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3 animate-fade-in h-[calc(100vh-8.5rem)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/calls")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold font-mono leading-none">{call.id}</h1>
            <StatusBadge status={call.status} size="md" />
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(call.timestamp), "MMM d, yyyy HH:mm:ss")}
            {call.twilioStatus ? ` · ${call.twilioStatus}` : ""}
          </span>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Stat icon={<Phone className="w-3 h-3" />} label="Type" value={call.callType} />
            <Stat icon={<User className="w-3 h-3" />} label="From" value={call.callerNumber} mono />
            {call.calleeNumber && call.calleeNumber !== "—" && (
              <Stat icon={<Phone className="w-3 h-3" />} label="To" value={call.calleeNumber} mono />
            )}
            <Stat icon={<Clock className="w-3 h-3" />} label="Duration" value={formatDuration(call.duration)} />
            <Stat icon={<Zap className="w-3 h-3" />} label="Cost" value={`$${Number(call.cost || 0).toFixed(4)}`} />
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => router.push(`/calls/${call.id}/logs`)}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Logs &amp; Traces
            </Button>
            <Button variant="outline" size="sm" className="h-7" onClick={handleDownloadTranscript}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              JSON
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full justify-start shrink-0 overflow-x-auto">
            <TabsTrigger value="overview">Analytics Overview</TabsTrigger>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="ai">AI Performance</TabsTrigger>
            <TabsTrigger value="telephony">Telephony Quality</TabsTrigger>
            <TabsTrigger value="trace">Trace &amp; Latency</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 min-h-0 mt-2 overflow-y-auto scrollbar-thin">
            <CallAnalyticsOverview
              call={call}
              qualityScore={qualityScore}
              telephony={telephony}
              telephonyAvailable={telephonyAvailable}
            />
          </TabsContent>

          <TabsContent value="conversation" className="flex-1 min-h-0 mt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full min-h-0">
              <div className="glass-card border border-border/50 rounded-xl flex flex-col min-h-0">
                <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-sm">Conversation Transcript</h3>
                  <Button variant="ghost" size="sm" className="h-7" onClick={handleDownloadTranscript}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export
                  </Button>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto scrollbar-thin flex-1 min-h-0">
                  <p className="text-[11px] text-muted-foreground px-1">
                    Sample transcript — Twilio does not store conversation text on the Call resource.
                  </p>
                  {transcript.map((turn, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-3",
                        turn.role === "agent" && "justify-start",
                        turn.role === "user" && "justify-end",
                        turn.role === "system" && "justify-center"
                      )}
                    >
                      {turn.role === "system" ? (
                        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                          {turn.content}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "max-w-[80%] rounded-xl p-2.5",
                            turn.role === "agent" ? "bg-secondary" : "bg-primary text-primary-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {turn.role === "agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            <span className="text-xs font-medium capitalize">{turn.role}</span>
                            <span className="text-xs opacity-60">+{turn.timestamp}s</span>
                          </div>
                          <p className="text-sm">{turn.content}</p>
                          <div className="mt-1.5 pt-1.5 border-t border-border/20 flex flex-wrap gap-x-3 gap-y-1">
                            {turn.sttConfidence && (
                              <span className="flex items-center gap-1 text-[11px] opacity-70">
                                <CheckCircle className="w-3 h-3" />
                                {(turn.sttConfidence * 100).toFixed(0)}%
                              </span>
                            )}
                            {turn.llmLatency && (
                              <span className="flex items-center gap-1 text-[11px] opacity-70">
                                <Zap className="w-3 h-3" />
                                LLM {turn.llmLatency}ms
                              </span>
                            )}
                            {turn.ttsLatency && (
                              <span className="flex items-center gap-1 text-[11px] opacity-70">
                                <MessageSquare className="w-3 h-3" />
                                TTS {turn.ttsLatency}ms
                              </span>
                            )}
                            {turn.intent && (
                              <span className="flex items-center gap-1 text-[11px] opacity-70">
                                <Activity className="w-3 h-3" />
                                {turn.intent}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <CallConversationLog />
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 min-h-0 mt-2 overflow-y-auto scrollbar-thin">
            <CallAIPerformance />
          </TabsContent>

          <TabsContent value="telephony" className="flex-1 min-h-0 mt-2 overflow-y-auto scrollbar-thin space-y-3">
            <CallTelephonyQuality
              telephony={telephony}
              qualityScore={qualityScore ?? 0}
              loading={telephonyLoading}
              error={telephonyError}
              audioUrl={audioUrl}
            />
          </TabsContent>

          <TabsContent value="trace" className="flex-1 min-h-0 mt-2 overflow-y-auto scrollbar-thin space-y-3">
            <div className="glass-card border border-border/50 rounded-xl p-4">
              <h3 className="font-semibold text-sm mb-3">Latency Chain</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                Sample AI latency breakdown — not provided by Twilio Call Insights.
              </p>
              <div className="h-8 bg-muted rounded-lg overflow-hidden flex">
                <div
                  className="h-full bg-chart-1 flex items-center justify-center text-xs font-medium text-primary-foreground"
                  style={{ width: `${(call.sttLatency / totalLatency) * 100}%` }}
                >
                  STT
                </div>
                <div
                  className="h-full bg-chart-4 flex items-center justify-center text-xs font-medium text-primary-foreground"
                  style={{ width: `${(call.llmLatency / totalLatency) * 100}%` }}
                >
                  LLM
                </div>
                <div
                  className="h-full bg-chart-2 flex items-center justify-center text-xs font-medium text-primary-foreground"
                  style={{ width: `${(call.ttsLatency / totalLatency) * 100}%` }}
                >
                  TTS
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>STT: {call.sttLatency}ms</span>
                <span>LLM: {call.llmLatency}ms</span>
                <span>TTS: {call.ttsLatency}ms</span>
              </div>
            </div>

            <div className="glass-card border border-border/50 rounded-xl">
              <div className="px-4 py-2.5 border-b border-border/50">
                <h3 className="font-semibold text-sm">Distributed Trace</h3>
              </div>
              <div className="p-4 space-y-2">
                {traceSpans.map((span) => (
                  <div key={span.id} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-muted-foreground truncate">{span.service}</div>
                    <div className="flex-1 relative h-5">
                      <div
                        className="absolute h-full bg-primary/20 rounded"
                        style={{
                          left: `${(span.start / 800) * 100}%`,
                          width: `${(span.duration / 800) * 100}%`,
                        }}
                      >
                        <div
                          className={cn("h-full rounded", span.status === "ok" ? "bg-primary" : "bg-destructive")}
                        />
                      </div>
                    </div>
                    <div className="w-14 text-xs text-right font-mono">{span.duration}ms</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

const Stat = ({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-card border border-border/50">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
    <span className={cn("text-xs font-medium capitalize", mono && "font-mono normal-case")}>{value}</span>
  </div>
);

export default CallDetails;

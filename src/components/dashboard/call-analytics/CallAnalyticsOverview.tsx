"use client";

import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, FileText, Flag } from "lucide-react";
import {
  workflowFunnel,
  verificationChecklist,
  insuranceDetails,
  tokenTotals,
  aiComponents,
  gradeJitter,
  gradeLoss,
  gradeLatency,
} from "@/lib/realCallAnalytics";
import { cn } from "@/lib/utils";
import type { TelephonyData } from "@/components/dashboard/call-analytics/CallTelephonyQuality";

export type OverviewCall = {
  id: string;
  timestamp: string;
  endTimestamp?: string | null;
  callerNumber: string;
  calleeNumber?: string;
  callType: "inbound" | "outbound";
  duration: number;
  status: string;
  twilioStatus?: string;
  answeredBy?: string | null;
  forwardedFrom?: string | null;
  parentCallSid?: string | null;
  cost: string;
  priceUnit?: string;
};

type QualityFlag = { label: string; state: "good" | "warning"; detail: string };

const KPI = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div className="glass-card border border-border/50 rounded-lg p-3">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("text-xl font-bold mt-0.5", tone)}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

const statusTone: Record<string, string> = {
  completed: "text-success",
  exception: "text-warning",
  closure: "text-info",
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function scoreTone(score: number | null) {
  if (score == null) return undefined;
  if (score >= 90) return "text-success";
  if (score >= 75) return "text-info";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function buildTwilioQualityFlags(telephony: TelephonyData | null): QualityFlag[] {
  if (!telephony) return [];
  const maxJitter = Math.max(telephony.inbound.jitterMaxMs, telephony.outbound.jitterMaxMs);
  const maxLoss = Math.max(telephony.inbound.lossPct, telephony.outbound.lossPct);
  const jitterLevel = gradeJitter(maxJitter);
  const lossLevel = gradeLoss(maxLoss);
  const pddLevel = gradeLatency(telephony.pddMs);

  return [
    {
      label: lossLevel === "good" ? "Low packet loss" : "Elevated packet loss",
      state: lossLevel === "good" ? "good" : "warning",
      detail: `${maxLoss.toFixed(4)}% max across legs`,
    },
    {
      label: jitterLevel === "good" ? "Jitter within threshold" : "Jitter above threshold",
      state: jitterLevel === "good" ? "good" : "warning",
      detail: `max ${maxJitter.toFixed(2)} ms`,
    },
    {
      label: pddLevel === "good" ? "PDD within threshold" : "PDD above 150 ms",
      state: pddLevel === "good" ? "good" : "warning",
      detail: `${telephony.pddMs} ms`,
    },
    {
      label: "Disconnected by",
      state: "good",
      detail: telephony.disconnectedBy || "unknown",
    },
    {
      label: "Last SIP response",
      state: telephony.lastSipResponse >= 400 ? "warning" : "good",
      detail: String(telephony.lastSipResponse || "—"),
    },
    {
      label: "Media path",
      state: telephony.edgeLocation ? "good" : "warning",
      detail: telephony.edgeLocation
        ? `${telephony.edgeLocation} · ${telephony.mediaRegion || "—"} · ${telephony.codec || "—"}`
        : "Edge location unavailable",
    },
  ];
}

interface Props {
  call: OverviewCall;
  qualityScore?: number | null;
  telephony?: TelephonyData | null;
  telephonyAvailable?: boolean;
}

export const CallAnalyticsOverview = ({
  call,
  qualityScore = null,
  telephony = null,
  telephonyAvailable = false,
}: Props) => {
  const costNum = Number(call.cost) || 0;
  const pickedUp = call.duration > 0 || ["completed", "busy", "failed", "no-answer"].includes(call.twilioStatus || "");
  const transferred = Boolean(call.parentCallSid || call.forwardedFrom);
  const accountEnd = call.twilioStatus || call.status;
  const callEnd = call.endTimestamp ? "Ended" : call.duration > 0 ? "Ended" : accountEnd;
  const flags = telephonyAvailable && telephony ? buildTwilioQualityFlags(telephony) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPI
          label="Quality Score"
          value={qualityScore != null ? `${qualityScore}/100` : "—"}
          sub={telephonyAvailable ? "Jitter + loss + PDD" : "Insights unavailable"}
          tone={scoreTone(qualityScore)}
        />
        <KPI label="Duration" value={formatDuration(call.duration)} sub={call.callType} />
        <KPI
          label="Telephony Cost"
          value={`$${costNum.toFixed(4)}`}
          sub={`Twilio billed${call.priceUnit ? ` · ${call.priceUnit}` : ""}`}
        />
        <KPI
          label="From / To"
          value={call.callerNumber}
          sub={call.calleeNumber && call.calleeNumber !== "—" ? `→ ${call.calleeNumber}` : undefined}
        />
        <KPI label="Pickup" value={pickedUp ? "Yes" : "No"} sub={call.answeredBy ? `Answered by ${call.answeredBy}` : undefined} />
        <KPI
          label="Transfer"
          value={transferred ? "Yes" : "No"}
          tone={transferred ? "text-warning" : "text-success"}
          sub={call.parentCallSid ? `Parent ${call.parentCallSid}` : call.forwardedFrom || undefined}
        />
        <KPI label="Twilio Status" value={accountEnd} />
        <KPI label="Call End" value={callEnd} />
      </div>

      {flags.length > 0 && (
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Flag className="w-4 h-4 text-primary" /> Twilio Quality Flags
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {flags.map((f) => (
              <div
                key={f.label}
                className={cn(
                  "rounded-lg border p-2.5",
                  f.state === "good" ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
                )}
              >
                <p className={cn("text-xs font-medium", f.state === "good" ? "text-success" : "text-warning")}>{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground px-0.5">
        Sections below are sample application analytics (not from Twilio). Twilio call + Voice Insights drive the KPIs above and the Telephony tab.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass-card border border-border/50 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Workflow Funnel
            <span className="text-[10px] font-normal text-muted-foreground">(sample)</span>
          </h3>
          <ol className="space-y-2">
            {workflowFunnel.map((s, i) => (
              <li key={s.stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                      s.status === "completed" && "border-success/50 bg-success/15 text-success",
                      s.status === "exception" && "border-warning/50 bg-warning/15 text-warning",
                      s.status === "closure" && "border-info/50 bg-info/15 text-info"
                    )}
                  >
                    {i + 1}
                  </span>
                  {i < workflowFunnel.length - 1 && <span className="flex-1 w-px bg-border my-1" />}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-medium">
                    {s.stage} <span className={cn("font-normal", statusTone[s.status])}>· {s.status}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.evidence}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-3">
          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Verification & Business Outcome
              <span className="text-[10px] font-normal text-muted-foreground">(sample)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {verificationChecklist.map((v) => (
                <div key={v.item} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground truncate">{v.item}</span>
                  <span className={cn("flex items-center gap-1 font-medium shrink-0", v.ok ? "text-success" : "text-destructive")}>
                    {v.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span className="truncate max-w-[9rem]">{v.result}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card border border-border/50 rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">
              Insurance Details Collected <span className="text-[10px] font-normal text-muted-foreground">(sample)</span>
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {[
                ["Provider", insuranceDetails.insuranceCompanyName],
                ["Policy holder", insuranceDetails.policyHolder],
                ["Holder DOB", insuranceDetails.policyHolderDob],
                ["Policy #", insuranceDetails.policyNo],
                ["Group #", insuranceDetails.groupNo],
                ["Effective date", insuranceDetails.effectiveDate],
                ["Service date", insuranceDetails.serviceDate],
                ["Primary insurance", insuranceDetails.primaryInsurance],
                ["Workers comp", insuranceDetails.workersComp],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs rounded-lg border border-destructive/40 bg-destructive/10 p-2">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
              <span>{insuranceDetails.validation}</span>
            </div>
          </div>

          <div className="glass-card border border-border/50 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">LLM Turns (sample)</p>
            <p className="text-xl font-bold mt-0.5">{aiComponents.llm.responses}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {(tokenTotals.in + tokenTotals.out).toLocaleString()} tokens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

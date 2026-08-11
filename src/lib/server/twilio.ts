import twilio from "twilio";
import type { TwilioEnvConfig } from "./twilioEnv";
import {
  inferEnvTagFromTexts,
  type CallEnvTag,
} from "@/lib/callEnvTag";

export type { CallEnvTag };

export function getTwilioClientFromConfig(config: TwilioEnvConfig) {
  return twilio(config.accountSid, config.authToken, {
    region: config.region,
    edge: config.edge,
  });
}

export type CallListItem = {
  id: string;
  timestamp: string;
  endTimestamp: string | null;
  callerNumber: string;
  calleeNumber: string;
  callType: "inbound" | "outbound";
  duration: number;
  status: "completed" | "failed" | "dropped" | "escalated" | "active";
  twilioStatus: string;
  answeredBy: string | null;
  forwardedFrom: string | null;
  parentCallSid: string | null;
  priceUnit: string;
  /** From Request Inspector webhook URL (uat/dev/prod). null = unknown / not yet enriched. */
  envTag: CallEnvTag | null;
  agentSteps: number;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  hasTranscript: boolean;
  cost: string;
  sttLatency: number;
  llmLatency: number;
  ttsLatency: number;
};

function mapTwilioStatus(status?: string): CallListItem["status"] {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "completed";
    case "busy":
    case "failed":
    case "canceled":
    case "cancelled":
      return "failed";
    case "no-answer":
      return "dropped";
    case "in-progress":
    case "ringing":
    case "queued":
      return "active";
    default:
      return "completed";
  }
}

function mapDirection(direction?: string): CallListItem["callType"] {
  const d = (direction || "").toLowerCase();
  return d.includes("outbound") ? "outbound" : "inbound";
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTwilioCall(call: any): CallListItem {
  const start = call.startTime || call.dateCreated;
  const end = call.endTime || null;
  const direction = mapDirection(call.direction);
  const from = call.from || "";
  const to = call.to || "";
  const forwardedFrom = call.forwardedFrom ? String(call.forwardedFrom) : null;
  // Cheap first pass from SIP / number URIs; Request Inspector enrichment fills gaps later
  const envTag = inferEnvTagFromTexts([from, to, forwardedFrom, call.uri]);
  return {
    id: call.sid,
    timestamp: toIso(start) || new Date().toISOString(),
    endTimestamp: toIso(end),
    callerNumber: direction === "inbound" ? from || to || "—" : from || "—",
    calleeNumber: direction === "inbound" ? to || "—" : to || "—",
    callType: direction,
    duration: Number(call.duration || 0),
    status: mapTwilioStatus(call.status),
    twilioStatus: String(call.status || ""),
    answeredBy: call.answeredBy ? String(call.answeredBy) : null,
    forwardedFrom,
    parentCallSid: call.parentCallSid ? String(call.parentCallSid) : null,
    priceUnit: call.priceUnit ? String(call.priceUnit) : "USD",
    envTag,
    agentSteps: 0,
    sentiment: "neutral",
    intent: "",
    hasTranscript: false,
    cost: call.price != null ? String(Math.abs(Number(call.price))) : "0",
    sttLatency: 0,
    llmLatency: 0,
    ttsLatency: 0,
  };
}

export type TelephonyPayload = {
  codec: string;
  mediaRegion: string;
  signalingRegion: string;
  edgeLocation: string;
  pddMs: number;
  disconnectedBy: string;
  lastSipResponse: number;
  inbound: { jitterAvgMs: number; jitterMaxMs: number; packets: number; lossPct: number };
  outbound: { jitterAvgMs: number; jitterMaxMs: number; packets: number; lossPct: number };
};

/** Empty telephony shell when Voice Insights is unavailable. */
export const emptyTelephony: TelephonyPayload = {
  codec: "",
  mediaRegion: "",
  signalingRegion: "",
  edgeLocation: "",
  pddMs: 0,
  disconnectedBy: "",
  lastSipResponse: 0,
  inbound: { jitterAvgMs: 0, jitterMaxMs: 0, packets: 0, lossPct: 0 },
  outbound: { jitterAvgMs: 0, jitterMaxMs: 0, packets: 0, lossPct: 0 },
};

function edgeMetrics(metrics: Record<string, unknown> | undefined, leg: "inbound" | "outbound") {
  const m = (metrics?.[leg] || {}) as {
    jitter?: { avg?: number; max?: number };
    packets_loss_percentage?: number;
    packets_received?: number;
    packets_sent?: number;
    codec_name?: string;
  };
  const packets = leg === "inbound" ? Number(m.packets_received ?? 0) : Number(m.packets_sent ?? 0);
  return {
    jitterAvgMs: Number(m.jitter?.avg ?? 0),
    jitterMaxMs: Number(m.jitter?.max ?? 0),
    packets,
    lossPct: Number(m.packets_loss_percentage ?? 0),
    codec: m.codec_name || "",
  };
}

/** Map Twilio Voice Insights summary → UI telephony shape + quality score 0–100. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapInsightsToTelephony(summary: any): { telephony: TelephonyPayload; qualityScore: number } {
  const sip = summary?.sip_edge || summary?.carrier_edge || {};
  const metrics = sip?.metrics || {};
  const props = sip?.properties || {};
  const callProps = summary?.properties || {};

  const inbound = edgeMetrics(metrics, "inbound");
  const outbound = edgeMetrics(metrics, "outbound");

  const telephony: TelephonyPayload = {
    codec: inbound.codec || outbound.codec || "unknown",
    mediaRegion: String(props.media_region || ""),
    signalingRegion: String(props.signaling_region || ""),
    edgeLocation: String(props.edge_location || ""),
    pddMs: Number(callProps.pdd_ms ?? 0),
    disconnectedBy: String(callProps.disconnected_by || "unknown"),
    lastSipResponse: Number(callProps.last_sip_response_num ?? 0),
    inbound: {
      jitterAvgMs: inbound.jitterAvgMs,
      jitterMaxMs: inbound.jitterMaxMs,
      packets: inbound.packets,
      lossPct: inbound.lossPct,
    },
    outbound: {
      jitterAvgMs: outbound.jitterAvgMs,
      jitterMaxMs: outbound.jitterMaxMs,
      packets: outbound.packets,
      lossPct: outbound.lossPct,
    },
  };

  const avgJitter = (telephony.inbound.jitterAvgMs + telephony.outbound.jitterAvgMs) / 2;
  const loss = Math.max(telephony.inbound.lossPct, telephony.outbound.lossPct);
  let score = 100;
  if (avgJitter > 30) score -= 10;
  if (avgJitter > 50) score -= 15;
  if (loss > 1) score -= 10;
  if (loss > 3) score -= 15;
  if (telephony.pddMs > 150) score -= 5;
  if (telephony.pddMs > 300) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { telephony, qualityScore: score };
}

export async function fetchVoiceInsightsSummary(
  twilioConfig: TwilioEnvConfig,
  callSid: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = `https://insights.twilio.com/v1/Voice/${encodeURIComponent(callSid)}/Summary?ProcessingState=complete`;
  const auth = Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    let twilioCode: number | undefined;
    let twilioMessage = text;
    try {
      const parsed = JSON.parse(text) as { code?: number; message?: string; status?: number };
      twilioCode = parsed.code;
      if (parsed.message) twilioMessage = parsed.message;
    } catch {
      // keep raw text
    }

    if (res.status === 404 || twilioCode === 20404) {
      throw Object.assign(
        new Error(
          "Voice Insights summary is not available for this call yet (or Insights is not enabled for this account)."
        ),
        { status: 404, code: "INSIGHTS_NOT_FOUND", twilioCode: 20404 }
      );
    }

    throw Object.assign(new Error(twilioMessage || `Insights API ${res.status}`), {
      status: res.status,
      code: "INSIGHTS_ERROR",
      twilioCode,
    });
  }
  return res.json();
}

// Twilio Voice Insights - types, derivations, and mock generator.
// Payload reference: https://insights.twilio.com/v1/Voice/{CallSid}/Summary

export interface TwilioInsights {
  accountSid: string;
  callSid: string;
  callType: "sip" | "pstn" | "trunking" | "client";
  callState: "completed" | "failed" | "busy" | "no-answer" | "canceled";
  createdTime: string;
  startTime: string;
  endTime: string;
  duration: number;
  connectDuration: number;
  from: { caller: string; connection: string };
  to: { callee: string; connection: string };
  sipEdge: {
    metrics: {
      inbound: EdgeMetrics;
      outbound: EdgeMetrics;
    };
    properties: {
      direction: "inbound" | "outbound";
      edge_location: string;
      external_media_ip: string;
      media_region: string;
      signaling_region: string;
      sip_call_id: string;
      twilio_media_ip: string;
      twilio_signaling_ip: string;
      user_agent: string;
    };
  };
  properties: {
    direction: "inbound" | "outbound";
    disconnected_by: "caller" | "callee" | "twilio" | "unknown";
    last_sip_response_num: number;
    pdd_ms: number;
  };
}

export interface EdgeMetrics {
  codec: number;
  codec_name: string;
  jitter: { avg: number; max: number };
  packets_loss_percentage: number;
  packets_lost: number;
  packets_received?: number;
  packets_sent?: number;
}

export interface DerivedQuality {
  mos: number; // 1..5
  rating: "Excellent" | "Good" | "Fair" | "Poor";
  ratingColor: string;
  pdd: number;
  ringMs: number;
  setupMs: number;
  avgJitter: number;
  maxJitter: number;
  lossPct: number;
  packetsSymmetryPct: number; // received/sent
}

const COLOR = {
  Excellent: "hsl(var(--success))",
  Good: "hsl(var(--chart-1))",
  Fair: "hsl(var(--warning))",
  Poor: "hsl(var(--destructive))",
};

export function deriveQuality(i: TwilioInsights): DerivedQuality {
  const inb = i.sipEdge.metrics.inbound;
  const outb = i.sipEdge.metrics.outbound;
  const avgJitter = (inb.jitter.avg + outb.jitter.avg) / 2;
  const maxJitter = Math.max(inb.jitter.max, outb.jitter.max);
  const lossPct = Math.max(inb.packets_loss_percentage, outb.packets_loss_percentage);
  const rcv = inb.packets_received ?? 0;
  const snt = outb.packets_sent ?? 0;
  const symmetry = snt > 0 ? Math.min(100, (rcv / snt) * 100) : 100;

  // Simplified E-model-ish MOS derivation from jitter (ms) + loss (%).
  let mos = 4.5;
  mos -= Math.min(1.5, avgJitter / 30);
  mos -= Math.min(2.0, lossPct * 0.4);
  mos = Math.max(1, Math.min(5, mos));

  const rating: DerivedQuality["rating"] =
    mos >= 4.2 ? "Excellent" : mos >= 3.6 ? "Good" : mos >= 2.8 ? "Fair" : "Poor";

  const setupMs =
    new Date(i.startTime).getTime() - new Date(i.createdTime).getTime();
  const ringMs = Math.max(0, setupMs - i.properties.pdd_ms);

  return {
    mos: Math.round(mos * 10) / 10,
    rating,
    ratingColor: COLOR[rating],
    pdd: i.properties.pdd_ms,
    ringMs,
    setupMs,
    avgJitter: Math.round(avgJitter * 100) / 100,
    maxJitter: Math.round(maxJitter * 100) / 100,
    lossPct: Math.round(lossPct * 100) / 100,
    packetsSymmetryPct: Math.round(symmetry * 10) / 10,
  };
}

// ---------------- Mock generators ----------------

const EDGE_LOCATIONS = ["ashburn", "dublin", "frankfurt", "sao-paulo", "singapore", "tokyo", "sydney"];
const CODECS = ["pcmu", "opus", "g722", "pcma"];
const DISCONNECT = ["caller", "callee", "twilio"] as const;
const SIP_RESP = [200, 200, 200, 200, 200, 486, 480, 503, 487, 408];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function mockInsightsForCall(callId: string, durationSec: number): TwilioInsights {
  const codec = rand(CODECS);
  const packets = Math.max(50, Math.floor(durationSec * 50));
  const lossPct = Math.random() < 0.8 ? Math.random() * 0.5 : Math.random() * 4;
  const lost = Math.floor((packets * lossPct) / 100);
  const jitterAvgIn = Math.random() * 12;
  const jitterAvgOut = Math.random() * 6;
  const start = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
  const created = new Date(start.getTime() - Math.floor(Math.random() * 3000));
  const end = new Date(start.getTime() + durationSec * 1000);
  const pdd = 60 + Math.floor(Math.random() * 250);
  const direction: "inbound" | "outbound" = Math.random() > 0.3 ? "inbound" : "outbound";
  const edge = rand(EDGE_LOCATIONS);
  const region = edge === "dublin" || edge === "frankfurt" ? "ie1"
    : edge === "sao-paulo" ? "br1"
    : edge === "singapore" ? "sg1"
    : edge === "tokyo" ? "jp1"
    : edge === "sydney" ? "au1"
    : "us1";

  return {
    accountSid: "ACmock",
    callSid: callId,
    callType: "sip",
    callState: "completed",
    createdTime: created.toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    duration: durationSec,
    connectDuration: durationSec - 1,
    from: { caller: "sip:+12345678900@10.1.123.53", connection: "sip_interface" },
    to: { callee: "sip:+incoming@sip.twilio.com:5061", connection: "sip_interface" },
    sipEdge: {
      metrics: {
        inbound: {
          codec: 0,
          codec_name: codec,
          jitter: { avg: jitterAvgIn, max: jitterAvgIn + Math.random() * 3 },
          packets_loss_percentage: lossPct,
          packets_lost: lost,
          packets_received: packets - lost,
        },
        outbound: {
          codec: 0,
          codec_name: codec,
          jitter: { avg: jitterAvgOut, max: jitterAvgOut + Math.random() * 1.5 },
          packets_loss_percentage: lossPct * 0.3,
          packets_lost: Math.floor(lost * 0.3),
          packets_sent: packets,
        },
      },
      properties: {
        direction,
        edge_location: edge,
        external_media_ip: "3.4.27.1",
        media_region: region,
        signaling_region: region,
        sip_call_id: `${callId}@10.1.123.53:5060`,
        twilio_media_ip: "18.8.1.69",
        twilio_signaling_ip: "5.1.6.3",
        user_agent: "Twilio-SIP",
      },
    },
    properties: {
      direction,
      disconnected_by: rand(DISCONNECT),
      last_sip_response_num: rand(SIP_RESP),
      pdd_ms: pdd,
    },
  };
}

// ---------- Aggregate helpers for fleet-wide dashboards ----------

export interface AggregateSummary {
  mosTrend: Array<{ time: string; mos: number }>;
  pddPercentiles: Array<{ time: string; p50: number; p90: number; p99: number }>;
  lossTrend: Array<{ time: string; loss: number }>;
  jitterHistogram: Array<{ bucket: string; inbound: number; outbound: number }>;
  codecMix: Array<{ name: string; value: number; color: string }>;
  edgeMix: Array<{ edge: string; calls: number }>;
  disconnectedBy: Array<{ name: string; value: number; color: string }>;
}

export function buildAggregate(samples: TwilioInsights[]): AggregateSummary {
  const now = Date.now();
  const mosTrend = Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, "0")}:00`,
    mos: Math.round((3.8 + Math.random() * 1.0) * 100) / 100,
  }));
  const pddPercentiles = Array.from({ length: 24 }, (_, i) => {
    const base = 90 + Math.random() * 60;
    return {
      time: `${String(i).padStart(2, "0")}:00`,
      p50: Math.round(base),
      p90: Math.round(base * 1.6),
      p99: Math.round(base * 2.4),
    };
  });
  const lossTrend = Array.from({ length: 24 }, (_, i) => ({
    time: `${String(i).padStart(2, "0")}:00`,
    loss: Math.round(Math.random() * 200) / 100,
  }));

  const buckets = ["0-1", "1-2", "2-5", "5-10", "10-20", "20+"];
  const jitterHistogram = buckets.map((b) => ({
    bucket: b,
    inbound: Math.floor(Math.random() * 400) + 50,
    outbound: Math.floor(Math.random() * 400) + 50,
  }));

  const codecCounts: Record<string, number> = {};
  const edgeCounts: Record<string, number> = {};
  const discCounts: Record<string, number> = { caller: 0, callee: 0, twilio: 0 };
  samples.forEach((s) => {
    const c = s.sipEdge.metrics.inbound.codec_name;
    codecCounts[c] = (codecCounts[c] || 0) + 1;
    const e = s.sipEdge.properties.edge_location;
    edgeCounts[e] = (edgeCounts[e] || 0) + 1;
    discCounts[s.properties.disconnected_by] = (discCounts[s.properties.disconnected_by] || 0) + 1;
  });

  const codecColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-6))"];
  const codecMix = Object.entries(codecCounts).map(([name, value], idx) => ({
    name: name.toUpperCase(),
    value,
    color: codecColors[idx % codecColors.length],
  }));

  const edgeMix = Object.entries(edgeCounts)
    .map(([edge, calls]) => ({ edge, calls }))
    .sort((a, b) => b.calls - a.calls);

  const disconnectedBy = [
    { name: "Caller", value: discCounts.caller, color: "hsl(var(--chart-1))" },
    { name: "Callee", value: discCounts.callee, color: "hsl(var(--chart-2))" },
    { name: "Twilio", value: discCounts.twilio, color: "hsl(var(--warning))" },
  ];

  void now;
  return { mosTrend, pddPercentiles, lossTrend, jitterHistogram, codecMix, edgeMix, disconnectedBy };
}

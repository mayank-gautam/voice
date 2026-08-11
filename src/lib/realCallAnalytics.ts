// Real call analytics derived from Twilio Insights + Application Log Analytics
// Source: "Voice Agent Call Analytics Dashboard & Outcome Report"
// Primary Call ID: CAdaf2b182907fd0bb8792865ba9f25385

export interface ConversationTurn {
  index: number;
  agent: string;
  userInput: string;
  botOutput: string;
  llmMs: number;
  tokensIn: number;
  tokensOut: number;
  disconnect: boolean;
}

export const realCall = {
  callId: "CAdaf2b182907fd0bb8792865ba9f25385",
  direction: "inbound",
  status: "completed",
  durationSec: 307,
  pickupFlag: true,
  rpcFlag: "yes",
  transferFlag: false,
  accountEndStatus: "Completed",
  callEndStatus: "End",
  telephonyCostUsd: 0.024,
  serviceDate: "2026-06-05",
  qualityScore: 96,
};

export const workflowFunnel = [
  { stage: "Call Received", status: "completed", evidence: "Inbound SIP call reached Twilio route and media stream started" },
  { stage: "Greeting", status: "completed", evidence: "Agent greeted customer and introduced insurance update purpose" },
  { stage: "Name Verification", status: "completed", evidence: "Customer confirmed identity with “yes it’s me”" },
  { stage: "Recording Consent", status: "completed", evidence: "Customer consented to proceed" },
  { stage: "DOB Verification", status: "completed", evidence: "Customer provided 16 March 1953" },
  { stage: "Address Verification", status: "completed", evidence: "Customer provided address and ZIP" },
  { stage: "Policy Holder Validation", status: "exception", evidence: "Customer was not primary policy holder, triggering collection flow" },
  { stage: "Insurance Collection", status: "closure", evidence: "Policy details collected; effective date after service date" },
  { stage: "Call Closure", status: "completed", evidence: "Agent closed the call and customer said goodbye" },
] as const;

export const verificationChecklist = [
  { item: "Customer reached", result: "Yes", ok: true },
  { item: "Name verified", result: "Yes", ok: true },
  { item: "Recording consent", result: "Yes", ok: true },
  { item: "DOB verified", result: "Yes", ok: true },
  { item: "Address verified", result: "Yes", ok: true },
  { item: "Authentication complete", result: "Yes", ok: true },
  { item: "Primary policy holder", result: "No", ok: false },
  { item: "Policy holder collected", result: "Yes", ok: true },
  { item: "Claim can proceed", result: "No — effective date after service date", ok: false },
];

export const insuranceDetails = {
  insuranceCompanyName: "United Healthcare",
  policyHolder: "Robert Johnson",
  policyHolderDob: "1980-06-10",
  policyNo: "uh123456",
  groupNo: "Not provided",
  effectiveDate: "2026-07-10",
  serviceDate: "2026-06-05",
  workersComp: "No",
  primaryInsurance: "No",
  validation: "Claim cannot proceed — policy effective after service date",
};

export const aiComponents = {
  llm: {
    provider: "openai/gpt-oss-120b",
    temperature: 0.3,
    responses: 26,
    min: 0,
    avg: 686,
    max: 1309,
  },
  stt: {
    provider: "Azure Speech to Text",
    bytesWritten: 4_902_080,
    chunksWritten: 15_319,
    finalLatencyMs: 1056,
  },
  tts: {
    provider: "ElevenLabs eleven_flash_v2_5",
    voiceId: "56AoDkrOh6qfVPDXZ7Pt",
    min: 124,
    avg: 168,
    max: 342,
    speed: 0.95,
    stability: 0.5,
  },
  vad: {
    provider: "Silero VAD @ 8kHz v1.0.4",
    segments: 25,
    min: 798,
    avg: 1216.8,
    max: 1454,
    maxSpeechMs: 7180,
  },
  audioPipeline: { completions: 26, maxBytesSent: 82_880, maxChunksSent: 259 },
  sns: { messagesPublished: 52 },
  silence: { warningsStarted: 25, activityResets: 143, timeouts: 0 },
};

export const latencyRanges = [
  { component: "LLM", min: 0, avg: 686, max: 1309 },
  { component: "TTS", min: 124, avg: 168, max: 342 },
  { component: "VAD", min: 798, avg: 1216.8, max: 1454 },
  { component: "STT", min: 0, avg: 1056, max: 1056 },
];

export const telephony = {
  codec: "PCMA",
  mediaRegion: "jp1",
  signalingRegion: "jp1",
  edgeLocation: "tokyo",
  pddMs: 170,
  disconnectedBy: "callee",
  lastSipResponse: 486,
  inbound: { jitterAvgMs: 8.687, jitterMaxMs: 10.834, packets: 1700, lossPct: 0.007194 },
  outbound: { jitterAvgMs: 2.631, jitterMaxMs: 3.451, packets: 1700, lossPct: 0.002158 },
};

export const qualityThresholds = {
  jitterMs: { good: 30, warning: 50, poor: 100 },
  packetLossPercent: { good: 1, warning: 3, poor: 5 },
  latencyMs: { good: 150, warning: 300 },
  mosScore: { excellent: 4.3, good: 4.0, acceptable: 3.5, poor: 3.0 },
};

export type QualityLevel = "good" | "warning" | "poor" | "critical";

export const gradeJitter = (v: number): QualityLevel =>
  v <= 30 ? "good" : v <= 50 ? "warning" : v <= 100 ? "poor" : "critical";
export const gradeLoss = (v: number): QualityLevel =>
  v <= 1 ? "good" : v <= 3 ? "warning" : v <= 5 ? "poor" : "critical";
export const gradeLatency = (v: number): QualityLevel =>
  v <= 150 ? "good" : v <= 300 ? "warning" : "critical";

export const levelColor: Record<QualityLevel, string> = {
  good: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  poor: "hsl(var(--chart-3))",
  critical: "hsl(var(--destructive))",
};

export const conversationTurns: ConversationTurn[] = [
  { index: 1, agent: "Initial", userInput: "(initial greeting)", botOutput: "Hello, Good Evening", llmMs: 0, tokensIn: 0, tokensOut: 0, disconnect: false },
  { index: 2, agent: "NameVerificationAgent", userInput: "hello", botOutput: "This is Alex, a virtual assistant calling on behalf of Kaiser Permanente regarding the need to update the insurance information on your account. Am I speaking with Dummy Test8.", llmMs: 605, tokensIn: 1972, tokensOut: 156, disconnect: false },
  { index: 3, agent: "NameVerificationAgent", userInput: "yes it's me", botOutput: "Thank you for confirming. This call may be monitored and recorded for quality purposes. Do I have your consent to proceed.", llmMs: 435, tokensIn: 2018, tokensOut: 96, disconnect: false },
  { index: 4, agent: "RecordingConsentVerificationAgent", userInput: "um yes", botOutput: "Thank you for providing your consent to record the call. Could you please confirm your Date of Birth for identity verification.", llmMs: 449, tokensIn: 1576, tokensOut: 89, disconnect: false },
  { index: 5, agent: "AuthenticationAgent", userInput: "absolutely it's 16th of march 1953", botOutput: "Appreciate you verifying the date of birth. Can you please let me know your address.", llmMs: 490, tokensIn: 1671, tokensOut: 110, disconnect: false },
  { index: 6, agent: "AuthenticationAgent", userInput: "sure it's 123 duster st longmont CO 80503", botOutput: "Excellent, your verification is complete. Are you the primary policy holder.", llmMs: 1268, tokensIn: 1960, tokensOut: 122, disconnect: false },
  { index: 7, agent: "BCInsuranceCollectionAgent", userInput: "one second", botOutput: "Sure, take your time.", llmMs: 461, tokensIn: 2601, tokensOut: 81, disconnect: false },
  { index: 8, agent: "BCInsuranceCollectionAgent", userInput: "no i'm not i'm not a primary policy holder", botOutput: "I understand. Could you please provide the full name of the policy holder.", llmMs: 478, tokensIn: 2626, tokensOut: 85, disconnect: false },
  { index: 9, agent: "BCInsuranceCollectionAgent", userInput: "sure it's rob robert john johnson", botOutput: "And what's the policy holder's date of birth.", llmMs: 494, tokensIn: 2659, tokensOut: 72, disconnect: false },
  { index: 10, agent: "BCInsuranceCollectionAgent", userInput: "the 10th of june 1980", botOutput: "Got it, so that's R, O, B space R, O, B, E, R, T space J, O, H, N space J, O, H, N, S, O, N, born 10th June nineteen eighty. Is that correct.", llmMs: 707, tokensIn: 2704, tokensOut: 198, disconnect: false },
  { index: 11, agent: "BCInsuranceCollectionAgent", userInput: "well too many spaces it's robert space johnson", botOutput: "Got it, so that's R, O, B, E, R, T space J, O, H, N, S, O, N, born 10th June nineteen eighty. Is that correct.", llmMs: 891, tokensIn: 2771, tokensOut: 150, disconnect: false },
  { index: 12, agent: "BCInsuranceCollectionAgent", userInput: "yes that's absolutely correct", botOutput: "Thanks. Does the name on the insurance document match with the patient name 'Dummy Test8'.", llmMs: 560, tokensIn: 2827, tokensOut: 154, disconnect: false },
  { index: 13, agent: "BCInsuranceCollectionAgent", userInput: "in that yes", botOutput: "Thanks. Can you provide the insurance provider name as stated on the card.", llmMs: 472, tokensIn: 2838, tokensOut: 98, disconnect: false },
  { index: 14, agent: "BCInsuranceCollectionAgent", userInput: "yes it is united healthcare", botOutput: "So the insurance provider is U, N, I, T, E, D space H, E, A, L, T, H, C, A, R, E. Is that correct.", llmMs: 628, tokensIn: 3010, tokensOut: 140, disconnect: false },
  { index: 15, agent: "BCInsuranceCollectionAgent", userInput: "yeah CARE at the end", botOutput: "Thanks. Is this related to a work injury.", llmMs: 893, tokensIn: 2882, tokensOut: 116, disconnect: false },
  { index: 16, agent: "BCInsuranceCollectionAgent", userInput: "uh no it's not", botOutput: "Okay, not work-related. Is this the primary insurance.", llmMs: 478, tokensIn: 2525, tokensOut: 113, disconnect: false },
  { index: 17, agent: "BCInsuranceCollectionAgent", userInput: "it is not my primary insurance no", botOutput: "Understood, this is not your primary insurance. Could you provide me with your policy number.", llmMs: 872, tokensIn: 2817, tokensOut: 130, disconnect: false },
  { index: 18, agent: "BCInsuranceCollectionAgent", userInput: "uh it says a ET 12345", botOutput: "Got it, the policy number is A - space E - T - one-two-three-four-five. Is that correct.", llmMs: 614, tokensIn: 2777, tokensOut: 130, disconnect: false },
  { index: 19, agent: "BCInsuranceCollectionAgent", userInput: "no you put a space between a and E and there's no space it's a et 12345", botOutput: "Got it, the policy number is A - E - T - one-two-three-four-five. Is that correct.", llmMs: 1073, tokensIn: 2841, tokensOut: 134, disconnect: false },
  { index: 20, agent: "BCInsuranceCollectionAgent", userInput: "uh no actually it's wrong it is UH123456", botOutput: "Got it, the policy number is U - H - one-two-three-four-five-six. Is that correct.", llmMs: 483, tokensIn: 2884, tokensOut: 97, disconnect: false },
  { index: 21, agent: "BCInsuranceCollectionAgent", userInput: "uh yes that's correct", botOutput: "Thanks for confirming. Could you provide the group number as well.", llmMs: 793, tokensIn: 2682, tokensOut: 96, disconnect: false },
  { index: 22, agent: "BCInsuranceCollectionAgent", userInput: "i don't have any group number", botOutput: "Noted. Can you tell me your policy start date.", llmMs: 439, tokensIn: 2868, tokensOut: 105, disconnect: false },
  { index: 23, agent: "BCInsuranceCollectionAgent", userInput: "it is the 10th of july 2026", botOutput: "That policy start date seems to be after the service was provided. Can you please verify and share the correct policy start date.", llmMs: 1152, tokensIn: 2838, tokensOut: 117, disconnect: false },
  { index: 24, agent: "BCInsuranceCollectionAgent", userInput: "well that's the only date i have", botOutput: "I understand. Unfortunately, since the policy wasn't active during the service, we won't be able to proceed with the claim at this time. Would it be alright to close the call now.", llmMs: 585, tokensIn: 2892, tokensOut: 119, disconnect: false },
  { index: 25, agent: "BCClosureAgent", userInput: "yeah sure", botOutput: "Thank you. I have noted the policy start date as 2026-07-10. We'll close the call now. Have a great day.", llmMs: 1207, tokensIn: 3204, tokensOut: 239, disconnect: true },
  { index: 26, agent: "BCClosureAgent", userInput: "Bye bye.", botOutput: "Thank you, goodbye.", llmMs: 1309, tokensIn: 3341, tokensOut: 321, disconnect: true },
];

export const agentDistribution = Object.entries(
  conversationTurns.reduce<Record<string, number>>((acc, t) => {
    acc[t.agent] = (acc[t.agent] ?? 0) + 1;
    return acc;
  }, {})
).map(([name, value], i) => ({
  name,
  value,
  color: `hsl(var(--chart-${(i % 6) + 1}))`,
}));

export const tokenTotals = conversationTurns.reduce(
  (acc, t) => ({ in: acc.in + t.tokensIn, out: acc.out + t.tokensOut }),
  { in: 0, out: 0 }
);

export const llmP = (() => {
  const sorted = conversationTurns.map((t) => t.llmMs).sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return { p50: pick(50), p90: pick(90), p95: pick(95), p99: pick(99) };
})();

export const qualityFlags = [
  { label: "Low packet loss", state: "good" as const, detail: "< 0.01% both legs" },
  { label: "Jitter within threshold", state: "good" as const, detail: "max 10.83 ms" },
  { label: "PDD above 150 ms", state: "warning" as const, detail: "170 ms — review" },
  { label: "User corrections detected", state: "warning" as const, detail: "4 turns with re-spelling" },
  { label: "Silence timeout", state: "good" as const, detail: "0 timeouts, 143 activity resets" },
  { label: "Supervisor review flag", state: "warning" as const, detail: "Claim blocked by effective date" },
];

// Test-suite generation from an uploaded workflow document.
// Each generated test case carries a structured JSON spec plus a TwiML XML
// script that simulates the customer side of the call.

export type RunStatus = "not_run" | "queued" | "running" | "passed" | "failed";

export interface TestCase {
  id: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  description: string;
  preconditions: string[];
  customer_profile: Record<string, string | boolean>;
  expected_ai_questions: string[];
  customer_responses: string[];
  expected_outcome: string;
  pass_criteria: string[];
  status: RunStatus;
  lastRun: string | null;
  durationMs: number | null;
  twiml: string;
}

const twiml = (lines: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n\n    <Pause length="3"/>\n\n` +
  lines
    .map(
      (l) =>
        `    <Say voice="Polly.Joanna">\n        ${l}\n    </Say>\n\n    <Pause length="2"/>\n`
    )
    .join("\n") +
  `\n    <Hangup/>\n\n</Response>\n`;

type Seed = Omit<TestCase, "status" | "lastRun" | "durationMs" | "twiml"> & {
  spoken: string[];
};

const seeds: Seed[] = [
  {
    id: "TC001",
    title: "Happy Path - Insurance Verification",
    priority: "P1",
    description: "Customer cooperates and provides all mandatory information.",
    preconditions: ["Outbound call connected", "Customer answers call", "Voice AI is active"],
    customer_profile: {
      name: "John Smith",
      dob: "1985-01-15",
      address: "123 Main Street, Dallas, TX 75201",
      primary_policy_holder: true,
      insurance_company: "Kaiser Permanente",
      policy_number: "KP123456789",
      group_number: "GRP456789",
      effective_date: "2025-01-01",
    },
    expected_ai_questions: [
      "Am I speaking with John Smith?",
      "Do I have your consent to record this call?",
      "Can you verify your date of birth?",
      "Can you verify your address?",
      "Are you the primary policy holder?",
      "What is your insurance company?",
      "What is your policy number?",
      "What is your group number?",
      "What is the policy effective date?",
    ],
    customer_responses: [
      "Yes, this is John Smith.",
      "Yes, I consent.",
      "January 15 1985.",
      "123 Main Street, Dallas Texas 75201.",
      "Yes.",
      "Kaiser Permanente.",
      "KP123456789.",
      "GRP456789.",
      "January 1st 2025.",
    ],
    expected_outcome: "AI completes verification and proceeds to call conclusion.",
    pass_criteria: [
      "AI asks every mandatory question",
      "AI captures all mandatory fields",
      "No unexpected fallback or transfer occurs",
      "Call ends successfully",
    ],
    spoken: [
      "Yes, this is John Smith speaking.",
      "Yes, I consent to the recording.",
      "January fifteenth nineteen eighty five.",
      "One two three Main Street, Dallas, Texas, Seven Five Two Zero One.",
      "Yes, I am the primary policy holder.",
      "Kaiser Permanente.",
      "K P One Two Three Four Five Six Seven Eight Nine.",
      "G R P Four Five Six Seven Eight Nine.",
      "January first twenty twenty five.",
      "Thank you.",
    ],
  },
  {
    id: "TC002",
    title: "Consent Declined - Call Termination",
    priority: "P1",
    description: "Customer refuses recording consent; AI must end the call politely.",
    preconditions: ["Outbound call connected", "Customer answers call"],
    customer_profile: { name: "John Smith", dob: "1985-01-15", primary_policy_holder: true },
    expected_ai_questions: [
      "Am I speaking with John Smith?",
      "Do I have your consent to record this call?",
    ],
    customer_responses: ["Yes, this is John Smith.", "No, I do not consent."],
    expected_outcome: "AI acknowledges refusal and terminates without collecting PHI.",
    pass_criteria: [
      "AI stops the verification flow",
      "No PHI is requested after refusal",
      "Call is closed with a compliance message",
    ],
    spoken: [
      "Yes, this is John Smith speaking.",
      "No, I do not consent to the recording.",
      "Thank you, goodbye.",
    ],
  },
  {
    id: "TC003",
    title: "Non Policy Holder - Transfer Path",
    priority: "P2",
    description: "Caller is a spouse, not the primary policy holder.",
    preconditions: ["Outbound call connected", "Consent captured"],
    customer_profile: {
      name: "Maria Smith",
      dob: "1987-04-02",
      primary_policy_holder: false,
      insurance_company: "Kaiser Permanente",
    },
    expected_ai_questions: [
      "Are you the primary policy holder?",
      "Can you provide the policy holder name?",
    ],
    customer_responses: ["No, my husband is.", "John Smith."],
    expected_outcome: "AI switches to the authorized-representative sub-flow.",
    pass_criteria: [
      "AI detects non policy holder",
      "AI collects policy holder identity",
      "Correct sub-flow is entered",
    ],
    spoken: [
      "Yes, this is Maria Smith.",
      "Yes, I consent to the recording.",
      "No, I am not the primary policy holder.",
      "The policy holder is John Smith, my husband.",
      "Thank you.",
    ],
  },
  {
    id: "TC004",
    title: "Effective Date After Service Date - Claim Blocked",
    priority: "P1",
    description: "Policy effective date is later than the date of service.",
    preconditions: ["Verification flow reached insurance details"],
    customer_profile: {
      name: "John Smith",
      insurance_company: "Kaiser Permanente",
      policy_number: "KP123456789",
      effective_date: "2026-07-10",
      service_date: "2026-06-05",
    },
    expected_ai_questions: ["What is the policy effective date?"],
    customer_responses: ["July tenth twenty twenty six."],
    expected_outcome: "AI flags that the claim cannot proceed and explains why.",
    pass_criteria: [
      "AI compares effective date with service date",
      "AI raises the coverage exception",
      "Outcome recorded as claim blocked",
    ],
    spoken: [
      "Yes, this is John Smith speaking.",
      "Yes, I consent to the recording.",
      "Kaiser Permanente.",
      "K P One Two Three Four Five Six Seven Eight Nine.",
      "July tenth twenty twenty six.",
      "Thank you.",
    ],
  },
  {
    id: "TC005",
    title: "No Input / Silence Handling",
    priority: "P2",
    description: "Customer stays silent; AI must reprompt then fall back.",
    preconditions: ["Outbound call connected"],
    customer_profile: { name: "Unknown", primary_policy_holder: false },
    expected_ai_questions: ["Am I speaking with John Smith?", "Are you still there?"],
    customer_responses: ["(silence)", "(silence)"],
    expected_outcome: "AI reprompts twice, then ends the call with a callback message.",
    pass_criteria: [
      "Maximum two reprompts",
      "No infinite loop",
      "Graceful termination within 45 seconds",
    ],
    spoken: ["Sorry, I cannot hear you.", "Goodbye."],
  },
  {
    id: "TC006",
    title: "Invalid Policy Number - Retry Path",
    priority: "P3",
    description: "Customer gives a malformed policy number and corrects it on retry.",
    preconditions: ["Consent captured", "Identity verified"],
    customer_profile: {
      name: "John Smith",
      insurance_company: "Kaiser Permanente",
      policy_number: "KP123456789",
    },
    expected_ai_questions: ["What is your policy number?", "Could you repeat the policy number?"],
    customer_responses: ["It is one two three.", "KP123456789."],
    expected_outcome: "AI validates format, reprompts once and captures the corrected value.",
    pass_criteria: [
      "AI rejects the malformed value",
      "AI reprompts exactly once",
      "Corrected value is stored",
    ],
    spoken: [
      "Yes, this is John Smith speaking.",
      "Yes, I consent to the recording.",
      "One two three.",
      "K P One Two Three Four Five Six Seven Eight Nine.",
      "Thank you.",
    ],
  },
];

export const generateTestCases = (sourceName: string): TestCase[] =>
  seeds.map(({ spoken, ...rest }) => ({
    ...rest,
    description: rest.description,
    status: "not_run" as RunStatus,
    lastRun: null,
    durationMs: null,
    twiml: twiml(spoken),
    _source: sourceName,
  })) as TestCase[];

export const testCaseJson = (tc: TestCase) => {
  const { status, lastRun, durationMs, twiml: _x, ...spec } = tc;
  return JSON.stringify({ ...spec, last_run: lastRun, last_status: status }, null, 2);
};

export const download = (filename: string, content: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

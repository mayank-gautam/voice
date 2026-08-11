// Mock data for the Voice AI Observability Dashboard

export const generateTimeSeriesData = (hours: number = 24, baseValue: number = 100, variance: number = 30) => {
  const data = [];
  const now = new Date();
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: time.toISOString(),
      value: Math.max(0, baseValue + (Math.random() - 0.5) * variance * 2),
    });
  }
  return data;
};

export const overviewMetrics = {
  totalCalls: 12847,
  totalCallsChange: 12.5,
  activeCalls: 47,
  activeCallsChange: -3.2,
  successRate: 94.7,
  successRateChange: 1.2,
  avgDuration: 187,
  avgDurationChange: -8.3,
  longestDuration: 842,
  avgLatency: 342,
  avgLatencyChange: -15.2,
  costToday: 1247.83,
  costChange: 5.7,
};

export const callVolumeData = generateTimeSeriesData(24, 45, 20).map((d, i) => ({
  ...d,
  inbound: Math.floor(d.value * 0.7),
  outbound: Math.floor(d.value * 0.3),
}));

export const latencyData = generateTimeSeriesData(24, 320, 80).map((d) => ({
  ...d,
  stt: Math.floor(d.value * 0.3),
  llm: Math.floor(d.value * 0.5),
  tts: Math.floor(d.value * 0.2),
}));

export const callStatusBreakdown = [
  { name: 'Completed', value: 11842, color: 'hsl(var(--success))' },
  { name: 'Failed', value: 423, color: 'hsl(var(--destructive))' },
  { name: 'Dropped', value: 312, color: 'hsl(var(--warning))' },
  { name: 'Escalated', value: 270, color: 'hsl(var(--info))' },
];

export const sipErrorBreakdown = [
  { code: '408', description: 'Request Timeout', count: 145 },
  { code: '486', description: 'Busy Here', count: 98 },
  { code: '503', description: 'Service Unavailable', count: 67 },
  { code: '487', description: 'Request Terminated', count: 54 },
  { code: '480', description: 'Temporarily Unavailable', count: 43 },
];

export const aiPerformanceMetrics = {
  stt: {
    avgLatency: 98,
    p50: 82,
    p90: 145,
    p99: 234,
    confidence: 0.94,
    errorRate: 2.3,
  },
  llm: {
    avgLatency: 412,
    p50: 320,
    p90: 680,
    p99: 1240,
    tokensUsed: 2847293,
    rateLimitEvents: 12,
  },
  tts: {
    avgLatency: 156,
    p50: 134,
    p90: 245,
    p99: 398,
    errorRate: 0.8,
  },
};

export const systemHealthMetrics: Record<string, { name: string; status: 'healthy' | 'warning' | 'critical'; [key: string]: any }> = {
  appService: {
    name: 'Voice Assistant',
    status: 'healthy' as const,
    cpu: 42,
    memory: 67,
    instances: 3,
    latency: 45,
  },
  functionApp: {
    name: 'LLM Engine',
    status: 'healthy' as const,
    executions: 48293,
    failures: 127,
    coldStarts: 23,
  },
  cosmosDb: {
    name: 'CosmosDB',
    status: 'warning' as const,
    ruUsage: 78,
    throttling: 3,
    latency: 12,
  },
  queue: {
    name: 'Storage Queue',
    status: 'healthy' as const,
    depth: 234,
    processingLatency: 89,
  },
  azureStt: {
    name: 'Azure STT',
    status: 'healthy' as const,
    quotaUsed: 45,
    errorRate: 1.2,
  },
  azureTts: {
    name: 'Azure TTS',
    status: 'healthy' as const,
    quotaUsed: 38,
    errorRate: 0.8,
  },
  azureOpenai: {
    name: 'Azure OpenAI',
    status: 'warning' as const,
    quotaUsed: 72,
    throttling: 8,
    latency: 380,
  },
  twilio: {
    name: 'Twilio',
    status: 'healthy' as const,
    activeChannels: 47,
    errorRate: 0.3,
  },
};

export const costBreakdown = [
  { category: 'Telephony (Twilio)', daily: 342.50, monthly: 10275, trend: 5.2 },
  { category: 'Azure STT', daily: 187.20, monthly: 5616, trend: -2.1 },
  { category: 'Azure TTS', daily: 124.80, monthly: 3744, trend: 1.8 },
  { category: 'Azure OpenAI', daily: 456.30, monthly: 13689, trend: 12.4 },
  { category: 'CosmosDB', daily: 89.40, monthly: 2682, trend: -0.5 },
  { category: 'App Service', daily: 47.63, monthly: 1429, trend: 0 },
];

export const alerts: Array<{
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}> = [
  {
    id: 'alert-1',
    severity: 'critical',
    title: 'High LLM Latency Detected',
    description: 'P99 latency exceeded 1500ms threshold',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-2',
    severity: 'warning',
    title: 'CosmosDB RU Throttling',
    description: '3 throttling events in the last hour',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'alert-3',
    severity: 'warning',
    title: 'Azure OpenAI Quota Usage High',
    description: 'Approaching 80% of daily quota',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'acknowledged',
  },
  {
    id: 'alert-4',
    severity: 'info',
    title: 'Autoscaling Event',
    description: 'App Service scaled from 2 to 3 instances',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'resolved',
  },
];

export const generateCallId = () => `CALL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

export const callStatuses = ['completed', 'failed', 'dropped', 'escalated'] as const;
export const sentiments = ['positive', 'neutral', 'negative'] as const;
export const intents = ['billing_inquiry', 'tech_support', 'account_update', 'general_question', 'complaint', 'appointment'] as const;

export const generateCall = (index: number) => {
  const status = callStatuses[Math.floor(Math.random() * callStatuses.length)];
  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
  const intent = intents[Math.floor(Math.random() * intents.length)];
  const duration = Math.floor(Math.random() * 600) + 30;
  const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
  const callType: 'inbound' | 'outbound' = Math.random() > 0.3 ? 'inbound' : 'outbound';
  
  return {
    id: generateCallId(),
    timestamp: timestamp.toISOString(),
    callerNumber: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    callType,
    duration,
    status,
    agentSteps: Math.floor(Math.random() * 12) + 3,
    sentiment,
    intent,
    hasTranscript: Math.random() > 0.1,
    cost: (duration / 60 * 0.0085 + Math.random() * 0.05).toFixed(4),
    sttLatency: Math.floor(Math.random() * 150) + 50,
    llmLatency: Math.floor(Math.random() * 500) + 200,
    ttsLatency: Math.floor(Math.random() * 200) + 80,
  };
};

export const calls = Array.from({ length: 100 }, (_, i) => generateCall(i));

export const generateTranscript = () => [
  { role: 'system', content: 'Call connected', timestamp: 0, metadata: { event: 'call_start' } },
  { role: 'agent', content: 'Hello! Thank you for calling. How can I assist you today?', timestamp: 2, sttConfidence: null, llmLatency: 312, ttsLatency: 145, intent: null },
  { role: 'user', content: 'Hi, I need help with my billing statement. There seems to be an extra charge.', timestamp: 8, sttConfidence: 0.96, llmLatency: null, ttsLatency: null, intent: 'billing_inquiry' },
  { role: 'agent', content: "I'd be happy to help you with your billing inquiry. Let me pull up your account. Can you please verify your account number or the phone number associated with your account?", timestamp: 12, sttConfidence: null, llmLatency: 428, ttsLatency: 167, intent: null },
  { role: 'user', content: 'Sure, its 555-123-4567', timestamp: 18, sttConfidence: 0.94, llmLatency: null, ttsLatency: null, intent: 'provide_info' },
  { role: 'agent', content: "Thank you. I can see your account now. I notice there's a $15.99 charge from October 15th. This appears to be for the premium support add-on. Would you like me to explain this charge in detail?", timestamp: 24, sttConfidence: null, llmLatency: 512, ttsLatency: 189, intent: null },
  { role: 'user', content: "I didn't sign up for any premium support. Can you remove that charge?", timestamp: 32, sttConfidence: 0.92, llmLatency: null, ttsLatency: null, intent: 'dispute_charge' },
  { role: 'agent', content: "I understand your concern. Looking at the account history, it seems this was added during your last service call. I can process a refund for this charge right away. The $15.99 will be credited to your account within 3-5 business days. Is there anything else I can help you with?", timestamp: 38, sttConfidence: null, llmLatency: 623, ttsLatency: 201, intent: null },
  { role: 'user', content: "No, that's all I needed. Thank you for your help!", timestamp: 48, sttConfidence: 0.98, llmLatency: null, ttsLatency: null, intent: 'end_conversation' },
  { role: 'agent', content: "You're welcome! Thank you for calling. Have a great day!", timestamp: 52, sttConfidence: null, llmLatency: 287, ttsLatency: 134, intent: null },
  { role: 'system', content: 'Call ended', timestamp: 56, metadata: { event: 'call_end', duration: 56 } },
];

export const traceSpans = [
  { id: 'span-1', name: 'twilio.webhook.incoming', service: 'Twilio', duration: 12, start: 0, status: 'ok' },
  { id: 'span-2', name: 'voice-assistant.process', service: 'Voice Assistant', duration: 2340, start: 12, status: 'ok' },
  { id: 'span-3', name: 'azure.stt.recognize', service: 'Azure STT', duration: 98, start: 24, status: 'ok' },
  { id: 'span-4', name: 'llm-engine.completion', service: 'LLM Engine', duration: 428, start: 134, status: 'ok' },
  { id: 'span-5', name: 'azure.openai.chat', service: 'Azure OpenAI', duration: 412, start: 140, status: 'ok' },
  { id: 'span-6', name: 'azure.tts.synthesize', service: 'Azure TTS', duration: 167, start: 568, status: 'ok' },
  { id: 'span-7', name: 'cosmos.upsert', service: 'CosmosDB', duration: 23, start: 745, status: 'ok' },
  { id: 'span-8', name: 'queue.enqueue', service: 'Storage Queue', duration: 8, start: 778, status: 'ok' },
];

export const logEntries = [
  { timestamp: '2024-01-15T10:23:45.123Z', level: 'info', service: 'voice-assistant', message: 'Incoming call from +15551234567', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:45.234Z', level: 'info', service: 'azure-stt', message: 'Speech recognition started', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:45.456Z', level: 'info', service: 'azure-stt', message: 'Recognition result: confidence=0.96', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:45.678Z', level: 'info', service: 'llm-engine', message: 'Processing intent: billing_inquiry', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:46.012Z', level: 'warn', service: 'azure-openai', message: 'Response latency elevated: 512ms', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:46.234Z', level: 'info', service: 'azure-tts', message: 'Speech synthesis completed', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:46.456Z', level: 'info', service: 'cosmos', message: 'Turn record saved', traceId: 'trace-abc123' },
  { timestamp: '2024-01-15T10:23:47.123Z', level: 'error', service: 'azure-openai', message: 'Rate limit warning: 72% of quota used', traceId: 'trace-xyz789' },
];

export const systemHealthScore = 87;

export const topIntents = [
  { intent: 'billing_inquiry', count: 3421, successRate: 94.2 },
  { intent: 'tech_support', count: 2847, successRate: 89.7 },
  { intent: 'account_update', count: 2134, successRate: 96.1 },
  { intent: 'general_question', count: 1876, successRate: 91.3 },
  { intent: 'appointment', count: 1543, successRate: 97.8 },
  { intent: 'complaint', count: 1026, successRate: 78.4 },
];

export const behaviorMetrics = {
  intentAccuracy: 91.4,
  taskCompletion: 87.2,
  repairAttempts: 892,
  deadEndLoops: 47,
  frustrationIndicators: 234,
};

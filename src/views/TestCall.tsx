"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PhoneCall,
  Loader2,
  ExternalLink,
  RotateCcw,
  FileCode2,
  RefreshCw,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/lib/projectConfig";
import { apiFetch } from "@/lib/api-client";
import {
  TestCallLoadTesting,
  type TestCallPayload,
} from "@/components/dashboard/TestCallLoadTesting";

const E164 = /^\+[1-9]\d{7,14}$/;
const CUSTOM_NUMBER = "__custom__";
type InstructionMode = "twiml" | "webhook";

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const DEFAULT_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="3"/>
    <Say voice="Polly.Joanna">
        Yes, this is John Smith speaking.
    </Say>
    <Pause length="5"/>
    <Say voice="Polly.Joanna">
        Yes, I consent to the recording.
    </Say>
    <Pause length="5"/>
    <Say voice="Polly.Joanna">
        January fifteenth nineteen eighty five.
    </Say>
    <Pause length="5"/>
    <Hangup/>
</Response>
`;

type CreatedCall = {
  sid: string;
  to: string;
  from: string;
  status: string;
  direction?: string;
  dateCreated?: string | null;
};

type PhoneNumberItem = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
};

const TestCall = () => {
  const router = useRouter();
  const { activeId, active, loading: projectsLoading } = useProjects();

  const [numbers, setNumbers] = useState<PhoneNumberItem[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [numbersError, setNumbersError] = useState<string | null>(null);

  const [toSelect, setToSelect] = useState("");
  const [toCustom, setToCustom] = useState("");
  const [toSelectKey, setToSelectKey] = useState(0);
  const [from, setFrom] = useState("");
  const [instructionMode, setInstructionMode] = useState<InstructionMode>("twiml");
  const [twiml, setTwiml] = useState(DEFAULT_TWIML);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [timeoutSec, setTimeoutSec] = useState("30");
  const [timeLimitSec, setTimeLimitSec] = useState("30");
  const [record, setRecord] = useState(false);
  const [statusCallback, setStatusCallback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastCall, setLastCall] = useState<CreatedCall | null>(null);
  const [loadRunning, setLoadRunning] = useState(false);
  const formLocked = submitting || loadRunning;

  const loadNumbers = useCallback(async () => {
    if (projectsLoading) return;
    if (!activeId) {
      setNumbers([]);
      setNumbersError("No active project");
      return;
    }

    setNumbersLoading(true);
    setNumbersError(null);
    try {
      const params = new URLSearchParams({ projectId: activeId, limit: "100" });
      const res = await apiFetch(`/api/twilio/phone-numbers?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to list phone numbers");
      }
      const list = (data.numbers || []) as PhoneNumberItem[];
      setNumbers(list);

      setFrom((prevFrom) => {
        const nextFrom =
          prevFrom && list.some((n) => n.phoneNumber === prevFrom)
            ? prevFrom
            : list[0]?.phoneNumber || "";

        setToSelect((prevTo) => {
          if (prevTo === CUSTOM_NUMBER) return prevTo;
          if (prevTo && list.some((n) => n.phoneNumber === prevTo) && prevTo !== nextFrom) {
            return prevTo;
          }
          const alt = list.find((n) => n.phoneNumber !== nextFrom);
          return alt?.phoneNumber || "";
        });

        return nextFrom;
      });
    } catch (e) {
      setNumbers([]);
      setNumbersError(e instanceof Error ? e.message : "Failed to list numbers");
    } finally {
      setNumbersLoading(false);
    }
  }, [activeId, projectsLoading]);

  useEffect(() => {
    void loadNumbers();
  }, [loadNumbers]);

  const to = toSelect === CUSTOM_NUMBER ? toCustom.trim() : toSelect;

  const resetToField = useCallback(() => {
    setToSelect("");
    setToCustom("");
    setToSelectKey((k) => k + 1);
  }, []);

  // If From is changed to the number already selected in To, clear To
  useEffect(() => {
    if (!from) return;
    const listedConflict = toSelect === from;
    const customConflict =
      toSelect === CUSTOM_NUMBER && toCustom.trim() === from;
    if (listedConflict || customConflict) {
      resetToField();
    }
  }, [from, toSelect, toCustom, resetToField]);

  const instructionsOk =
    instructionMode === "twiml"
      ? /<Response[\s>]/i.test(twiml) && /<\/Response>/i.test(twiml)
      : isValidWebhookUrl(webhookUrl);

  const canSubmit = useMemo(() => {
    return (
      E164.test(to) &&
      E164.test(from) &&
      to !== from &&
      numbers.length >= 1 &&
      instructionsOk &&
      !submitting &&
      !loadRunning &&
      !projectsLoading
    );
  }, [to, from, instructionsOk, submitting, loadRunning, projectsLoading, numbers.length]);

  const callPayload: TestCallPayload | null = useMemo(() => {
    if (
      !E164.test(to) ||
      !E164.test(from) ||
      to === from ||
      !instructionsOk
    ) {
      return null;
    }
    return {
      to,
      from,
      mode: instructionMode,
      ...(instructionMode === "twiml"
        ? { twiml: twiml.trim() }
        : { url: webhookUrl.trim() }),
      timeout: Number(timeoutSec) || undefined,
      timeLimit: Number(timeLimitSec) || undefined,
      record,
      statusCallback: statusCallback.trim() || undefined,
    };
  }, [
    to,
    from,
    instructionsOk,
    instructionMode,
    twiml,
    webhookUrl,
    timeoutSec,
    timeLimitSec,
    record,
    statusCallback,
  ]);

  const canLoadStart = Boolean(callPayload) && !projectsLoading && numbers.length >= 1;

  const resetSample = () => {
    setTwiml(DEFAULT_TWIML);
    toast.message("Sample customer TwiML restored");
  };

  const handleFromChange = (value: string) => {
    setFrom(value);
    if (
      toSelect === value ||
      (toSelect === CUSTOM_NUMBER && toCustom.trim() === value)
    ) {
      resetToField();
    }
  };

  const handleToChange = (value: string) => {
    setToSelect(value);
    if (value !== CUSTOM_NUMBER) {
      setToCustom("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!E164.test(to)) {
      toast.error(
        toSelect === CUSTOM_NUMBER
          ? "Enter a valid E.164 'to' number (e.g. +14155551234)"
          : "Select a valid 'to' number"
      );
      return;
    }
    if (!E164.test(from)) {
      toast.error("Select a valid 'from' number");
      return;
    }
    if (to === from) {
      toast.error("'to' and 'from' must be different numbers");
      return;
    }
    if (instructionMode === "twiml") {
      if (!/<Response[\s>]/i.test(twiml) || !/<\/Response>/i.test(twiml)) {
        toast.error("TwiML must include a <Response>...</Response> document");
        return;
      }
    } else if (!isValidWebhookUrl(webhookUrl)) {
      toast.error("Enter a valid webhook URL (http or https)");
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams();
      if (activeId) params.set("projectId", activeId);

      const res = await apiFetch(`/api/test-calls?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from,
          mode: instructionMode,
          ...(instructionMode === "twiml"
            ? { twiml: twiml.trim() }
            : { url: webhookUrl.trim() }),
          timeout: Number(timeoutSec) || undefined,
          timeLimit: Number(timeLimitSec) || undefined,
          record,
          statusCallback: statusCallback.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to create call");
      }

      const call = data.call as CreatedCall;
      setLastCall(call);
      toast.success("Test call created", {
        description: `${call.sid} · ${call.status}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create call");
    } finally {
      setSubmitting(false);
    }
  };

  const numberLabel = (n: PhoneNumberItem) =>
    n.friendlyName && n.friendlyName !== n.phoneNumber
      ? `${n.phoneNumber} — ${n.friendlyName}`
      : n.phoneNumber;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-6xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Call Simulation</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Place an inbound-style test to your agentic AI number, or run a load test with the same
              parameters.
              {active?.name ? ` · ${active.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={numbersLoading || projectsLoading || !activeId || formLocked}
              onClick={() => void loadNumbers()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${numbersLoading ? "animate-spin" : ""}`} />
              Refresh numbers
            </Button>
            <Badge variant="outline" className="font-mono text-[10px]">
              {instructionMode === "twiml" ? "calls.create + twiml" : "calls.create + url"}
            </Badge>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call legs</CardTitle>
              <CardDescription>
                Shared by single call and load testing.{" "}
                <span className="font-medium text-foreground">From</span> lists all account numbers.{" "}
                <span className="font-medium text-foreground">To</span> can use another account number
                or a custom E.164; the From number appears disabled in the To list.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {numbersLoading && (
                <p className="text-xs text-muted-foreground sm:col-span-2 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading Twilio numbers…
                </p>
              )}
              {numbersError && !numbersLoading && (
                <p className="text-xs text-chart-warning sm:col-span-2">{numbersError}</p>
              )}
              {!numbersLoading && !numbersError && numbers.length === 0 && activeId && (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  No incoming phone numbers on this Twilio account. Add at least one From number, or
                  use a custom To number with an account From.
                </p>
              )}

              <div className="space-y-2">
                <Label>To (AI / destination) *</Label>
                <Select
                  key={toSelectKey}
                  value={toSelect || undefined}
                  onValueChange={handleToChange}
                  disabled={numbersLoading || numbers.length === 0 || formLocked}
                >
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((n) => {
                      const usedInFrom = n.phoneNumber === from;
                      return (
                        <SelectItem
                          key={`to-${n.sid}`}
                          value={n.phoneNumber}
                          disabled={usedInFrom}
                          className="font-mono text-xs"
                        >
                          {numberLabel(n)}
                          {usedInFrom ? " (used in From)" : !n.capabilities.voice ? " (no voice)" : ""}
                        </SelectItem>
                      );
                    })}
                    <SelectItem value={CUSTOM_NUMBER} className="text-xs">
                      Another number…
                    </SelectItem>
                  </SelectContent>
                </Select>
                {toSelect === CUSTOM_NUMBER && (
                  <Input
                    className="font-mono text-sm"
                    placeholder="+14155551234"
                    value={toCustom}
                    onChange={(e) => setToCustom(e.target.value)}
                    autoComplete="tel"
                    disabled={formLocked}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>From (tester number) *</Label>
                <Select
                  value={from || undefined}
                  onValueChange={handleFromChange}
                  disabled={numbers.length === 0 || formLocked}
                >
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((n) => (
                      <SelectItem
                        key={`from-${n.sid}`}
                        value={n.phoneNumber}
                        className="font-mono text-xs"
                      >
                        {numberLabel(n)}
                        {!n.capabilities.voice ? " (no voice)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Call instructions</CardTitle>
              <CardDescription>
                Choose inline customer TwiML, or a webhook URL Twilio will request when the call is
                answered.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={instructionMode}
                onValueChange={(v) => setInstructionMode(v as InstructionMode)}
                className="grid gap-3 sm:grid-cols-2"
                disabled={formLocked}
              >
                <Label
                  htmlFor="mode-twiml"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                    instructionMode === "twiml"
                      ? "border-primary bg-primary/5"
                      : "border-border/50"
                  } ${formLocked ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <RadioGroupItem value="twiml" id="mode-twiml" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <FileCode2 className="w-3.5 h-3.5" />
                      TwiML
                    </span>
                    <span className="block text-[11px] text-muted-foreground font-normal">
                      Send inline &lt;Response&gt; XML with the call
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor="mode-webhook"
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                    instructionMode === "webhook"
                      ? "border-primary bg-primary/5"
                      : "border-border/50"
                  } ${formLocked ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <RadioGroupItem value="webhook" id="mode-webhook" className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Link2 className="w-3.5 h-3.5" />
                      Webhook URL
                    </span>
                    <span className="block text-[11px] text-muted-foreground font-normal">
                      Twilio POSTs to your URL for TwiML
                    </span>
                  </span>
                </Label>
              </RadioGroup>

              {instructionMode === "twiml" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="twiml">Customer TwiML *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={resetSample}
                      disabled={formLocked}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Sample
                    </Button>
                  </div>
                  <Textarea
                    id="twiml"
                    rows={12}
                    className="font-mono text-xs leading-relaxed"
                    value={twiml}
                    onChange={(e) => setTwiml(e.target.value)}
                    spellCheck={false}
                    disabled={formLocked}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL *</Label>
                  <Input
                    id="webhookUrl"
                    className="font-mono text-sm"
                    placeholder="https://example.com/voice/twiml"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    autoComplete="url"
                    disabled={formLocked}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must return valid TwiML. Twilio will request this URL with method POST.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Options</CardTitle>
              <CardDescription>Optional Twilio call parameters (shared)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeout">Ring timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min={1}
                  max={600}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                  disabled={formLocked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Max call length (seconds)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min={1}
                  max={14400}
                  value={timeLimitSec}
                  onChange={(e) => setTimeLimitSec(e.target.value)}
                  disabled={formLocked}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="statusCallback">Status callback URL (HTTPS, optional)</Label>
                <Input
                  id="statusCallback"
                  className="font-mono text-xs"
                  placeholder="https://example.com/hooks/twilio-status"
                  value={statusCallback}
                  onChange={(e) => setStatusCallback(e.target.value)}
                  disabled={formLocked}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 sm:col-span-2">
                <div>
                  <p className="text-sm font-medium">Record call</p>
                  <p className="text-[11px] text-muted-foreground">
                    Enables Twilio dual-channel recording (extra cost)
                  </p>
                </div>
                <Switch checked={record} onCheckedChange={setRecord} disabled={formLocked} />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="single" className="space-y-6">
            <TabsList>
              <TabsTrigger value="single" disabled={loadRunning}>
                Single call
              </TabsTrigger>
              <TabsTrigger value="load" disabled={submitting}>
                Load testing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button type="submit" disabled={!canSubmit} className="gap-2">
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PhoneCall className="w-4 h-4" />
                    )}
                    {submitting ? "Creating call…" : "Create test call"}
                  </Button>
                  {!activeId && !projectsLoading && (
                    <p className="text-xs text-chart-warning">
                      Configure Twilio env vars for your AWS account (
                      <code className="text-[10px]">TWILIO_ACCOUNT_SID_&lt;awsAccountId&gt;</code>) first.
                    </p>
                  )}
                </div>
              </form>

              {lastCall && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Call created</CardTitle>
                    <CardDescription>Twilio accepted the request</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          Call SID
                        </p>
                        <p className="font-mono text-xs break-all">{lastCall.sid}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          Status
                        </p>
                        <p className="font-mono text-xs">{lastCall.status}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          To
                        </p>
                        <p className="font-mono text-xs">{lastCall.to}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                          From
                        </p>
                        <p className="font-mono text-xs">{lastCall.from}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => router.push(`/calls/${lastCall.sid}`)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open call detail
                      </Button>
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <Link href={`/calls/${lastCall.sid}/logs`}>View logs</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="load">
              <TestCallLoadTesting
                projectId={activeId}
                payload={callPayload}
                canStart={canLoadStart}
                onRunningChange={setLoadRunning}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TestCall;

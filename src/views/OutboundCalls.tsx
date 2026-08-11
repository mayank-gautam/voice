"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PhoneOutgoing,
  Plus,
  Trash2,
  Settings2,
  Loader2,
  PhoneCall,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface AiNumber {
  id: string;
  name: string;
  number: string;
  agent: string;
  active: boolean;
}

interface CallLogEntry {
  id: string;
  to: string;
  fromName: string;
  fromNumber: string;
  startedAt: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed";
}

const NUMBERS_KEY = "outbound.aiNumbers";
const DEFAULTS_KEY = "outbound.defaults";

const seedNumbers: AiNumber[] = [
  { id: "n1", name: "Claims Assistant", number: "+14155550142", agent: "claims-v3", active: true },
  { id: "n2", name: "Renewals Bot", number: "+442071838750", agent: "renewals-v2", active: true },
  { id: "n3", name: "Support IVR (JP)", number: "+815031570123", agent: "support-jp-v1", active: false },
];

const isValidE164 = (v: string) => /^\+[1-9]\d{7,14}$/.test(v.trim());

const OutboundCalls = () => {
  const [numbers, setNumbers] = useState<AiNumber[]>(seedNumbers);
  const [defaults, setDefaults] = useState({
    defaultNumberId: "n1",
    recording: true,
    maxDuration: "600",
    timeout: "30",
  });
  const [hydrated, setHydrated] = useState(false);

  const [toNumber, setToNumber] = useState("");
  const [fromId, setFromId] = useState("n1");
  const [context, setContext] = useState("");
  const [dialing, setDialing] = useState(false);
  const [log, setLog] = useState<CallLogEntry[]>([]);

  const [newNumber, setNewNumber] = useState({ name: "", number: "", agent: "" });

  useEffect(() => {
    try {
      const rawNumbers = localStorage.getItem(NUMBERS_KEY);
      if (rawNumbers) setNumbers(JSON.parse(rawNumbers) as AiNumber[]);
      const rawDefaults = localStorage.getItem(DEFAULTS_KEY);
      if (rawDefaults) {
        const parsed = JSON.parse(rawDefaults) as {
          defaultNumberId: string;
          recording: boolean;
          maxDuration: string;
          timeout: string;
        };
        setDefaults(parsed);
        setFromId(parsed.defaultNumberId);
      }
    } catch {
      // keep seed defaults
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(NUMBERS_KEY, JSON.stringify(numbers));
  }, [numbers, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  }, [defaults, hydrated]);

  const activeNumbers = useMemo(() => numbers.filter((n) => n.active), [numbers]);
  const selectedFrom = useMemo(
    () => numbers.find((n) => n.id === fromId) ?? activeNumbers[0],
    [numbers, fromId, activeNumbers]
  );

  const handleCall = () => {
    if (!isValidE164(toNumber)) {
      toast.error("Enter a valid number in E.164 format, e.g. +14155550142");
      return;
    }
    if (!selectedFrom) {
      toast.error("Select an AI number to call from");
      return;
    }
    setDialing(true);
    const entry: CallLogEntry = {
      id: `CA${Math.random().toString(16).slice(2, 12)}`,
      to: toNumber.trim(),
      fromName: selectedFrom.name,
      fromNumber: selectedFrom.number,
      startedAt: new Date().toISOString(),
      status: "queued",
    };
    setLog((prev) => [entry, ...prev]);

    window.setTimeout(() => {
      setLog((prev) => prev.map((c) => (c.id === entry.id ? { ...c, status: "ringing" } : c)));
    }, 800);
    window.setTimeout(() => {
      setLog((prev) => prev.map((c) => (c.id === entry.id ? { ...c, status: "in-progress" } : c)));
      setDialing(false);
      toast.success(`Call connected to ${entry.to}`, {
        description: `From ${entry.fromName} (${entry.fromNumber})`,
      });
    }, 2000);
  };

  const addNumber = () => {
    if (!newNumber.name.trim()) {
      toast.error("Give the AI number a name");
      return;
    }
    if (!isValidE164(newNumber.number)) {
      toast.error("Number must be E.164 format, e.g. +14155550142");
      return;
    }
    const created: AiNumber = {
      id: `n${Date.now()}`,
      name: newNumber.name.trim(),
      number: newNumber.number.trim(),
      agent: newNumber.agent.trim() || "default-agent",
      active: true,
    };
    setNumbers((prev) => [...prev, created]);
    setNewNumber({ name: "", number: "", agent: "" });
    toast.success(`${created.name} added`);
  };

  const removeNumber = (id: string) => {
    setNumbers((prev) => prev.filter((n) => n.id !== id));
    if (fromId === id) setFromId("");
    toast.success("AI number removed");
  };

  const statusTone: Record<CallLogEntry["status"], string> = {
    queued: "bg-muted text-muted-foreground",
    ringing: "bg-chart-warning/15 text-chart-warning",
    "in-progress": "bg-primary/15 text-primary",
    completed: "bg-chart-success/15 text-chart-success",
    failed: "bg-destructive/15 text-destructive",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Outbound Calls</h1>
          <p className="text-muted-foreground">
            Place AI-agent calls and configure the numbers they dial from
          </p>
        </div>

        <Tabs defaultValue="dialer" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dialer" className="gap-2">
              <PhoneOutgoing className="w-4 h-4" />
              Dialer
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Dialer */}
          <TabsContent value="dialer" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-card/50 border-border/50 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-primary" />
                    New Call
                  </CardTitle>
                  <CardDescription>Dial a customer with your AI agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="to">To (customer number)</Label>
                    <Input
                      id="to"
                      placeholder="+14155550142"
                      value={toNumber}
                      onChange={(e) => setToNumber(e.target.value)}
                      className="bg-muted/50 border-border/50 font-mono"
                    />
                    <p className="text-xs text-muted-foreground">E.164 format including country code</p>
                  </div>

                  <div className="space-y-2">
                    <Label>From (AI number)</Label>
                    <Select value={selectedFrom?.id ?? ""} onValueChange={setFromId}>
                      <SelectTrigger className="bg-muted/50 border-border/50">
                        <SelectValue placeholder="Select an AI number" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeNumbers.length === 0 && (
                          <SelectItem value="none" disabled>
                            No active numbers — add one in Settings
                          </SelectItem>
                        )}
                        {activeNumbers.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name} — {n.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ctx">Call context (optional)</Label>
                    <Textarea
                      id="ctx"
                      rows={3}
                      placeholder="Policy number, customer name, purpose of the call…"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      className="bg-muted/50 border-border/50"
                    />
                  </div>

                  <Button onClick={handleCall} disabled={dialing} className="w-full gap-2">
                    {dialing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Dialing…
                      </>
                    ) : (
                      <>
                        <PhoneOutgoing className="w-4 h-4" />
                        Start Call
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-medium">Session Activity</CardTitle>
                  <CardDescription>Calls placed from this dialer</CardDescription>
                </CardHeader>
                <CardContent>
                  {log.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No calls placed yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Call SID</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {log.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.id}</TableCell>
                            <TableCell className="font-mono text-xs">{c.to}</TableCell>
                            <TableCell className="text-sm">
                              <div>{c.fromName}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {c.fromNumber}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.startedAt).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusTone[c.status]}`}
                              >
                                {c.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-medium">AI Numbers</CardTitle>
                <CardDescription>
                  Name each outbound number and map it to an agent configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="nn">Display name</Label>
                    <Input
                      id="nn"
                      placeholder="Claims Assistant"
                      value={newNumber.name}
                      onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })}
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="np">Phone number</Label>
                    <Input
                      id="np"
                      placeholder="+14155550142"
                      value={newNumber.number}
                      onChange={(e) => setNewNumber({ ...newNumber, number: e.target.value })}
                      className="bg-muted/50 border-border/50 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="na">Agent</Label>
                    <Input
                      id="na"
                      placeholder="claims-v3"
                      value={newNumber.agent}
                      onChange={(e) => setNewNumber({ ...newNumber, agent: e.target.value })}
                      className="bg-muted/50 border-border/50 font-mono"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={addNumber} className="w-full gap-2">
                      <Plus className="w-4 h-4" />
                      Add number
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {numbers.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {n.name}
                            {defaults.defaultNumberId === n.id && (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="w-3 h-3" /> Default
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{n.number}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {n.agent}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={n.active}
                            onCheckedChange={(checked) =>
                              setNumbers((prev) =>
                                prev.map((x) => (x.id === n.id ? { ...x, active: checked } : x))
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeNumber(n.id)}
                            aria-label={`Remove ${n.name}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-medium">Call Defaults</CardTitle>
                <CardDescription>Applied to every new outbound call</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default AI number</Label>
                    <p className="text-sm text-muted-foreground">Pre-selected in the dialer</p>
                  </div>
                  <Select
                    value={defaults.defaultNumberId}
                    onValueChange={(v) => setDefaults({ ...defaults, defaultNumberId: v })}
                  >
                    <SelectTrigger className="w-64 bg-muted/50 border-border/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {numbers.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator className="bg-border/50" />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Record calls</Label>
                    <p className="text-sm text-muted-foreground">
                      Store audio for QA and transcription
                    </p>
                  </div>
                  <Switch
                    checked={defaults.recording}
                    onCheckedChange={(checked) => setDefaults({ ...defaults, recording: checked })}
                  />
                </div>
                <Separator className="bg-border/50" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="md">Max call duration (seconds)</Label>
                    <Input
                      id="md"
                      type="number"
                      value={defaults.maxDuration}
                      onChange={(e) => setDefaults({ ...defaults, maxDuration: e.target.value })}
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-s">Ring timeout (seconds)</Label>
                    <Input
                      id="to-s"
                      type="number"
                      value={defaults.timeout}
                      onChange={(e) => setDefaults({ ...defaults, timeout: e.target.value })}
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => toast.success("Outbound settings saved")}>
                    Save settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default OutboundCalls;

"use client";

import { useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Play,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateTestCases,
  testCaseJson,
  download,
  type TestCase,
  type RunStatus,
} from "@/lib/testSuite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadTesting } from "@/components/dashboard/LoadTesting";
import { CallPathFlow } from "@/components/dashboard/CallPathFlow";

const statusMeta: Record<RunStatus, { label: string; className: string; icon: typeof Clock }> = {
  not_run: { label: "Not run", className: "bg-muted text-muted-foreground", icon: Clock },
  queued: { label: "Queued", className: "bg-info/15 text-info", icon: Clock },
  running: { label: "Running", className: "bg-warning/15 text-warning", icon: Loader2 },
  passed: { label: "Passed", className: "bg-success/15 text-success", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive", icon: XCircle },
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

const WorkflowSimulation = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ tc: TestCase; kind: "json" | "xml" | "path" } | null>(null);
  const [suiteLastRun, setSuiteLastRun] = useState<string | null>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    setSource(file.name);
    setProcessing(true);
    setProgress(0);
    setCases([]);
    setSelected([]);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setProcessing(false);
          setCases(generateTestCases(file.name));
          toast.success("Workflow processed", {
            description: "6 test cases with TwiML scripts generated.",
          });
          return 100;
        }
        return p + 10;
      });
    }, 120);
  };

  const runCases = async (ids: string[]) => {
    if (!ids.length) return;
    setCases((prev) =>
      prev.map((c) => (ids.includes(c.id) ? { ...c, status: "queued" } : c))
    );
    for (const id of ids) {
      setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: "running" } : c)));
      const duration = 700 + Math.floor(Math.random() * 900);
      await new Promise((r) => setTimeout(r, duration));
      const passed = Math.random() > 0.2;
      const ts = new Date().toISOString();
      setCases((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: passed ? "passed" : "failed", lastRun: ts, durationMs: duration }
            : c
        )
      );
    }
    setSuiteLastRun(new Date().toISOString());
    toast.success(`Run complete — ${ids.length} test case${ids.length > 1 ? "s" : ""}`);
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allSelected = cases.length > 0 && selected.length === cases.length;

  const downloadAll = () => {
    download(
      `testsuite-${source?.replace(/\.[^.]+$/, "") ?? "workflow"}.json`,
      JSON.stringify(
        {
          source,
          generatedAt: new Date().toISOString(),
          lastRun: suiteLastRun,
          testCases: cases.map((c) => JSON.parse(testCaseJson(c))),
          twiml: Object.fromEntries(cases.map((c) => [`${c.id}_customer.xml`, c.twiml])),
        },
        null,
        2
      ),
      "application/json"
    );
    toast.success("Suite exported");
  };

  const summary = {
    passed: cases.filter((c) => c.status === "passed").length,
    failed: cases.filter((c) => c.status === "failed").length,
    pending: cases.filter((c) => c.status === "not_run").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Workflow Simulation</h1>
            <p className="text-sm text-muted-foreground">
              Upload a workflow PDF to generate test cases and TwiML customer scripts, then simulate
              them against the voice agent.
            </p>
          </div>
          {cases.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="w-4 h-4 mr-2" />
                Export suite
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runCases(selected)}
                disabled={!selected.length}
              >
                <Play className="w-4 h-4 mr-2" />
                Run selected ({selected.length})
              </Button>
              <Button size="sm" onClick={() => runCases(cases.map((c) => c.id))}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run all
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="simulation" className="space-y-6">
          <TabsList>
            <TabsTrigger value="simulation">Test cases</TabsTrigger>
            <TabsTrigger value="load">Load testing</TabsTrigger>
          </TabsList>

          <TabsContent value="simulation" className="space-y-6">
        {/* Upload */}
        <Card>
          <CardContent className="p-6">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/70 py-10 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <Upload className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium">
                {source ? source : "Drop workflow PDF here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX or TXT — the workflow is parsed into scenario coverage
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            {processing && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting workflow steps and generating test cases…
                </div>
                <Progress value={progress} />
              </div>
            )}
          </CardContent>
        </Card>

        {cases.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Test cases", value: cases.length, tone: "text-foreground" },
                { label: "Passed", value: summary.passed, tone: "text-success" },
                { label: "Failed", value: summary.failed, tone: "text-destructive" },
                { label: "Not run", value: summary.pending, tone: "text-muted-foreground" },
              ].map((s) => (
                <Card key={s.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Generated test cases
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Suite last run: {fmt(suiteLastRun)}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(v) =>
                            setSelected(v ? cases.map((c) => c.id) : [])
                          }
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last run</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((tc) => {
                      const meta = statusMeta[tc.status];
                      const Icon = meta.icon;
                      return (
                        <TableRow
                          key={tc.id}
                          className="cursor-pointer"
                          onClick={() => setPreview({ tc, kind: "path" })}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.includes(tc.id)}
                              onCheckedChange={() => toggle(tc.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{tc.id}</TableCell>
                          <TableCell>
                            <p className="text-sm font-medium">{tc.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {tc.description}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {tc.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${meta.className}`}
                            >
                              <Icon
                                className={`w-3 h-3 ${tc.status === "running" ? "animate-spin" : ""}`}
                              />
                              {meta.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {fmt(tc.lastRun)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tc.durationMs ? `${(tc.durationMs / 1000).toFixed(2)}s` : "—"}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => runCases([tc.id])}
                                disabled={tc.status === "running"}
                              >
                                <Play className="w-3.5 h-3.5 mr-1" />
                                Run
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setPreview({ tc, kind: "json" })}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2" /> Test Case JSON
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setPreview({ tc, kind: "xml" })}
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2" /> TwiML XML
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
          </TabsContent>

          <TabsContent value="load">
            <LoadTesting cases={cases} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className={preview?.kind === "path" ? "max-w-5xl" : "max-w-3xl"}>
          <DialogHeader>
            <DialogTitle className="text-sm font-mono">
              {preview?.kind === "path"
                ? `${preview.tc.id} — Call path`
                : `${preview?.tc.id}${preview?.kind === "json" ? "_testcase.json" : "_customer.xml"}`}
            </DialogTitle>
          </DialogHeader>
          {preview?.kind === "path" ? (
            <div className="max-h-[65vh] overflow-auto pr-1">
              <CallPathFlow tc={preview.tc} />
            </div>
          ) : (
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-muted p-4 text-xs">
              {preview
                ? preview.kind === "json"
                  ? testCaseJson(preview.tc)
                  : preview.tc.twiml
                : ""}
            </pre>
          )}
          {preview && preview.kind !== "path" && (
            <Button
              variant="outline"
              size="sm"
              className="self-end"
              onClick={() =>
                download(
                  preview.kind === "json"
                    ? `${preview.tc.id}_testcase.json`
                    : `${preview.tc.id}_customer.xml`,
                  preview.kind === "json" ? testCaseJson(preview.tc) : preview.tc.twiml,
                  preview.kind === "json" ? "application/json" : "application/xml"
                )
              }
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default WorkflowSimulation;

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";
import {
  Search,
  Phone,
  PhoneOutgoing,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import type { CallEnvTag } from "@/lib/callEnvTag";

interface Call {
  id: string;
  timestamp: string;
  callerNumber: string;
  callType: "inbound" | "outbound";
  duration: number;
  status: "completed" | "failed" | "dropped" | "escalated" | "active";
  agentSteps: number;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  hasTranscript: boolean;
  cost: string;
  envTag?: CallEnvTag | null;
}

interface CallsTableProps {
  calls: Call[];
  className?: string;
  /** Reset local filters when the project / Call ID context changes. */
  resetKey?: string;
}

const sentimentColors = {
  positive: "text-success",
  neutral: "text-muted-foreground",
  negative: "text-destructive",
};

const envTagStyles: Record<CallEnvTag, string> = {
  UAT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DEV: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  PROD: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

export const CallsTable = ({ calls, className, resetKey }: CallsTableProps) => {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setSearch("");
    setStatusFilter("all");
    setSentimentFilter("all");
    setEnvFilter("all");
    setCurrentPage(1);
  }, [resetKey]);

  const filteredCalls = calls.filter((call) => {
    const matchesSearch =
      call.id.toLowerCase().includes(search.toLowerCase()) ||
      call.callerNumber.includes(search) ||
      call.intent.toLowerCase().includes(search.toLowerCase()) ||
      (call.envTag || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesSentiment =
      sentimentFilter === "all" || call.sentiment === sentimentFilter;
    const matchesEnv =
      envFilter === "all" ||
      (envFilter === "unknown" ? !call.envTag : call.envTag === envFilter);
    return matchesSearch && matchesStatus && matchesSentiment && matchesEnv;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCalls = filteredCalls.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("glass-card border border-border/50 rounded-xl", className)}>
      <div className="p-4 border-b border-border/50 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search Call SID, phone, intent, or env…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-background/50 border-border/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] bg-background/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="dropped">Dropped</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={envFilter}
              onValueChange={(v) => {
                setEnvFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[120px] bg-background/50 border-border/50">
                <SelectValue placeholder="Env" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Env</SelectItem>
                <SelectItem value="UAT">UAT</SelectItem>
                <SelectItem value="DEV">DEV</SelectItem>
                <SelectItem value="PROD">PROD</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sentimentFilter}
              onValueChange={(v) => {
                setSentimentFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] bg-background/50 border-border/50">
                <SelectValue placeholder="Sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiment</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredCalls.length} calls found</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Call ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Env</TableHead>
              <TableHead className="text-muted-foreground font-medium">Time</TableHead>
              <TableHead className="text-muted-foreground font-medium">Caller</TableHead>
              <TableHead className="text-muted-foreground font-medium">Type</TableHead>
              <TableHead className="text-muted-foreground font-medium">Duration</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Steps</TableHead>
              <TableHead className="text-muted-foreground font-medium">Sentiment</TableHead>
              <TableHead className="text-muted-foreground font-medium">Intent</TableHead>
              <TableHead className="text-muted-foreground font-medium text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCalls.map((call) => (
              <TableRow
                key={call.id}
                className="border-border/30 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/calls/${call.id}`)}
              >
                <TableCell className="font-mono text-xs text-primary">{call.id}</TableCell>
                <TableCell>
                  {call.envTag ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                        envTagStyles[call.envTag]
                      )}
                    >
                      {call.envTag}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(call.timestamp), "MMM d, HH:mm")}
                </TableCell>
                <TableCell className="font-mono text-sm">{call.callerNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {call.callType === "inbound" ? (
                      <Phone className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <PhoneOutgoing className="w-3.5 h-3.5 text-info" />
                    )}
                    <span className="text-xs capitalize">{call.callType}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatDuration(call.duration)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={call.status} size="sm" pulse={call.status === "active"} />
                </TableCell>
                <TableCell className="text-sm text-center">{call.agentSteps}</TableCell>
                <TableCell>
                  <span className={cn("text-sm capitalize", sentimentColors[call.sentiment])}>
                    {call.sentiment}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                    {call.intent.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">${call.cost}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between p-4 border-t border-border/50">
        <span className="text-sm text-muted-foreground">
          Page {safePage} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="border-border/50"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="border-border/50"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

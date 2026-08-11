"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Search, Users, Clock, TrendingUp, ChevronRight } from "lucide-react";

const sessions = [
  { id: "sess_8a21f", user: "u_4821", tenant: "Acme Corp", turns: 12, duration: "08:42", calls: 3, lastIntent: "transfer_funds", sentiment: "positive", started: "12m ago" },
  { id: "sess_77b9c", user: "u_9120", tenant: "Globex Inc", turns: 8, duration: "05:18", calls: 2, lastIntent: "check_balance", sentiment: "neutral", started: "34m ago" },
  { id: "sess_3d6e1", user: "u_3344", tenant: "Acme Corp", turns: 21, duration: "14:55", calls: 4, lastIntent: "report_issue", sentiment: "negative", started: "1h ago" },
  { id: "sess_b9012", user: "u_7710", tenant: "Initech", turns: 5, duration: "02:48", calls: 1, lastIntent: "account_info", sentiment: "positive", started: "2h ago" },
  { id: "sess_5511a", user: "u_2298", tenant: "Umbrella LLC", turns: 17, duration: "11:02", calls: 3, lastIntent: "speak_to_agent", sentiment: "negative", started: "3h ago" },
];

const timeline = [
  { t: "00:00", actor: "user", text: "Hi, I'd like to transfer money to my savings account." },
  { t: "00:03", actor: "agent", text: "Sure. How much would you like to transfer?", meta: "LLM 612ms · $0.0021" },
  { t: "00:09", actor: "user", text: "Five hundred dollars please." },
  { t: "00:12", actor: "agent", text: "Got it. Confirming a $500 transfer from checking to savings.", meta: "intent:transfer_funds · conf 0.96" },
  { t: "00:20", actor: "user", text: "Yes, confirm." },
  { t: "00:24", actor: "agent", text: "Transfer complete. Anything else?", meta: "tool:bank.transfer · 412ms" },
];

const Sessions = () => {
  const [selected, setSelected] = useState(sessions[0]);
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sessions & User Threads</h1>
          <p className="text-muted-foreground">Conversations grouped by session_id and user_id across multiple calls</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Active sessions", value: "318", icon: MessageSquare },
            { label: "Unique users (24h)", value: "1,284", icon: Users },
            { label: "Avg turns / session", value: "9.4", icon: TrendingUp },
            { label: "Avg session length", value: "06:18", icon: Clock },
          ].map((s) => (
            <Card key={s.label} className="bg-card/50 border-border/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10"><s.icon className="w-6 h-6 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Card className="bg-card/50 border-border/50 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Recent sessions</span>
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input placeholder="Search session_id / user_id" className="pl-8 h-9" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead><TableHead>User</TableHead><TableHead>Turns</TableHead>
                    <TableHead>Duration</TableHead><TableHead>Sentiment</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id} className={selected.id === s.id ? "bg-muted/30" : "cursor-pointer"} onClick={() => setSelected(s)}>
                      <TableCell className="font-mono text-xs">{s.id}</TableCell>
                      <TableCell className="font-mono text-xs">{s.user}</TableCell>
                      <TableCell>{s.turns}</TableCell>
                      <TableCell>{s.duration}</TableCell>
                      <TableCell>
                        <Badge variant={s.sentiment === "positive" ? "default" : s.sentiment === "negative" ? "destructive" : "secondary"}>
                          {s.sentiment}
                        </Badge>
                      </TableCell>
                      <TableCell><ChevronRight className="w-4 h-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Thread · <span className="font-mono text-xs">{selected.id}</span>
              </CardTitle>
              <div className="flex gap-2 pt-2 flex-wrap">
                <Badge variant="outline">{selected.tenant}</Badge>
                <Badge variant="outline">{selected.calls} calls</Badge>
                <Badge variant="outline">{selected.turns} turns</Badge>
                <Badge variant="outline">{selected.lastIntent}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[480px] overflow-y-auto">
              {timeline.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.actor === "user" ? "" : "flex-row-reverse"}`}>
                  <div className="text-xs text-muted-foreground w-12 pt-2">{m.t}</div>
                  <div className={`flex-1 rounded-lg p-3 text-sm ${m.actor === "user" ? "bg-muted" : "bg-primary/10"}`}>
                    <div className="text-xs text-muted-foreground mb-1 capitalize">{m.actor}</div>
                    {m.text}
                    {m.meta && <div className="text-xs text-muted-foreground mt-1 font-mono">{m.meta}</div>}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full mt-2">Open in trace view</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Sessions;

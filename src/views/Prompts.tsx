"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, GitCommit, FileText, ArrowLeftRight } from "lucide-react";

const prompts = [
  {
    name: "voice_agent_main",
    versions: [
      { v: "v12", date: "2026-06-22", author: "alex", traces: 8421, tag: "production", score: 0.91 },
      { v: "v11", date: "2026-06-15", author: "sam", traces: 14210, tag: "archived", score: 0.87 },
      { v: "v10", date: "2026-06-01", author: "alex", traces: 9304, tag: "archived", score: 0.84 },
    ],
  },
  {
    name: "intent_classifier",
    versions: [
      { v: "v4", date: "2026-06-20", author: "jamie", traces: 3120, tag: "production", score: 0.94 },
      { v: "v3", date: "2026-05-30", author: "jamie", traces: 2104, tag: "archived", score: 0.89 },
    ],
  },
];

const v11 = `You are a helpful banking voice assistant.
Always confirm the user's identity before sharing account info.
Keep responses under 2 sentences.`;

const v12 = `You are a helpful banking voice assistant.
Always confirm the user's identity before sharing account info.
Keep responses under 2 sentences.
If the user sounds frustrated, offer to transfer to a human agent.`;

const Prompts = () => {
  const [selected, setSelected] = useState(prompts[0]);
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Prompt Registry</h1>
            <p className="text-muted-foreground">Versioned prompts with diff, rollback and trace linkage</p>
          </div>
          <Button><Plus className="w-4 h-4 mr-2" />New prompt</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="text-base font-medium">Prompts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {prompts.map((p) => (
                <div
                  key={p.name}
                  onClick={() => setSelected(p)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer flex items-center gap-2",
                    selected.name === p.name ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border/50 hover:bg-muted/40"
                  )}
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.versions.length} versions</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base font-medium">{selected.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2">Version</th>
                    <th className="text-left">Date</th>
                    <th className="text-left">Author</th>
                    <th className="text-left">Traces</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Tag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {selected.versions.map((v) => (
                    <tr key={v.v} className="border-b border-border/30">
                      <td className="py-2 font-mono">{v.v}</td>
                      <td className="text-muted-foreground">{v.date}</td>
                      <td>{v.author}</td>
                      <td>{v.traces.toLocaleString()}</td>
                      <td>{v.score.toFixed(2)}</td>
                      <td>
                        <Badge variant={v.tag === "production" ? "secondary" : "outline"}>{v.tag}</Badge>
                      </td>
                      <td>
                        <Button size="sm" variant="ghost">Rollback</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ArrowLeftRight className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Diff v11 → v12</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <pre className="bg-muted/30 border border-border/50 rounded p-3 text-xs overflow-auto">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><GitCommit className="w-3 h-3" />v11</div>
                    {v11}
                  </pre>
                  <pre className="bg-muted/30 border border-border/50 rounded p-3 text-xs overflow-auto">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><GitCommit className="w-3 h-3" />v12</div>
                    {v12.split("\n").map((line, i) => (
                      <div key={i} className={i === 3 ? "bg-chart-success/20 text-chart-success" : ""}>{line}</div>
                    ))}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Prompts;

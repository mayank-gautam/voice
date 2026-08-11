"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderKanban, Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { ProjectConfigForm } from "@/components/project/ProjectConfigForm";
import { useProjects, type ProjectConfig } from "@/lib/projectConfig";
import { parseLogGroupPatterns } from "@/lib/cloudWatchLogGroups";

export const ProjectSettingsCard = () => {
  const { projects, activeId, setActiveProject, upsertProject, deleteProject, loading } =
    useProjects();
  const [editing, setEditing] = useState<{ project?: ProjectConfig } | null>(null);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            CloudWatch projects
          </CardTitle>
          <CardDescription>
            Log group and Insights settings per project. AWS SSO and Twilio (env per account) are
            configured separately.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setEditing({})}>
          <Plus className="w-4 h-4" /> New project
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">No projects configured yet.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{p.name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {p.environment}
                </Badge>
                {p.id === activeId && (
                  <Badge className="text-[10px] gap-1">
                    <Check className="w-3 h-3" /> Active
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                {p.id !== activeId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await setActiveProject(p.id);
                      toast.success(`Switched to ${p.name}`);
                    }}
                  >
                    Switch
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setEditing({ project: p })}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    await deleteProject(p.id);
                    toast.success("Project removed");
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-muted-foreground font-mono">
              <span>AWS region: {p.aws.region}</span>
              <span className="sm:col-span-2 whitespace-pre-wrap break-all">
                CW log groups:{" "}
                {p.aws.cloudWatchLogGroup
                  ? parseLogGroupPatterns(p.aws.cloudWatchLogGroup).join(" · ") || "—"
                  : "—"}
              </span>
              <span className="sm:col-span-2 whitespace-pre-wrap break-all">
                CW Insights filter:{" "}
                {p.aws.cloudWatchFilterPattern?.trim()
                  ? p.aws.cloudWatchFilterPattern.trim().slice(0, 120) +
                    (p.aws.cloudWatchFilterPattern.trim().length > 120 ? "…" : "")
                  : 'SOURCE… | filter @message like /{callId}/ (default)'}
              </span>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.project ? "Edit project" : "New project"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProjectConfigForm
              initial={editing.project}
              submitLabel={editing.project ? "Save changes" : "Create project"}
              onCancel={() => setEditing(null)}
              onSubmit={async (p) => {
                try {
                  await upsertProject(p);
                  setEditing(null);
                  toast.success(editing.project ? "Project updated" : "Project created", {
                    description: p.name,
                  });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to save project");
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

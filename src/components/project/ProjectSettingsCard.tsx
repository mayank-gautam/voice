"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Check } from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/lib/projectConfig";
import { useGlobalLoading } from "@/lib/loading";
import { formatProjectNameDisplay } from "@/lib/formatProjectName";

/**
 * App Settings: shows projects from account-hierarchy for the current AWS account.
 * Active project is the single source of truth (cookie + localStorage + server meta).
 */
export const ProjectSettingsCard = () => {
  const { projects, activeId, setActiveProject, loading } = useProjects();
  const { withLoading } = useGlobalLoading();

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            Active project
          </CardTitle>
          <CardDescription>
            Projects and Twilio credentials come from{" "}
            <code className="text-[11px]">account-hierarchy.json</code> for your signed-in AWS
            account. Switching here updates App Settings for the whole app.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading projects…</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No projects for this AWS account in account-hierarchy.
          </p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium tracking-wide">
                  {formatProjectNameDisplay(p.name)}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {p.id}
                </Badge>
                {p.hasTwilio ? (
                  <Badge variant="outline" className="text-[10px] text-chart-success">
                    Twilio configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    No Twilio
                  </Badge>
                )}
                {p.id === activeId && (
                  <Badge className="text-[10px] gap-1">
                    <Check className="w-3 h-3" /> Active
                  </Badge>
                )}
              </div>
              {p.id !== activeId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await withLoading(
                        async () => {
                          await setActiveProject(p.id);
                        },
                        `Switching to ${formatProjectNameDisplay(p.name)}…`,
                      );
                      toast.success(`Switched to ${formatProjectNameDisplay(p.name)}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Unable to switch project");
                    }
                  }}
                >
                  Switch
                </Button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              AWS account: {p.awsAccountId || "—"}
              {p.awsRoleName ? ` · role: ${p.awsRoleName}` : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

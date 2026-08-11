"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Cpu, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ProjectConfigForm } from "@/components/project/ProjectConfigForm";
import {
  AccountHierarchyCascade,
  type HierarchyCascadeSelection,
} from "@/components/project/AccountHierarchyCascade";
import { emptyProject, upsertProject, type ProjectConfig } from "@/lib/projectConfig";

const ProjectSetup = () => {
  const router = useRouter();
  const [formSeed, setFormSeed] = useState<ProjectConfig>(() => emptyProject());

  const onHierarchyChange = useCallback((sel: HierarchyCascadeSelection) => {
    if (!sel.projectId || !sel.projectName) return;
    setFormSeed((prev) => ({
      ...prev,
      id:
        prev.awsAccountId === (sel.accountId ?? "") &&
        prev.awsRoleName === (sel.roleName ?? "") &&
        prev.name === sel.projectName
          ? prev.id
          : emptyProject().id,
      name: sel.projectName,
      awsAccountId: sel.accountId ?? "",
      awsRoleName: sel.roleName ?? "",
      aws: {
        ...prev.aws,
        cloudWatchLogGroup: sel.groups.join("; "),
      },
    }));
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-chart-success/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-2xl bg-card/50 border-border/50 backdrop-blur-xl relative z-10 my-8">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
            <Cpu className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Configure CloudWatch project</CardTitle>
            <CardDescription>
              Pick Account → Role → Project → Twilio groups from the hierarchy config, then tune
              CloudWatch settings. Twilio credentials stay in env per AWS account.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2 rounded-lg border border-chart-warning/40 bg-chart-warning/10 p-3 text-xs">
            <ShieldAlert className="w-4 h-4 text-chart-warning shrink-0 mt-0.5" />
            <span>
              Hierarchy options come from{" "}
              <code className="text-[10px]">.data/account-hierarchy.json</code> (dummy IDs only).
              Changing account or role resets the project and group lists automatically.
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Access hierarchy</p>
            <AccountHierarchyCascade onSelectionChange={onHierarchyChange} />
          </div>

          <Separator />

          <ProjectConfigForm
            key={formSeed.id}
            initial={formSeed}
            submitLabel="Save & continue"
            onCancel={() => router.push("/")}
            onSubmit={async (p) => {
              try {
                await upsertProject(p);
                toast.success("Project configured", { description: p.name });
                router.push("/");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to save project");
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectSetup;

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cloud } from "lucide-react";
import {
  awsRegions,
  emptyProject,
  type ProjectConfig,
} from "@/lib/projectConfig";
import { normalizeLogGroupPatterns, parseLogGroupPatterns } from "@/lib/cloudWatchLogGroups";
import {
  DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
  resolveCloudWatchInsightsFilter,
} from "@/lib/cloudWatchInsightsQuery";

interface Props {
  initial?: ProjectConfig;
  submitLabel?: string;
  onSubmit: (project: ProjectConfig) => void;
  onCancel?: () => void;
}

function withProjectDefaults(project: ProjectConfig): ProjectConfig {
  return {
    ...project,
    aws: {
      ...project.aws,
      cloudWatchFilterPattern: resolveCloudWatchInsightsFilter(
        project.aws.cloudWatchFilterPattern,
      ),
    },
  };
}

export const ProjectConfigForm = ({
  initial,
  submitLabel = "Save project",
  onSubmit,
  onCancel,
}: Props) => {
  const [form, setForm] = useState<ProjectConfig>(() =>
    withProjectDefaults(initial ?? emptyProject()),
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProjectConfig>(k: K, v: ProjectConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) return setError("Project name is required.");
    setError(null);
    onSubmit({
      ...form,
      name: form.name.trim(),
      aws: {
        ...form.aws,
        cloudWatchLogGroup: normalizeLogGroupPatterns(form.aws.cloudWatchLogGroup),
        cloudWatchFilterPattern:
          form.aws.cloudWatchFilterPattern?.trim() || DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="pname">Project name</Label>
          <Input
            id="pname"
            placeholder="Production logs"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Environment</Label>
          <Select
            value={form.environment}
            onValueChange={(v) => set("environment", v as ProjectConfig["environment"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Projects store CloudWatch log group patterns (the project&apos;s log
        groups). AWS access uses SSO; Twilio credentials stay server-side in env
        per AWS account ID.
      </p>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Cloud className="w-4 h-4 text-primary" /> Project log groups (CloudWatch)
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>AWS region</Label>
            <Select
              value={form.aws.region}
              onValueChange={(v) => set("aws", { ...form.aws, region: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {awsRegions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cwlg">CloudWatch log groups (optional)</Label>
            <textarea
              id="cwlg"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="/aws/lambda/sb-psuat1-*-agai*; /ecs/sb-psuat1-*-agai*"
              value={form.aws.cloudWatchLogGroup ?? ""}
              onChange={(e) => set("aws", { ...form.aws, cloudWatchLogGroup: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Separate with <code className="text-[10px]">;</code>. Use{" "}
              <code className="text-[10px]">*</code> wildcards.
            </p>
            {parseLogGroupPatterns(form.aws.cloudWatchLogGroup).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {parseLogGroupPatterns(form.aws.cloudWatchLogGroup).map((pattern) => (
                  <span
                    key={pattern}
                    className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground"
                    title={pattern}
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cwfp">CloudWatch Logs Insights filter</Label>
            <textarea
              id="cwfp"
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={DEFAULT_CLOUDWATCH_INSIGHTS_FILTER}
              value={form.aws.cloudWatchFilterPattern ?? ""}
              onChange={(e) => set("aws", { ...form.aws, cloudWatchFilterPattern: e.target.value })}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                <code className="text-[10px]">{"{callId}"}</code> is replaced with the call SID.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() =>
                  set("aws", {
                    ...form.aws,
                    cloudWatchFilterPattern: DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
                  })
                }
              >
                Reset to default
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </div>
  );
};

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, FolderKanban, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { toastError, toUserFacingMessage } from "@/lib/userFacingError";
import { formatProjectNameDisplay } from "@/lib/formatProjectName";
import { useProjects } from "@/lib/projectConfig";
import { useGlobalLoading } from "@/lib/loading";

export const ProjectSwitcher = () => {
  const router = useRouter();
  const { projects, activeId, active, loading, error, setActiveProject } = useProjects();
  const { withLoading, isLoading: globalLoading } = useGlobalLoading();

  if (loading) {
    if (globalLoading) return null;
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <FolderKanban className="w-4 h-4 text-muted-foreground" />
        Loading projects…
      </Button>
    );
  }

  if (error) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2 max-w-[240px] text-destructive"
        title={toUserFacingMessage(error)}
        disabled
      >
        <FolderKanban className="w-4 h-4" />
        <span className="truncate">Projects unavailable</span>
      </Button>
    );
  }

  if (projects.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <FolderKanban className="w-4 h-4" />
        No projects
      </Button>
    );
  }

  const activeLabel = formatProjectNameDisplay(active?.name) || "SELECT PROJECT";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-border/50 max-w-[220px]">
          <FolderKanban className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate tracking-wide">{activeLabel}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
        <DropdownMenuLabel className="text-xs">
          Projects for current AWS account
        </DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem
            key={p.id}
            disabled={p.id === activeId}
            onClick={async () => {
              if (p.id === activeId) return;
              try {
                await withLoading(
                  async () => {
                    await setActiveProject(p.id);
                  },
                  `Switching to ${formatProjectNameDisplay(p.name)}…`,
                );
                toast.success(`Switched to ${formatProjectNameDisplay(p.name)}`);
              } catch (e) {
                toastError(e instanceof Error ? e.message : "Unable to switch project");
              }
            }}
            className="gap-2"
          >
            <Check className={`w-4 h-4 ${p.id === activeId ? "opacity-100 text-primary" : "opacity-0"}`} />
            <span className="flex-1 truncate tracking-wide">
              {formatProjectNameDisplay(p.name)}
            </span>
            {p.hasTwilio === false && (
              <Badge variant="outline" className="text-[10px]">
                No Twilio
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
          <Settings2 className="w-4 h-4" /> App settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
import { Check, ChevronsUpDown, FolderKanban, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useProjects } from "@/lib/projectConfig";
import { useGlobalLoading } from "@/lib/loading";

export const ProjectSwitcher = () => {
  const router = useRouter();
  const { projects, activeId, active, loading, error, setActiveProject } = useProjects();
  const { withLoading } = useGlobalLoading();

  if (loading) {
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
        onClick={() => router.push("/project-setup")}
        title={error}
      >
        <FolderKanban className="w-4 h-4" />
        <span className="truncate">Projects unavailable</span>
      </Button>
    );
  }

  if (projects.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push("/project-setup")}>
        <Plus className="w-4 h-4" />
        Configure project
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-border/50 max-w-[220px]">
          <FolderKanban className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{active?.name ?? "Select project"}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
        <DropdownMenuLabel className="text-xs">
          Projects for current AWS role
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
                  `Switching to ${p.name}…`,
                );
                toast.success(`Switched to ${p.name}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Unable to switch project");
              }
            }}
            className="gap-2"
          >
            <Check className={`w-4 h-4 ${p.id === activeId ? "opacity-100 text-primary" : "opacity-0"}`} />
            <span className="flex-1 truncate">{p.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {p.environment}
            </Badge>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/project-setup")} className="gap-2">
          <Plus className="w-4 h-4" /> Add new project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
          <Settings2 className="w-4 h-4" /> Manage projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

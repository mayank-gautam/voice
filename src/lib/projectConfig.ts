import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CLOUDWATCH_INSIGHTS_FILTER } from "@/lib/cloudWatchInsightsQuery";
import { apiFetch, type ApiClientError } from "@/lib/api-client";

export interface ProjectConfig {
  id: string;
  name: string;
  environment: "development" | "staging" | "production";
  /** Set by the server from the authenticated AWS account/role. */
  awsAccountId?: string;
  awsRoleName?: string;
  /** True when Twilio is configured for this project in account-hierarchy. */
  hasTwilio?: boolean;
  aws: {
    region: string;
    cloudWatchLogGroup?: string;
    cloudWatchFilterPattern?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_KEY = "voiceai.activeProjectId";
export const PROJECTS_CHANGED_EVENT = "voiceai:projects-changed";
const EVENT = PROJECTS_CHANGED_EVENT;

export const emptyProject = (): ProjectConfig => ({
  id: `prj_${Math.random().toString(36).slice(2, 10)}`,
  name: "",
  environment: "development",
  awsAccountId: "",
  awsRoleName: "",
  aws: {
    region: "us-east-1",
    cloudWatchLogGroup: "",
    cloudWatchFilterPattern: DEFAULT_CLOUDWATCH_INSIGHTS_FILTER,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const awsRegions = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
];

const isBrowser = () => typeof window !== "undefined";

const notify = () => {
  if (isBrowser()) window.dispatchEvent(new Event(EVENT));
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ||
        `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export async function fetchProjects(): Promise<{
  projects: ProjectConfig[];
  activeProjectId: string | null;
}> {
  const data = await parseJson<{ projects: ProjectConfig[]; activeProjectId: string | null }>(
    await apiFetch("/api/projects"),
  );
  return data;
}

export async function upsertProject(project: ProjectConfig): Promise<ProjectConfig> {
  const existing = await apiFetch(`/api/projects/${project.id}`);

  if (existing.ok) {
    const data = await parseJson<{ project: ProjectConfig }>(
      await apiFetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      }),
    );
    notify();
    return data.project;
  }

  const data = await parseJson<{ project: ProjectConfig }>(
    await apiFetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    }),
  );
  if (isBrowser()) localStorage.setItem(ACTIVE_KEY, data.project.id);
  notify();
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await parseJson(await apiFetch(`/api/projects/${id}`, { method: "DELETE" }));
  if (isBrowser() && localStorage.getItem(ACTIVE_KEY) === id) {
    localStorage.removeItem(ACTIVE_KEY);
  }
  notify();
}

export async function activateProject(id: string): Promise<void> {
  await parseJson(await apiFetch(`/api/projects/${id}/activate`, { method: "POST" }));
  if (isBrowser()) localStorage.setItem(ACTIVE_KEY, id);
  notify();
}

export const getActiveProjectId = (): string | null =>
  isBrowser() ? localStorage.getItem(ACTIVE_KEY) : null;

export async function checkConfigured(): Promise<boolean> {
  try {
    const data = await fetchProjects();
    return data.projects.length > 0;
  } catch {
    return Boolean(getActiveProjectId());
  }
}

export const isConfigured = () => Boolean(getActiveProjectId());

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchProjects();
      setProjects(data.projects);
      setActiveId(data.activeProjectId);
      if (isBrowser() && data.activeProjectId) {
        localStorage.setItem(ACTIVE_KEY, data.activeProjectId);
      }
    } catch (e) {
      // Shared apiFetch already started single-flight SSO redirect.
      if ((e as ApiClientError)?.code === "AUTH_REQUIRED") {
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load projects");
      setProjects([]);
      setActiveId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void sync();
    const onChange = () => void sync();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [sync]);

  return {
    projects,
    activeId,
    active: projects.find((p) => p.id === activeId) ?? null,
    loading,
    error,
    refresh: sync,
    setActiveProject: async (id: string) => {
      await activateProject(id);
      await sync();
    },
    upsertProject: async (project: ProjectConfig) => {
      const saved = await upsertProject(project);
      await sync();
      return saved;
    },
    deleteProject: async (id: string) => {
      await deleteProject(id);
      await sync();
    },
  };
};

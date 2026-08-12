"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  areAwsCredentialsExpired,
  clearAllCredentials,
  clearAwsSsoToken,
  clearStoredAccountCredentials,
  getCredentials,
  getSelectedCredentials,
  getValidAwsSsoToken,
  saveAwsSsoToken,
  saveAwsCredentials,
  setSelectedCredentials,
  setActiveProjectIdSetting,
} from "@/lib/credentials-store";

import { PROJECTS_CHANGED_EVENT } from "@/lib/projectConfig";

import { sanitizeReturnTo } from "@/lib/auth-return-to";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AwsAccount = {
  accountId: string;
  accountName: string;
  emailAddress: string | null;
};

type AwsRole = {
  accountId: string;
  roleName: string;
};

type SessionSummary = {
  accountId?: string;
  accountName?: string;
  roleName?: string;
  awsExpiration?: string;
};

type DeviceLoginProps = {
  initialSession?: SessionSummary | null;
};

type DeviceAuthorizationData = {
  clientId: string;
  clientSecret: string;
  deviceCode: string;
  region: string;
};

type AuthState =
  | {
      kind: "checking-session";
    }
  | {
      kind: "idle";
    }
  | {
      kind: "waiting";
      userCode: string;
      verificationUri?: string;
      verificationUriComplete?: string;
    }
  | {
      kind: "loading-accounts";
    }
  | {
      kind: "select-account";
      accounts: AwsAccount[];
    }
  | {
      kind: "loading-roles";
      account: AwsAccount;
    }
  | {
      kind: "select-role";
      account: AwsAccount;
      roles: AwsRole[];
    }
  | {
      kind: "loading-projects";
      account: AwsAccount;
      role: AwsRole;
    }
  | {
      kind: "select-project";
      account: AwsAccount;
      role: AwsRole;
      projects: MappedProjectOption[];
    }
  | {
      kind: "creating-credentials";
      account: AwsAccount;
      role: AwsRole;
      projectId: string;
    }
  | {
      kind: "error";
      message: string;
      retryType: "login" | "accounts" | "roles" | "projects" | "credentials";
      account?: AwsAccount;
      role?: AwsRole;
      projectId?: string;
    };

type MappedProjectOption = {
  id: string;
  name: string;
  hasTwilio: boolean;
  hasTenantId: boolean;
};

type LoginApiResponse = {
  clientId?: string;
  clientSecret?: string;
  deviceCode?: string;

  userCode?: string;
  verificationUri?: string;
  verificationUriComplete?: string;

  expiresIn?: number;
  interval?: number;
  region?: string;

  error?: string;
  message?: string;
};

type PollResponse = {
  status: "pending" | "slow_down" | "authenticated" | "expired" | "error";

  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  region?: string;

  error?: string;
  message?: string;
};

type AccountsApiResponse = {
  success: boolean;
  accounts?: AwsAccount[];
  total?: number;
  message?: string;

  error?: {
    code?: string;
    message?: string;
  };
};

type RolesApiResponse = {
  success: boolean;
  roles?: AwsRole[];
  total?: number;
  message?: string;

  error?: {
    code?: string;
    message?: string;
  };
};

type RoleCredentialsApiResponse = {
  success: boolean;

  account?: {
    accountId: string;
  };

  roleName?: string;

  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: string;
  };

  twilio?: {
    accountSid: string;
    authToken: string;
    phoneNumber?: string;
    apiKeySid?: string;
    apiKeySecret?: string;
  };

  message?: string;
  code?: string;
  missingFields?: string[];

  error?: {
    code?: string;
    message?: string;
  };
};

type SessionApiResponse = {
  success: boolean;
  message?: string;

  error?: {
    code?: string;
    message?: string;
  };
};

/* -------------------------------------------------------------------------- */
/* Styling                                                                    */
/* -------------------------------------------------------------------------- */

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function parseJsonResponse<T>(
  response: Response,
  resourceName: string,
): Promise<T> {
  const rawResponse = await response.text();

  if (!rawResponse.trim()) {
    throw new Error(
      `${resourceName} returned an empty response with status ${response.status}.`,
    );
  }

  try {
    return JSON.parse(rawResponse) as T;
  } catch {
    throw new Error(
      `${resourceName} returned invalid JSON with status ${response.status}.`,
    );
  }
}

function getApiMessage(
  data:
    | {
        message?: string;
        error?: {
          message?: string;
        };
      }
    | null
    | undefined,
  fallback: string,
): string {
  return data?.error?.message || data?.message || fallback;
}

function isTokenError(status: number, message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    normalizedMessage.includes("token") ||
    normalizedMessage.includes("expired") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden") ||
    normalizedMessage.includes("invalid_grant")
  );
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function DeviceLogin({ initialSession }: DeviceLoginProps) {
  const router = useRouter();

  const [state, setState] = useState<AuthState>({
    kind: "checking-session",
  });

  const [isStartingLogin, setIsStartingLogin] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const accessTokenRef = useRef("");

  const regionRef = useRef("us-east-1");

  const deviceAuthorizationRef = useRef<DeviceAuthorizationData | null>(null);

  const pollAbortControllerRef = useRef<AbortController | null>(null);

  const selectedAccountRef = useRef<AwsAccount | null>(null);

  const selectedRoleRef = useRef<AwsRole | null>(null);

  const redirectStartedRef = useRef(false);

  /* ------------------------------------------------------------------------ */
  /* Create or restore server cookie session                                  */
  /* ------------------------------------------------------------------------ */

  const ensureServerSession = useCallback(
    async (
      accountId: string,
      accountName: string | undefined,
      roleName: string,
      expiration: string,
    ): Promise<void> => {
      const response = await fetch("/api/auth/session", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        cache: "no-store",

        body: JSON.stringify({
          accountId,
          accountName,
          roleName,
          expiration,
        }),
      });

      const result = await parseJsonResponse<SessionApiResponse>(
        response,
        "Session API",
      );

      if (!response.ok || !result.success) {
        throw new Error(
          getApiMessage(result, "Unable to create the application session."),
        );
      }
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Fetch AWS accounts                                                       */
  /* ------------------------------------------------------------------------ */

  const fetchAwsAccounts = useCallback(
    async (accessToken: string, region: string): Promise<AwsAccount[]> => {
      const normalizedAccessToken = accessToken.trim();

      const normalizedRegion = region.trim() || "us-east-1";

      if (!normalizedAccessToken) {
        throw new Error("AWS SSO access token is unavailable.");
      }

      setState({
        kind: "loading-accounts",
      });

      const response = await fetch("/api/aws/accounts", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        cache: "no-store",

        body: JSON.stringify({
          accessToken: normalizedAccessToken,

          region: normalizedRegion,
        }),
      });

      const result = await parseJsonResponse<AccountsApiResponse>(
        response,
        "Accounts API",
      );

      if (!response.ok || !result.success) {
        const message = getApiMessage(result, "Unable to fetch AWS accounts.");

        if (isTokenError(response.status, message)) {
          await clearAwsSsoToken();

          accessTokenRef.current = "";

          throw new Error(
            "Your AWS SSO session has expired. Please approve sign-in again.",
          );
        }

        throw new Error(message);
      }

      const accounts = result.accounts ?? [];

      if (accounts.length === 0) {
        throw new Error("No AWS accounts are assigned to this user.");
      }

      // Intersect SSO accounts with twilio-mappings catalog (source of truth).
      const catalogRes = await fetch("/api/mappings/catalog", { cache: "no-store" });
      const catalog = (await catalogRes.json().catch(() => ({}))) as {
        accounts?: Array<{ accountId: string; roles: string[] }>;
      };
      const mappedAccountIds = new Set(
        (catalog.accounts || []).map((entry) => entry.accountId),
      );

      const filteredAccounts =
        mappedAccountIds.size > 0
          ? accounts.filter((account) => mappedAccountIds.has(account.accountId))
          : [];

      if (filteredAccounts.length === 0) {
        throw new Error(
          "No AWS accounts from your SSO session are present in twilio-mappings.json.",
        );
      }

      const sortedAccounts = [...filteredAccounts].sort((first, second) => {
        const firstName = first.accountName || first.accountId;

        const secondName = second.accountName || second.accountId;

        return firstName.localeCompare(secondName);
      });

      accessTokenRef.current = normalizedAccessToken;

      regionRef.current = normalizedRegion;

      setState({
        kind: "select-account",
        accounts: sortedAccounts,
      });

      return sortedAccounts;
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Fetch AWS roles                                                          */
  /* ------------------------------------------------------------------------ */

  const fetchAwsRoles = useCallback(
    async (
      account: AwsAccount,
      accessToken: string,
      region: string,
    ): Promise<AwsRole[]> => {
      const normalizedAccessToken = accessToken.trim();

      const normalizedRegion = region.trim() || "us-east-1";

      if (!normalizedAccessToken) {
        throw new Error("AWS SSO access token is unavailable.");
      }

      selectedAccountRef.current = account;

      selectedRoleRef.current = null;

      setState({
        kind: "loading-roles",
        account,
      });

      const response = await fetch("/api/aws/roles", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        cache: "no-store",

        body: JSON.stringify({
          accessToken: normalizedAccessToken,

          accountId: account.accountId,

          region: normalizedRegion,
        }),
      });

      const result = await parseJsonResponse<RolesApiResponse>(
        response,
        "Roles API",
      );

      if (!response.ok || !result.success) {
        const message = getApiMessage(result, "Unable to fetch AWS roles.");

        if (isTokenError(response.status, message)) {
          await clearAwsSsoToken();

          accessTokenRef.current = "";

          throw new Error(
            "Your AWS SSO session has expired. Please approve sign-in again.",
          );
        }

        throw new Error(message);
      }

      const roles = result.roles ?? [];

      if (roles.length === 0) {
        throw new Error(
          "No IAM Identity Center roles are assigned to this account.",
        );
      }

      const catalogRes = await fetch("/api/mappings/catalog", { cache: "no-store" });
      const catalog = (await catalogRes.json().catch(() => ({}))) as {
        accounts?: Array<{ accountId: string; roles: string[] }>;
      };
      const mappedRoles = new Set(
        (catalog.accounts || []).find((entry) => entry.accountId === account.accountId)
          ?.roles || [],
      );

      const filteredRoles =
        mappedRoles.size > 0
          ? roles.filter((role) => mappedRoles.has(role.roleName))
          : [];

      if (filteredRoles.length === 0) {
        throw new Error(
          "No roles for this AWS account are present in twilio-mappings.json.",
        );
      }

      const sortedRoles = [...filteredRoles].sort((first, second) =>
        first.roleName.localeCompare(second.roleName),
      );

      accessTokenRef.current = normalizedAccessToken;

      regionRef.current = normalizedRegion;

      setState({
        kind: "select-role",
        account,
        roles: sortedRoles,
      });

      return sortedRoles;
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Restore existing login                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      try {
        setState({
          kind: "checking-session",
        });

        /*
         * Returning users: reuse a valid SSO access/refresh token and show
         * account selection. Do NOT auto-enter the dashboard from stale role
         * credentials — the user must pick account → role again.
         * Device approval is skipped while the SSO token can be refreshed.
         */
        const cachedSsoToken = await getValidAwsSsoToken();

        if (!cachedSsoToken) {
          if (!cancelled) {
            setState({
              kind: "idle",
            });
          }

          return;
        }

        accessTokenRef.current = cachedSsoToken.accessToken;
        regionRef.current = cachedSsoToken.region;

        await fetchAwsAccounts(
          cachedSsoToken.accessToken,
          cachedSsoToken.region,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to restore AWS session.";

        if (isTokenError(0, message)) {
          await clearAwsSsoToken();

          accessTokenRef.current = "";

          setState({
            kind: "idle",
          });

          return;
        }

        setState({
          kind: "error",
          message,
          retryType: "accounts",
        });
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [fetchAwsAccounts]);

  /* ------------------------------------------------------------------------ */
  /* Start fresh AWS SSO login                                                */
  /* ------------------------------------------------------------------------ */

  const startLogin = useCallback(async (): Promise<void> => {
    try {
      setIsStartingLogin(true);

      pollAbortControllerRef.current?.abort();

      /*
       * Reuse cached / refreshed SSO access token when possible.
       * Device approval is only needed when no refreshable session exists.
       */
      const cachedSsoToken = await getValidAwsSsoToken();

      if (cachedSsoToken) {
        accessTokenRef.current = cachedSsoToken.accessToken;
        regionRef.current = cachedSsoToken.region;
        redirectStartedRef.current = false;

        await fetchAwsAccounts(
          cachedSsoToken.accessToken,
          cachedSsoToken.region,
        );
        return;
      }

      await clearStoredAccountCredentials();

      accessTokenRef.current = "";

      regionRef.current = "us-east-1";

      deviceAuthorizationRef.current = null;

      selectedAccountRef.current = null;

      selectedRoleRef.current = null;

      redirectStartedRef.current = false;

      const response = await fetch("/api/auth/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        cache: "no-store",
      });

      const data = await parseJsonResponse<LoginApiResponse>(
        response,
        "AWS login API",
      );

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to start AWS SSO login.",
        );
      }

      if (
        !data.clientId ||
        !data.clientSecret ||
        !data.deviceCode ||
        !data.userCode
      ) {
        throw new Error("AWS device authorization response is incomplete.");
      }

      const region = data.region || "us-east-1";

      deviceAuthorizationRef.current = {
        clientId: data.clientId,

        clientSecret: data.clientSecret,

        deviceCode: data.deviceCode,

        region,
      };

      regionRef.current = region;

      setState({
        kind: "waiting",

        userCode: data.userCode,

        verificationUri: data.verificationUri,

        verificationUriComplete: data.verificationUriComplete,
      });

      if (data.verificationUriComplete) {
        window.open(
          data.verificationUriComplete,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (error) {
      console.error("Start AWS SSO login error:", error);

      setState({
        kind: "error",

        message:
          error instanceof Error
            ? error.message
            : "Unable to start AWS SSO login.",

        retryType: "login",
      });
    } finally {
      setIsStartingLogin(false);
    }
  }, [fetchAwsAccounts]);

  /* ------------------------------------------------------------------------ */
  /* Poll AWS device authorization                                            */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (state.kind !== "waiting") {
      return;
    }

    const deviceAuthorization = deviceAuthorizationRef.current;

    if (!deviceAuthorization) {
      setState({
        kind: "error",

        message: "Device authorization state is missing. Please sign in again.",

        retryType: "login",
      });

      return;
    }

    let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const abortController = new AbortController();

    pollAbortControllerRef.current = abortController;

    async function pollLoginStatus(): Promise<void> {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch("/api/auth/poll", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          cache: "no-store",

          signal: abortController.signal,

          body: JSON.stringify({
            clientId: deviceAuthorization.clientId,

            clientSecret: deviceAuthorization.clientSecret,

            deviceCode: deviceAuthorization.deviceCode,

            region: deviceAuthorization.region,
          }),
        });

        const data = await parseJsonResponse<PollResponse>(
          response,
          "AWS polling API",
        );

        if (cancelled) {
          return;
        }

        if (data.status === "pending") {
          timer = setTimeout(pollLoginStatus, 2000);

          return;
        }

        if (data.status === "slow_down") {
          timer = setTimeout(pollLoginStatus, 5000);

          return;
        }

        if (data.status === "expired" || data.status === "error") {
          await clearAwsSsoToken();

          setState({
            kind: "error",

            message:
              data.error || data.message || "AWS SSO login failed or expired.",

            retryType: "login",
          });

          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error ||
              data.message ||
              "Unable to check AWS SSO login status.",
          );
        }

        if (data.status === "authenticated") {
          if (!data.accessToken) {
            throw new Error(
              "Login succeeded, but the AWS SSO access token was not received.",
            );
          }

          if (
            !data.expiresIn ||
            !Number.isFinite(data.expiresIn) ||
            data.expiresIn <= 0
          ) {
            throw new Error("AWS SSO token expiration was not returned.");
          }

          const region =
            data.region || deviceAuthorization.region || "us-east-1";

          accessTokenRef.current = data.accessToken;

          regionRef.current = region;

          await saveAwsSsoToken({
            accessToken: data.accessToken,
            region,
            expiresInSeconds: data.expiresIn,
            refreshToken: data.refreshToken,
            clientId: deviceAuthorization.clientId,
            clientSecret: deviceAuthorization.clientSecret,
          });

          await fetchAwsAccounts(data.accessToken, region);

          return;
        }

        timer = setTimeout(pollLoginStatus, 2000);
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }

        console.error("AWS SSO polling error:", error);

        setState({
          kind: "error",

          message:
            error instanceof Error
              ? error.message
              : "Unable to complete AWS SSO login.",

          retryType: "login",
        });
      }
    }

    timer = setTimeout(pollLoginStatus, 2000);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      abortController.abort();

      if (pollAbortControllerRef.current === abortController) {
        pollAbortControllerRef.current = null;
      }
    };
  }, [state.kind, fetchAwsAccounts]);

  /* ------------------------------------------------------------------------ */
  /* Account selection                                                        */
  /* ------------------------------------------------------------------------ */

  async function handleAccountSelect(account: AwsAccount): Promise<void> {
    try {
      let accessToken = accessTokenRef.current;

      let region = regionRef.current;

      if (!accessToken) {
        const cachedSsoToken = await getValidAwsSsoToken();

        if (!cachedSsoToken) {
          await clearAwsSsoToken();

          accessTokenRef.current = "";

          setState({
            kind: "idle",
          });

          return;
        }

        accessToken = cachedSsoToken.accessToken;

        region = cachedSsoToken.region;

        accessTokenRef.current = accessToken;

        regionRef.current = region;
      }

      await fetchAwsRoles(account, accessToken, region);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch AWS roles.";

      console.error("Fetch AWS roles error:", message);

      if (isTokenError(0, message)) {
        await clearAwsSsoToken();

        accessTokenRef.current = "";

        setState({
          kind: "idle",
        });

        return;
      }

      setState({
        kind: "error",
        message,
        retryType: "roles",
        account,
      });
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Role selection and credential creation                                   */
  /* ------------------------------------------------------------------------ */

  async function completeRoleLogin(
    account: AwsAccount,
    role: AwsRole,
    projectId: string,
    credentials: {
      accountId: string;
      accountName?: string;
      roleName: string;
      expiration: string;
    },
  ): Promise<void> {
    const activeProjectId = projectId.trim();
    if (!activeProjectId) {
      throw new Error("A mapped project must be selected.");
    }

    await setActiveProjectIdSetting(activeProjectId);

    await ensureServerSession(
      credentials.accountId,
      credentials.accountName,
      credentials.roleName,
      credentials.expiration,
    );

    // Align server cookie with IndexedDB active project.
    await fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/activate`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    }).catch(() => undefined);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(PROJECTS_CHANGED_EVENT));
    }

    accessTokenRef.current = "";
    deviceAuthorizationRef.current = null;
    selectedAccountRef.current = null;
    selectedRoleRef.current = null;
    redirectStartedRef.current = true;

    const returnTo =
      typeof window !== "undefined"
        ? sanitizeReturnTo(new URLSearchParams(window.location.search).get("returnTo"))
        : null;

    router.replace(returnTo || "/");
    router.refresh();
  }

  async function loadMappedProjects(
    account: AwsAccount,
    role: AwsRole,
  ): Promise<void> {
    selectedAccountRef.current = account;
    selectedRoleRef.current = role;

    setState({
      kind: "loading-projects",
      account,
      role,
    });

    const response = await fetch("/api/mappings/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        accountId: account.accountId,
        roleName: role.roleName,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      projects?: MappedProjectOption[];
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok || data.success === false) {
      throw new Error(
        data?.error?.message ||
          data?.message ||
          "Unable to load mapped projects for this account and role.",
      );
    }

    const projects = data.projects || [];
    if (projects.length === 0) {
      throw new Error(
        "No projects are mapped for this AWS account and role in twilio-mappings.json.",
      );
    }

    setState({
      kind: "select-project",
      account,
      role,
      projects,
    });
  }

  /** Role click → show mapped projects (do not authorize yet). */
  async function handleRoleSelect(
    account: AwsAccount,
    role: AwsRole,
  ): Promise<void> {
    try {
      await loadMappedProjects(account, role);
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load mapped projects.",
        retryType: "projects",
        account,
        role,
      });
    }
  }

  /** Use Credentials → AWS role creds + active project in IndexedDB + enter app. */
  async function handleUseCredentials(
    account: AwsAccount,
    role: AwsRole,
    projectId: string,
  ): Promise<void> {
    const activeProjectId = projectId.trim();
    if (!activeProjectId) {
      setState({
        kind: "error",
        message: "Select a mapped project before continuing.",
        retryType: "projects",
        account,
        role,
      });
      return;
    }

    try {
      selectedAccountRef.current = account;
      selectedRoleRef.current = role;

      setState({
        kind: "creating-credentials",
        account,
        role,
        projectId: activeProjectId,
      });

      const existing = await getCredentials(account.accountId, role.roleName);

      if (
        existing &&
        !areAwsCredentialsExpired(existing.aws) &&
        existing.aws.accessKeyId &&
        existing.aws.secretAccessKey &&
        existing.aws.sessionToken
      ) {
        await setSelectedCredentials(existing.id);

        await completeRoleLogin(account, role, activeProjectId, {
          accountId: existing.accountId,
          accountName: existing.accountName || account.accountName,
          roleName: existing.roleName,
          expiration: existing.aws.expiration,
        });

        return;
      }

      let accessToken = accessTokenRef.current;
      let region = regionRef.current;

      if (!accessToken) {
        const cachedSsoToken = await getValidAwsSsoToken();

        if (!cachedSsoToken) {
          throw new Error(
            "AWS SSO session is unavailable. Please sign in again.",
          );
        }

        accessToken = cachedSsoToken.accessToken;
        region = cachedSsoToken.region;
        accessTokenRef.current = accessToken;
        regionRef.current = region;
      }

      const response = await fetch("/api/aws/role-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          accessToken,
          accountId: account.accountId,
          roleName: role.roleName,
          region,
        }),
      });

      const result = await parseJsonResponse<RoleCredentialsApiResponse>(
        response,
        "Role credentials API",
      );

      if (!response.ok || !result.success) {
        const missingFields = result.missingFields?.length
          ? ` Missing fields: ${result.missingFields.join(", ")}.`
          : "";

        const message = `${getApiMessage(
          result,
          "Unable to generate account credentials.",
        )}${missingFields}`;

        if (isTokenError(response.status, message)) {
          await clearAwsSsoToken();
          accessTokenRef.current = "";
        }

        throw new Error(message);
      }

      const awsCredentials = result.aws;

      if (!awsCredentials) {
        throw new Error("Temporary AWS credentials were not returned.");
      }

      const missingAwsFields: string[] = [];

      if (!awsCredentials.accessKeyId?.trim()) {
        missingAwsFields.push("accessKeyId");
      }

      if (!awsCredentials.secretAccessKey?.trim()) {
        missingAwsFields.push("secretAccessKey");
      }

      if (!awsCredentials.sessionToken?.trim()) {
        missingAwsFields.push("sessionToken");
      }

      if (!awsCredentials.expiration?.trim()) {
        missingAwsFields.push("expiration");
      }

      if (missingAwsFields.length > 0) {
        throw new Error(
          `AWS credentials are incomplete. Missing fields: ${missingAwsFields.join(", ")}.`,
        );
      }

      const expirationTime = new Date(awsCredentials.expiration).getTime();

      if (Number.isNaN(expirationTime) || expirationTime <= Date.now()) {
        throw new Error("AWS credential expiration is invalid or expired.");
      }

      const savedCredentials = await saveAwsCredentials({
        accountId: account.accountId,
        accountName: account.accountName,
        roleName: role.roleName,
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
        sessionToken: awsCredentials.sessionToken,
        expiration: awsCredentials.expiration,
      });

      // Twilio stays server-side in twilio-mappings (never cached in IndexedDB).

      const selectedCredentials = await getSelectedCredentials();

      if (
        !selectedCredentials ||
        selectedCredentials.id !== savedCredentials.id
      ) {
        throw new Error(
          "Credentials were saved, but the selected account could not be verified.",
        );
      }

      await completeRoleLogin(account, role, activeProjectId, {
        accountId: savedCredentials.accountId,
        accountName: savedCredentials.accountName,
        roleName: savedCredentials.roleName,
        expiration: savedCredentials.aws.expiration,
      });
    } catch (error) {
      console.error(
        "Create account credentials error:",
        error instanceof Error ? error.message : "unknown error",
      );

      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to authorize the selected AWS role.",
        retryType: "credentials",
        account,
        role,
        projectId: activeProjectId,
      });
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Back to account selection                                                */
  /* ------------------------------------------------------------------------ */

  async function handleBackToAccounts(): Promise<void> {
    try {
      let accessToken = accessTokenRef.current;

      let region = regionRef.current;

      if (!accessToken) {
        const cachedToken = await getValidAwsSsoToken();

        if (!cachedToken) {
          setState({
            kind: "idle",
          });

          return;
        }

        accessToken = cachedToken.accessToken;

        region = cachedToken.region;

        accessTokenRef.current = accessToken;

        regionRef.current = region;
      }

      await fetchAwsAccounts(accessToken, region);
    } catch (error) {
      setState({
        kind: "error",

        message:
          error instanceof Error
            ? error.message
            : "Unable to load AWS accounts.",

        retryType: "accounts",
      });
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Retry                                                                    */
  /* ------------------------------------------------------------------------ */

  async function handleRetry(): Promise<void> {
    if (state.kind !== "error") {
      return;
    }

    try {
      switch (state.retryType) {
        case "accounts": {
          const cachedToken = await getValidAwsSsoToken();

          if (!cachedToken) {
            await startLogin();
            return;
          }

          await fetchAwsAccounts(cachedToken.accessToken, cachedToken.region);

          return;
        }

        case "roles": {
          if (state.account) {
            await handleAccountSelect(state.account);

            return;
          }

          await startLogin();
          return;
        }

        case "credentials": {
          if (state.account && state.role && state.projectId) {
            await handleUseCredentials(state.account, state.role, state.projectId);

            return;
          }

          if (state.account && state.role) {
            await handleRoleSelect(state.account, state.role);
            return;
          }

          await startLogin();
          return;
        }

        case "projects": {
          if (state.account && state.role) {
            await handleRoleSelect(state.account, state.role);
            return;
          }

          await startLogin();
          return;
        }

        case "login":
        default:
          await startLogin();
      }
    } catch (error) {
      setState({
        kind: "error",

        message:
          error instanceof Error
            ? error.message
            : "Unable to retry authentication.",

        retryType: "login",
      });
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Logout                                                                   */
  /* ------------------------------------------------------------------------ */

  async function logout(): Promise<void> {
    try {
      setIsLoggingOut(true);

      pollAbortControllerRef.current?.abort();

      await Promise.allSettled([
        fetch("/api/auth/logout", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          cache: "no-store",
        }),

        clearAllCredentials(),
      ]);
    } catch (error) {
      console.error("AWS logout error:", error);
    } finally {
      accessTokenRef.current = "";

      regionRef.current = "us-east-1";

      deviceAuthorizationRef.current = null;

      selectedAccountRef.current = null;

      selectedRoleRef.current = null;

      redirectStartedRef.current = false;

      setState({
        kind: "idle",
      });

      setIsLoggingOut(false);

      router.refresh();
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Checking cached session                                                  */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "checking-session") {
    return (
      <LoadingSection
        title="Restoring your session"
        description="Checking cached AWS SSO access and temporary credentials."
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Account selection                                                        */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "select-account") {
    return (
      <section className="animate-slide-up space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SuccessBadge>AWS SSO session active</SuccessBadge>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Choose an AWS account
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {state.accounts.length} accessible AWS{" "}
              {state.accounts.length === 1 ? "account was" : "accounts were"}{" "}
              found.
            </p>
          </div>

          <LogoutButton loading={isLoggingOut} onClick={() => void logout()} />
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {state.accounts.map((account) => (
            <button
              key={account.accountId}
              type="button"
              onClick={() => void handleAccountSelect(account)}
              className="group w-full rounded-2xl border border-border/60 bg-background/40 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Building2 className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">
                    {account.accountName || account.accountId}
                  </h3>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {account.accountId}
                  </p>

                  {account.emailAddress && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {account.emailAddress}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Select an account to load its assigned IAM Identity Center roles.
        </p>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Role selection                                                           */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "select-role") {
    return (
      <section className="animate-slide-up space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => void handleBackToAccounts()}
              className={iconButtonClass}
              aria-label="Back to accounts"
              title="Back to accounts"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <SuccessBadge>Account selected</SuccessBadge>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                Choose an AWS role
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {state.account.accountName || state.account.accountId}
              </p>

              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {state.account.accountId}
              </p>
            </div>
          </div>

          <LogoutButton loading={isLoggingOut} onClick={() => void logout()} />
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {state.roles.map((role) => (
            <button
              key={`${role.accountId}:${role.roleName}`}
              type="button"
              onClick={() => void handleRoleSelect(state.account, role)}
              className="group w-full rounded-2xl border border-border/60 bg-background/40 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 transition-colors group-hover:bg-violet-500/15">
                  <KeyRound className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">
                    {role.roleName}
                  </h3>

                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {role.accountId}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Next: choose a project mapped for this account and role in
          twilio-mappings.
        </p>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Project selection                                                        */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "select-project") {
    return (
      <ProjectPickerSection
        account={state.account}
        role={state.role}
        projects={state.projects}
        isLoggingOut={isLoggingOut}
        onLogout={() => void logout()}
        onBack={() => {
          void (async () => {
            try {
              let accessToken = accessTokenRef.current;
              let region = regionRef.current;
              if (!accessToken) {
                const cached = await getValidAwsSsoToken();
                if (!cached) {
                  await handleBackToAccounts();
                  return;
                }
                accessToken = cached.accessToken;
                region = cached.region;
                accessTokenRef.current = accessToken;
                regionRef.current = region;
              }
              await fetchAwsRoles(state.account, accessToken, region);
            } catch {
              await handleAccountSelect(state.account);
            }
          })();
        }}
        onUseCredentials={(projectId) =>
          void handleUseCredentials(state.account, state.role, projectId)
        }
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Loading states                                                           */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "loading-accounts") {
    return (
      <LoadingSection
        title="Fetching your AWS accounts"
        description="Loading all accounts assigned through AWS IAM Identity Center."
      />
    );
  }

  if (state.kind === "loading-roles") {
    return (
      <LoadingSection
        title="Fetching assigned roles"
        description={`Loading roles assigned for ${
          state.account.accountName || state.account.accountId
        }.`}
      />
    );
  }

  if (state.kind === "loading-projects") {
    return (
      <LoadingSection
        title="Loading mapped projects"
        description={`Reading projects for ${state.role.roleName} from twilio-mappings.`}
      />
    );
  }

  if (state.kind === "creating-credentials") {
    return (
      <LoadingSection
        title="Authorizing selected role"
        description={`Generating temporary credentials for ${state.role.roleName} and activating project ${state.projectId}.`}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Device verification                                                      */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "waiting") {
    return (
      <section className="animate-slide-up space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <ShieldCheck className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Approve this login in AWS
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A browser tab opened to AWS IAM Identity Center. Approve access,
            then return here — you will not need to approve again until the SSO
            session expires.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Verification code
          </p>

          <p className="mt-3 font-mono text-3xl font-semibold tracking-[0.2em] text-primary">
            {state.userCode}
          </p>
        </div>

        {state.verificationUriComplete && (
          <a
            href={state.verificationUriComplete}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Open verification page
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        {!state.verificationUriComplete && state.verificationUri && (
          <a
            href={state.verificationUri}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Open AWS SSO
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Waiting for approval
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "error") {
    return (
      <section className="animate-slide-up space-y-5 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <TriangleAlert className="h-8 w-8" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Unable to continue
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-destructive">
            {state.message}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void logout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Cancel
          </button>

          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void handleRetry()}
            disabled={isStartingLogin}
          >
            {isStartingLogin ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Try again
          </button>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Initial login screen                                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <ShieldCheck className="h-8 w-8" />
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Sign in to continue
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Authenticate with AWS IAM Identity Center to view all accounts and
          roles assigned to you.
        </p>

        {initialSession?.accountId && (
          <p className="mt-3 text-xs text-muted-foreground">
            Previous account:{" "}
            <span className="font-mono text-foreground">
              {initialSession.accountId}
            </span>
          </p>
        )}
      </div>

      <button
        type="button"
        className={cn(primaryButtonClass, "w-full")}
        onClick={() => void startLogin()}
        disabled={isStartingLogin}
      >
        {isStartingLogin ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting login
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Sign in with AWS SSO
          </>
        )}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper Components                                                          */
/* -------------------------------------------------------------------------- */

function ProjectPickerSection({
  account,
  role,
  projects,
  isLoggingOut,
  onLogout,
  onBack,
  onUseCredentials,
}: {
  account: AwsAccount;
  role: AwsRole;
  projects: MappedProjectOption[];
  isLoggingOut: boolean;
  onLogout: () => void;
  onBack: () => void;
  onUseCredentials: (projectId: string) => void;
}) {
  // No JSON defaultProject — user must explicitly choose before Use Credentials.
  const [projectId, setProjectId] = useState("");

  return (
    <section className="animate-slide-up space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className={iconButtonClass}
            aria-label="Back to roles"
            title="Back to roles"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div>
            <SuccessBadge>Role selected</SuccessBadge>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Choose a project
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {account.accountName || account.accountId}
            </p>

            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {role.roleName}
            </p>
          </div>
        </div>

        <LogoutButton loading={isLoggingOut} onClick={onLogout} />
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Project
        </span>
        <select
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="" disabled>
            Select a project…
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
              {project.hasTwilio ? "" : " (no Twilio)"}
            </option>
          ))}
        </select>
      </label>

      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
        {projects.map((project) => {
          const active = project.id === projectId;
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => setProjectId(project.id)}
              className={cn(
                "group w-full rounded-2xl border border-border/60 bg-background/40 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5",
                active && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <FolderKanban className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-foreground">
                    {project.name}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {project.id}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={cn(primaryButtonClass, "w-full")}
        disabled={!projectId}
        onClick={() => onUseCredentials(projectId)}
      >
        Use Credentials
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Temporary AWS credentials will be generated and this project will be
        saved as active in IndexedDB.
      </p>
    </section>
  );
}

function SuccessBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function LoadingSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="animate-slide-up py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>

      <h2 className="mt-5 text-xl font-semibold text-foreground">{title}</h2>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}

function LogoutButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={iconButtonClass}
      aria-label="Sign out"
      title="Sign out"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
    </button>
  );
}

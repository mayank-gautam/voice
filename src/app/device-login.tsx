"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { Building2, FolderKanban, KeyRound, Loader2 } from "lucide-react";

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
  /** Notifies the SSO page so it can switch sign-in vs account-selection chrome. */
  onPhaseChange?: (phase: SsoUiPhase) => void;
};

export type SsoUiPhase =
  | "checking"
  | "sign-in"
  | "waiting"
  | "select-scope"
  | "loading"
  | "error";

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
      kind: "select-scope";
      accounts: AwsAccount[];
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
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--glow-primary)] transition-all duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const selectClass =
  "w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition-colors duration-200 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

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

export function DeviceLogin({
  initialSession,
  onPhaseChange,
}: DeviceLoginProps) {
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

  useEffect(() => {
    if (!onPhaseChange) return;
    switch (state.kind) {
      case "checking-session":
        onPhaseChange("checking");
        break;
      case "idle":
        onPhaseChange("sign-in");
        break;
      case "waiting":
        onPhaseChange("waiting");
        break;
      case "select-scope":
        onPhaseChange("select-scope");
        break;
      case "loading-accounts":
      case "creating-credentials":
        onPhaseChange("loading");
        break;
      case "error":
        onPhaseChange("error");
        break;
      default:
        onPhaseChange("sign-in");
    }
  }, [state.kind, onPhaseChange]);

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

      // Show every account returned by AWS SSO for this user (no hardcoded list).
      const sortedAccounts = [...accounts].sort((first, second) => {
        const firstName = first.accountName || first.accountId;

        const secondName = second.accountName || second.accountId;

        return firstName.localeCompare(secondName);
      });

      accessTokenRef.current = normalizedAccessToken;

      regionRef.current = normalizedRegion;

      setState({
        kind: "select-scope",
        accounts: sortedAccounts,
      });

      return sortedAccounts;
    },
    [],
  );

  /* ------------------------------------------------------------------------ */
  /* Fetch AWS roles (returns list; does not change screen)                   */
  /* ------------------------------------------------------------------------ */

  const loadRolesForAccount = useCallback(
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

      // Show every role AWS SSO returns for the selected account.
      return [...roles].sort((first, second) =>
        first.roleName.localeCompare(second.roleName),
      );
    },
    [],
  );

  const loadProjectsForRole = useCallback(
    async (
      account: AwsAccount,
      role: AwsRole,
    ): Promise<MappedProjectOption[]> => {
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

      return data.projects || [];
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
  /* Resolve SSO token for role/project loading                               */
  /* ------------------------------------------------------------------------ */

  const resolveAccessToken = useCallback(async (): Promise<{
    accessToken: string;
    region: string;
  } | null> => {
    let accessToken = accessTokenRef.current;
    let region = regionRef.current;

    if (!accessToken) {
      const cachedSsoToken = await getValidAwsSsoToken();
      if (!cachedSsoToken) {
        await clearAwsSsoToken();
        accessTokenRef.current = "";
        return null;
      }
      accessToken = cachedSsoToken.accessToken;
      region = cachedSsoToken.region;
      accessTokenRef.current = accessToken;
      regionRef.current = region;
    }

    return { accessToken, region };
  }, []);

  const handleTokenExpired = useCallback(() => {
    void clearAwsSsoToken();
    accessTokenRef.current = "";
    setState({ kind: "idle" });
  }, []);

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

  /** Use This Account → role creds + open mapped project from twilio-mappings. */
  async function handleUseThisAccount(
    account: AwsAccount,
    role: AwsRole,
    projectId: string,
  ): Promise<void> {
    const activeProjectId = projectId.trim();
    if (!activeProjectId) {
      setState({
        kind: "error",
        message:
          "Select a project mapped for this account and role in twilio-mappings.json.",
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
  /* Retry                                                                    */
  /* ------------------------------------------------------------------------ */

  async function handleRetry(): Promise<void> {
    if (state.kind !== "error") {
      return;
    }

    try {
      switch (state.retryType) {
        case "accounts":
        case "roles":
        case "projects": {
          const cachedToken = await getValidAwsSsoToken();
          if (!cachedToken) {
            await startLogin();
            return;
          }
          await fetchAwsAccounts(cachedToken.accessToken, cachedToken.region);
          return;
        }

        case "credentials": {
          if (state.account && state.role && state.projectId) {
            await handleUseThisAccount(
              state.account,
              state.role,
              state.projectId,
            );
            return;
          }

          const cachedToken = await getValidAwsSsoToken();
          if (!cachedToken) {
            await startLogin();
            return;
          }
          await fetchAwsAccounts(cachedToken.accessToken, cachedToken.region);
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
      <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground animate-pulse-glow">
          Restoring your session…
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Account & Role selection (single screen)                                 */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "select-scope") {
    return (
      <AccountScopePicker
        accounts={state.accounts}
        isLoggingOut={isLoggingOut}
        onLogout={() => void logout()}
        resolveAccessToken={resolveAccessToken}
        loadRoles={loadRolesForAccount}
        loadProjects={loadProjectsForRole}
        onUseThisAccount={(account, role, projectId) =>
          void handleUseThisAccount(account, role, projectId)
        }
        onTokenExpired={handleTokenExpired}
      />
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Loading states                                                           */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "loading-accounts") {
    return (
      <section className="glass-card animate-slide-up flex min-h-[16rem] flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Loading accounts…
          </p>
          <p className="text-sm text-muted-foreground">
            Fetching the AWS accounts available to this SSO session.
          </p>
        </div>
      </section>
    );
  }

  if (state.kind === "creating-credentials") {
    return (
      <section className="glass-card animate-slide-up flex min-h-[16rem] flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2
          className="h-7 w-7 animate-spin text-primary"
          aria-hidden
        />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Preparing access…
          </p>
          <p className="text-sm text-muted-foreground">
            Securing role credentials for the account you selected.
          </p>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Device verification                                                      */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "waiting") {
    return (
      <section className="glass-card animate-slide-up space-y-6 p-6 text-center sm:p-8">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Approve this login
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Enter this code on the AWS SSO page (opened in a new tab):
          </p>
        </div>
        <p className="mono rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-3xl font-semibold tracking-[0.2em] text-primary">
          {state.userCode}
        </p>
        {state.verificationUriComplete && (
          <a
            className={cn(primaryButtonClass, "inline-flex w-full sm:w-auto")}
            href={state.verificationUriComplete}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open verification page
          </a>
        )}
        {!state.verificationUriComplete && state.verificationUri && (
          <a
            className={cn(primaryButtonClass, "inline-flex w-full sm:w-auto")}
            href={state.verificationUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open AWS SSO
          </a>
        )}
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          Waiting for approval…
        </p>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (state.kind === "error") {
    return (
      <section className="glass-card animate-slide-up flex w-full max-w-md flex-col items-center gap-5 p-6 text-center sm:p-8">
        <p
          role="alert"
          className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {/token|secret|credential|accessKey|authToken/i.test(state.message)
            ? "Something went wrong during sign-in. Please try again."
            : state.message}
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void logout()}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void handleRetry()}
            disabled={isStartingLogin}
          >
            {isStartingLogin ? "Starting…" : "Try again"}
          </button>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Initial login screen                                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <section className="glass-card animate-slide-up flex w-full max-w-md flex-col items-center gap-5 p-6 text-center sm:p-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Sign in with AWS
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Authenticate with AWS IAM Identity Center to choose an account and
          role.
        </p>
      </div>
      {initialSession?.accountId && (
        <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Last session account{" "}
          <span className="font-mono text-foreground">
            {initialSession.accountId}
          </span>
        </p>
      )}
      <button
        type="button"
        className={cn(primaryButtonClass, "w-full")}
        onClick={() => void startLogin()}
        disabled={isStartingLogin}
      >
        {isStartingLogin ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Starting…
          </>
        ) : (
          "Sign in with AWS SSO"
        )}
      </button>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Account & Role Selection UI                                                */
/* -------------------------------------------------------------------------- */

function SignOutButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
      disabled={loading}
      onClick={onClick}
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}

function AccountScopePicker({
  accounts,
  isLoggingOut,
  onLogout,
  resolveAccessToken,
  loadRoles,
  loadProjects,
  onUseThisAccount,
  onTokenExpired,
}: {
  accounts: AwsAccount[];
  isLoggingOut: boolean;
  onLogout: () => void;
  resolveAccessToken: () => Promise<{ accessToken: string; region: string } | null>;
  loadRoles: (
    account: AwsAccount,
    accessToken: string,
    region: string,
  ) => Promise<AwsRole[]>;
  loadProjects: (
    account: AwsAccount,
    role: AwsRole,
  ) => Promise<MappedProjectOption[]>;
  onUseThisAccount: (
    account: AwsAccount,
    role: AwsRole,
    projectId: string,
  ) => void;
  onTokenExpired: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.accountId || "");
  const [roleName, setRoleName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [roles, setRoles] = useState<AwsRole[]>([]);
  const [projects, setProjects] = useState<MappedProjectOption[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedAccount = accounts.find((account) => account.accountId === accountId);
  const selectedRole = roles.find((role) => role.roleName === roleName);

  useEffect(() => {
    if (!accounts.some((account) => account.accountId === accountId)) {
      setAccountId(accounts[0]?.accountId || "");
    }
  }, [accounts, accountId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const account = accounts.find((item) => item.accountId === accountId);
      if (!account) {
        setRoles([]);
        setRoleName("");
        setProjects([]);
        setProjectId("");
        return;
      }

      setLoadingRoles(true);
      setError(null);
      setRoles([]);
      setRoleName("");
      setProjects([]);
      setProjectId("");

      try {
        const token = await resolveAccessToken();
        if (!token) {
          onTokenExpired();
          return;
        }

        const nextRoles = await loadRoles(
          account,
          token.accessToken,
          token.region,
        );
        if (cancelled) return;

        setRoles(nextRoles);
        setRoleName(nextRoles[0]?.roleName || "");
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load roles.";
        if (isTokenError(0, message)) {
          onTokenExpired();
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId, accounts, loadRoles, resolveAccessToken, onTokenExpired]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const account = accounts.find((item) => item.accountId === accountId);
      const role = roles.find((item) => item.roleName === roleName);
      if (!account || !role) {
        setProjects([]);
        setProjectId("");
        return;
      }

      setLoadingProjects(true);
      setError(null);
      setProjects([]);
      setProjectId("");

      try {
        // mappings["accountId:roleName"].projects — first listed project is preselected.
        // Do not use JSON defaultProject.
        const loaded = await loadProjects(account, role);
        if (cancelled) return;

        setProjects(loaded);
        setProjectId(loaded[0]?.id || "");

        if (loaded.length === 0) {
          setError(
            `No projects found in twilio-mappings for ${account.accountId}:${role.roleName}.`,
          );
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load projects from twilio-mappings.",
        );
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId, roleName, accounts, roles, loadProjects]);

  const continueToApp = () => {
    if (!selectedAccount || !selectedRole || !projectId.trim() || pending) {
      return;
    }
    setPending(true);
    setError(null);
    onUseThisAccount(selectedAccount, selectedRole, projectId.trim());
  };

  const busy = loadingRoles || loadingProjects || pending;
  const canContinue = Boolean(
    selectedAccount && selectedRole && projectId.trim() && !busy,
  );
  const selectedProject = projects.find((project) => project.id === projectId);
  const noAccounts = accounts.length === 0;

  const safeError = (() => {
    if (!error) return null;
    if (/token|secret|credential|authToken|accessKey/i.test(error)) {
      return "Unable to load account options. Try again or sign out and restart SSO.";
    }
    if (/No projects found in twilio-mappings/i.test(error)) {
      return "No projects are mapped for this account and role. Choose a different role or contact your administrator.";
    }
    return error;
  })();

  return (
    <section className="glass-card animate-slide-up flex h-full flex-col space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Choose AWS account & role
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Select where to work, then continue into the app. Your SSO session
            stays in this browser.
          </p>
        </div>
        <SignOutButton loading={isLoggingOut} onClick={onLogout} />
      </div>

      {noAccounts ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/70" aria-hidden />
          <p className="text-sm font-medium text-foreground">No accounts available</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            No AWS accounts were returned for this SSO session. Sign out and try
            again, or contact your administrator.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div
            className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
            aria-live="polite"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Current selection
            </p>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Account</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {selectedAccount
                    ? selectedAccount.accountName || selectedAccount.accountId
                    : "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {loadingRoles ? "Loading…" : selectedRole?.roleName || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Project</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {loadingProjects
                    ? "Loading…"
                    : selectedProject?.name || projectId || "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                Account
              </span>
              <select
                className={selectClass}
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                disabled={busy || accounts.length === 0}
                aria-busy={busy}
              >
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {(account.accountName || "Account") +
                      ` (${account.accountId})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" aria-hidden />
                Role
                {loadingRoles && (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin text-primary"
                    aria-label="Loading roles"
                  />
                )}
              </span>
              <select
                className={selectClass}
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                disabled={busy || loadingRoles || roles.length === 0}
                aria-busy={loadingRoles}
              >
                {loadingRoles ? (
                  <option value="">Loading roles…</option>
                ) : roles.length === 0 ? (
                  <option value="">No roles in this account</option>
                ) : (
                  roles.map((role) => (
                    <option
                      key={`${role.accountId}:${role.roleName}`}
                      value={role.roleName}
                    >
                      {role.roleName}
                    </option>
                  ))
                )}
              </select>
              {!loadingRoles && roles.length === 0 && accountId ? (
                <p className="text-xs text-muted-foreground">
                  No roles are available for this account.
                </p>
              ) : null}
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <FolderKanban className="h-3.5 w-3.5" aria-hidden />
                Project
                {loadingProjects && (
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin text-primary"
                    aria-label="Loading projects"
                  />
                )}
              </span>
              <select
                className={selectClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={busy || loadingProjects || projects.length === 0}
                aria-busy={loadingProjects}
              >
                {loadingProjects ? (
                  <option value="">Loading projects…</option>
                ) : projects.length === 0 ? (
                  <option value="">No mapped projects</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                      {project.hasTwilio ? "" : " (no Twilio)"}
                    </option>
                  ))
                )}
              </select>
              {!loadingProjects &&
              projects.length === 0 &&
              selectedRole ? (
                <p className="text-xs text-muted-foreground">
                  No projects are mapped for this account and role.
                </p>
              ) : null}
            </label>
          </div>

          {safeError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {safeError}
            </p>
          )}

          <button
            type="button"
            className={cn(primaryButtonClass, "w-full")}
            disabled={!canContinue}
            onClick={continueToApp}
            aria-disabled={!canContinue}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              "Use This Account"
            )}
          </button>
        </div>
      )}
    </section>
  );
}

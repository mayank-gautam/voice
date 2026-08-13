"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  areAwsCredentialsExpired,
  clearAllCredentials,
  clearAwsSsoToken,
  clearStoredAccountCredentials,
  getAllCredentials,
  getAwsSsoTokenSnapshot,
  getCredentials,
  getSelectedCredentials,
  getValidAwsSsoToken,
  refreshStoredAwsSsoToken,
  saveAwsSsoToken,
  saveAwsCredentials,
  setSelectedCredentials,
  setActiveProjectIdSetting,
  type AwsSsoToken,
  type StoredCredentials,
} from "@/lib/credentials-store";

import { PROJECTS_CHANGED_EVENT } from "@/lib/projectConfig";

import { sanitizeReturnTo } from "@/lib/auth-return-to";

import { cn } from "@/lib/utils";
import { toUserFacingMessage } from "@/lib/userFacingError";
import { formatExpiry } from "@/lib/expiry";

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
  /** Exposes sign-out for the SSO page header (ZIP Home layout). */
  onLogoutReady?: (logout: () => void, isLoggingOut: boolean) => void;
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
  "inline-flex items-center justify-center rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

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

/**
 * User-facing auth errors use shared `toUserFacingMessage` at display sites only.
 */

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function DeviceLogin({
  initialSession,
  onPhaseChange,
  onLogoutReady,
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

  useEffect(() => {
    onLogoutReady?.(() => {
      void logout();
    }, isLoggingOut);
  }, [onLogoutReady, isLoggingOut]);

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
        error?: { message?: string; code?: string };
        message?: string;
      };

      if (!response.ok || data.success === false) {
        if (
          response.status === 404 ||
          data?.error?.code === "NO_MAPPING"
        ) {
          throw new Error("Telephone credentials not configured");
        }
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
  ): Promise<void> {
    let activeProjectId = "";

    try {
      selectedAccountRef.current = account;
      selectedRoleRef.current = role;

      setState({
        kind: "creating-credentials",
        account,
        role,
        projectId: "",
      });

      const projects = await loadProjectsForRole(account, role);
      const mapped =
        projects.find((project) => project.hasTwilio) || projects[0] || null;

      if (!mapped || !mapped.hasTwilio) {
        setState({
          kind: "error",
          message: "Telephone credentials not configured",
          retryType: "projects",
          account,
          role,
        });
        return;
      }

      activeProjectId = mapped.id;

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

      const rawMessage =
        error instanceof Error
          ? error.message
          : "Unable to authorize the selected AWS role.";

      const noMapping =
        /no projects|no mapping|NO_MAPPING|telephone credentials/i.test(
          rawMessage,
        );

      setState({
        kind: "error",
        message: noMapping
          ? "Telephone credentials not configured"
          : rawMessage,
        retryType: "credentials",
        account,
        role,
        projectId: activeProjectId || undefined,
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
        case "roles": {
          const cachedToken = await getValidAwsSsoToken();
          if (!cachedToken) {
            await startLogin();
            return;
          }
          await fetchAwsAccounts(cachedToken.accessToken, cachedToken.region);
          return;
        }

        case "credentials":
        case "projects": {
          if (state.account && state.role) {
            await handleUseThisAccount(state.account, state.role);
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
        onUseThisAccount={(account, role) =>
          void handleUseThisAccount(account, role)
        }
        onTokenExpired={handleTokenExpired}
        onAccessTokenUpdated={(token) => {
          accessTokenRef.current = token.accessToken;
          regionRef.current = token.region;
        }}
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
            Looking up the accounts available to you.
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
            Setting up access for the account and role you selected.
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
      <section className="glass-card animate-slide-up space-y-5 p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Approve this login
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter this code in the AWS SSO page (opened in a new tab):
        </p>
        <p className="mono text-3xl font-semibold tracking-[0.2em] text-primary">
          {state.userCode}
        </p>
        {state.verificationUriComplete && (
          <a
            className={cn(primaryButtonClass, "inline-flex")}
            href={state.verificationUriComplete}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open verification page
          </a>
        )}
        {!state.verificationUriComplete && state.verificationUri && (
          <a
            className={cn(primaryButtonClass, "inline-flex")}
            href={state.verificationUri}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open AWS SSO
          </a>
        )}
        <p className="animate-pulse-glow text-sm text-muted-foreground">
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
          {toUserFacingMessage(state.message)}
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
    <div className="flex flex-col items-center gap-4">
      {initialSession?.accountId && (
        <p className="text-center text-xs text-muted-foreground">
          Previous account:{" "}
          <span className="font-mono text-foreground">
            {initialSession.accountId}
          </span>
        </p>
      )}
      <button
        type="button"
        className={cn(primaryButtonClass, "w-full sm:w-auto")}
        onClick={() => void startLogin()}
        disabled={isStartingLogin}
      >
        {isStartingLogin ? "Starting…" : "Sign in with AWS SSO"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Account & Role Selection UI                                                */
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
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
  onUseThisAccount,
  onTokenExpired,
  onAccessTokenUpdated,
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
  onUseThisAccount: (account: AwsAccount, role: AwsRole) => void;
  onTokenExpired: () => void;
  onAccessTokenUpdated: (token: AwsSsoToken) => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.accountId || "");
  const [roleName, setRoleName] = useState("");
  const [roles, setRoles] = useState<AwsRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cached, setCached] = useState<StoredCredentials[]>([]);
  const [selectedCachedId, setSelectedCachedId] = useState<string | null>(null);
  const [ssoToken, setSsoToken] = useState<AwsSsoToken | null>(null);
  const [activeCreds, setActiveCreds] = useState<StoredCredentials | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  void isLoggingOut;
  void onLogout;
  void tick;

  const selectedAccount = accounts.find((account) => account.accountId === accountId);
  const selectedRole = roles.find((role) => role.roleName === roleName);

  const reloadCredentialViews = useCallback(async () => {
    const [all, selected, token] = await Promise.all([
      getAllCredentials(),
      getSelectedCredentials(),
      getAwsSsoTokenSnapshot(),
    ]);
    setCached(all);
    setActiveCreds(selected);
    setSsoToken(token);
    if (selected) {
      setSelectedCachedId(selected.id);
    }
  }, []);

  useEffect(() => {
    void reloadCredentialViews();
  }, [reloadCredentialViews]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

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
        return;
      }

      setLoadingRoles(true);
      setError(null);
      setRoles([]);
      setRoleName("");

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
        setRoleName((prev) =>
          nextRoles.some((role) => role.roleName === prev)
            ? prev
            : nextRoles[0]?.roleName || "",
        );
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
    if (!selectedAccount || !selectedRole) return;
    const match = cached.find(
      (item) =>
        item.accountId === selectedAccount.accountId &&
        item.roleName === selectedRole.roleName,
    );
    if (match) {
      setSelectedCachedId(match.id);
      setActiveCreds(match);
    }
  }, [selectedAccount, selectedRole, cached]);

  const useAccount = (account: AwsAccount, role: AwsRole) => {
    if (pending) return;
    setPending(true);
    setError(null);
    setRefreshNote(null);
    onUseThisAccount(account, role);
  };

  const continueToApp = () => {
    if (!selectedAccount || !selectedRole) return;
    useAccount(selectedAccount, selectedRole);
  };

  const selectCached = (item: StoredCredentials) => {
    setSelectedCachedId(item.id);
    setActiveCreds(item);
    setAccountId(item.accountId);
    setRoleName(item.roleName);
    setError(null);
    setRefreshNote(null);
    useAccount(
      {
        accountId: item.accountId,
        accountName: item.accountName || item.accountId,
        emailAddress: null,
      },
      { accountId: item.accountId, roleName: item.roleName },
    );
  };

  const refreshTokens = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshNote(null);
    setError(null);

    try {
      const refreshed = await refreshStoredAwsSsoToken();
      if (!refreshed) {
        throw new Error(
          "Unable to refresh your sign-in session. Please sign in again.",
        );
      }

      onAccessTokenUpdated(refreshed);
      setSsoToken(refreshed);

      const account = selectedAccount;
      const role = selectedRole;
      if (account && role) {
        const response = await fetch("/api/aws/role-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            accessToken: refreshed.accessToken,
            accountId: account.accountId,
            roleName: role.roleName,
            region: refreshed.region,
          }),
        });

        const result = await parseJsonResponse<RoleCredentialsApiResponse>(
          response,
          "Role credentials API",
        );

        if (response.ok && result.success && result.aws) {
          const saved = await saveAwsCredentials({
            accountId: account.accountId,
            accountName: account.accountName,
            roleName: role.roleName,
            accessKeyId: result.aws.accessKeyId,
            secretAccessKey: result.aws.secretAccessKey,
            sessionToken: result.aws.sessionToken,
            expiration: result.aws.expiration,
          });
          setActiveCreds(saved);
          setSelectedCachedId(saved.id);
        }
      }

      await reloadCredentialViews();
      setRefreshNote(
        `Refreshed at ${new Date().toLocaleTimeString()} (IndexedDB updated)`,
      );
    } catch (err) {
      setError(
        toUserFacingMessage(
          err instanceof Error ? err.message : "Unable to refresh tokens.",
        ),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const busy = loadingRoles || pending || refreshing;
  const canContinue = Boolean(selectedAccount && selectedRole && !busy);
  const noAccounts = accounts.length === 0;
  const safeError = error ? toUserFacingMessage(error) : null;
  const live = Boolean(
    activeCreds && !areAwsCredentialsExpired(activeCreds.aws),
  );

  return (
    <div className="grid w-full items-start gap-6 lg:grid-cols-2 lg:gap-8">
      <div className="min-w-0 lg:sticky lg:top-8">
        <section className="glass-card animate-slide-up flex h-full flex-col space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Choose AWS account & role
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Session is stored in IndexedDB. Switch accounts without a new
              device code.
            </p>
          </div>

          {loadingRoles && roles.length === 0 && !noAccounts ? (
            <p className="text-sm text-muted-foreground animate-pulse-glow">
              Loading accounts…
            </p>
          ) : noAccounts ? (
            <p className="text-sm text-muted-foreground">No accounts found</p>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Account
                </span>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  disabled={busy || accounts.length === 0}
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
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Role
                </span>
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  disabled={busy || loadingRoles || roles.length === 0}
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
              </label>

              <button
                type="button"
                className={cn(primaryButtonClass, "w-full sm:w-auto")}
                disabled={!canContinue}
                onClick={continueToApp}
              >
                {pending ? "Fetching credentials…" : "Use this account"}
              </button>
            </div>
          )}

          {safeError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {safeError}
            </p>
          )}

          {cached.length > 0 && (
            <div className="border-t border-border/60 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cached role credentials (IndexedDB)
              </h3>
              <ul className="mt-3 space-y-2">
                {cached.map((item) => {
                  const active = item.id === selectedCachedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          secondaryButtonClass,
                          "w-full justify-between text-left",
                          active && "border-primary/50 bg-primary/5",
                        )}
                        disabled={pending || refreshing}
                        onClick={() => selectCached(item)}
                      >
                        <span className="truncate">
                          {item.accountName || item.accountId} / {item.roleName}
                        </span>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                          {formatExpiry(item.aws.expiration)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="min-w-0">
        {activeCreds ? (
          <section className="glass-card metric-glow animate-slide-up flex h-full flex-col space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  Session
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  Active AWS credentials
                </h2>
              </div>
              {live ? (
                <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  Live
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Idle
                </span>
              )}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Account
                </dt>
                <dd className="mt-1 font-medium">
                  {activeCreds.accountName
                    ? `${activeCreds.accountName} (${activeCreds.accountId})`
                    : activeCreds.accountId}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Role
                </dt>
                <dd
                  className="mt-1 truncate font-medium"
                  title={activeCreds.roleName}
                >
                  {activeCreds.roleName}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Refresh token
                </dt>
                <dd className="mt-1 text-sm">
                  {ssoToken?.refreshToken
                    ? "Present in IndexedDB"
                    : "Missing"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Access key
                </dt>
                <dd className="mt-1">
                  <code className="mono break-all text-sm text-primary">
                    {activeCreds.aws.accessKeyId}
                  </code>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  Role credentials expire
                </dt>
                <dd className="mt-1 font-medium">
                  {formatExpiry(activeCreds.aws.expiration)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                  SSO access token expires
                </dt>
                <dd className="mt-1 font-medium">
                  {formatExpiry(ssoToken?.expiresAt)}
                </dd>
              </div>
            </dl>

            {refreshNote && (
              <p className="text-sm text-muted-foreground">{refreshNote}</p>
            )}

            <div className="mt-auto flex flex-wrap gap-3 border-t border-border/60 pt-5">
              <button
                type="button"
                className={cn(secondaryButtonClass, "px-5 py-2.5")}
                disabled={!canContinue}
                onClick={continueToApp}
              >
                Use credentials
              </button>
              <button
                type="button"
                className={cn(primaryButtonClass)}
                disabled={refreshing || !ssoToken?.refreshToken}
                onClick={() => void refreshTokens()}
              >
                {refreshing ? "Refreshing…" : "Refresh now"}
              </button>
            </div>
          </section>
        ) : (
          <section className="glass-card animate-slide-up flex min-h-[280px] flex-col items-center justify-center gap-3 border-dashed p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No role selected yet
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Pick an account and role on the left, then credentials and expiry
              details will show here.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

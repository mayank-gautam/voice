"use client";

/**
 * Client credential helpers.
 * All IndexedDB persistence uses voice-ai-db (auth store) via sso-auth-idb.
 * The legacy voice-ai-dashboard database is migrated once and deleted.
 */

import {
  authRoleKey,
  clearIdbActiveProjectId,
  clearIdbAuth,
  clearIdbRoleCredentials,
  closeIdb,
  deleteLegacyCredentialsDatabase,
  getIdbActiveProjectId,
  getSelectedRole,
  listCachedRoles,
  loadIdbAuth,
  saveIdbAuth,
  saveIdbRoleCredentials,
  saveIdbSsoSession,
  setIdbActiveProjectId,
  setIdbSelectedRole,
  type IdbRoleCredentials,
} from "@/lib/sso-auth-idb";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
};

export type AwsSsoToken = {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  region: string;
  expiresAt: string;
  savedAt: string;
};

export type TwilioCredentials = {
  accountSid: string;
  authToken: string;

  phoneNumber?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
};

export type StoredCredentials = {
  /*
   * Unique ID:
   * accountId::roleName
   */
  id: string;

  accountId: string;
  accountName?: string;
  roleName: string;

  aws: AwsCredentials;
  twilio: TwilioCredentials | null;

  savedAt: string;
  updatedAt: string;
};

export type SaveCredentialsInput = {
  accountId: string;
  accountName?: string;
  roleName: string;

  aws: AwsCredentials;
  twilio?: TwilioCredentials | null;
};

export type SaveAwsCredentialsInput = {
  accountId: string;
  accountName?: string;
  roleName: string;

  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
};

export type SaveTwilioCredentialsInput = {
  accountId: string;
  roleName: string;
  twilio: TwilioCredentials;
};

export type TwilioAccountEntry = {
  twilioSid: string;
  twilioAuthToken: string;
  phoneNumber?: string;
};

export type TwilioAccountMap = Record<string, TwilioAccountEntry>;

/* -------------------------------------------------------------------------- */
/* General Helpers                                                            */
/* -------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();

  return normalized || undefined;
}

export function createCredentialsId(
  accountId: string,
  roleName: string,
): string {
  return `${accountId.trim()}::${roleName.trim()}`;
}

function parseCredentialsId(
  credentialsId: string,
): { accountId: string; roleName: string } | null {
  const parts = credentialsId.split("::");
  if (parts.length < 2) return null;
  const accountId = parts[0]?.trim();
  const roleName = parts.slice(1).join("::").trim();
  if (!accountId || !roleName) return null;
  return { accountId, roleName };
}

function roleToStoredCredentials(role: IdbRoleCredentials): StoredCredentials {
  const now = role.savedAt || new Date().toISOString();
  return {
    id: createCredentialsId(role.accountId, role.roleName),
    accountId: role.accountId,
    accountName: role.accountName,
    roleName: role.roleName,
    aws: {
      accessKeyId: role.accessKeyId,
      secretAccessKey: role.secretAccessKey,
      sessionToken: role.sessionToken,
      expiration: role.expiration,
    },
    twilio: null,
    savedAt: now,
    updatedAt: now,
  };
}

function authToAwsSsoToken(
  auth: NonNullable<Awaited<ReturnType<typeof loadIdbAuth>>>,
): AwsSsoToken | null {
  if (!auth.accessToken?.trim()) return null;
  return {
    accessToken: auth.accessToken.trim(),
    refreshToken: auth.refreshToken?.trim() || undefined,
    clientId: auth.clientId?.trim() || undefined,
    clientSecret: auth.clientSecret?.trim() || undefined,
    region: (auth.region || "us-east-1").trim(),
    expiresAt: auth.accessTokenExpiresAt || new Date(0).toISOString(),
    savedAt: auth.savedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateAccountId(accountId: string): string {
  const normalizedAccountId = accountId?.trim();

  if (!normalizedAccountId) {
    throw new Error("AWS account ID is required.");
  }

  if (!/^\d{12}$/.test(normalizedAccountId)) {
    throw new Error("AWS account ID must contain exactly 12 digits.");
  }

  return normalizedAccountId;
}

function validateAccountAndRole(
  accountId: string,
  roleName: string,
): {
  accountId: string;
  roleName: string;
} {
  const normalizedAccountId = validateAccountId(accountId);

  const normalizedRoleName = roleName?.trim();

  if (!normalizedRoleName) {
    throw new Error("AWS role name is required.");
  }

  return {
    accountId: normalizedAccountId,
    roleName: normalizedRoleName,
  };
}

function validateAwsCredentials(credentials: AwsCredentials): void {
  if (!credentials.accessKeyId?.trim()) {
    throw new Error("AWS access key ID is required.");
  }

  if (!credentials.secretAccessKey?.trim()) {
    throw new Error("AWS secret access key is required.");
  }

  if (!credentials.sessionToken?.trim()) {
    throw new Error("AWS session token is required.");
  }

  if (!credentials.expiration?.trim()) {
    throw new Error("AWS credential expiration is required.");
  }

  const expirationTime = new Date(credentials.expiration).getTime();

  if (Number.isNaN(expirationTime)) {
    throw new Error("AWS credential expiration is invalid.");
  }

  if (expirationTime <= Date.now()) {
    throw new Error("AWS credentials are already expired.");
  }
}

function validateTwilioCredentials(credentials: TwilioCredentials): void {
  const accountSid = credentials.accountSid?.trim();

  const authToken = credentials.authToken?.trim();

  if (!accountSid) {
    throw new Error("Twilio Account SID is required.");
  }

  if (!authToken) {
    throw new Error("Twilio Auth Token is required.");
  }

  if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) {
    throw new Error("Twilio Account SID has an invalid format.");
  }
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

function normalizeAwsCredentials(credentials: AwsCredentials): AwsCredentials {
  return {
    accessKeyId: credentials.accessKeyId.trim(),

    secretAccessKey: credentials.secretAccessKey.trim(),

    sessionToken: credentials.sessionToken.trim(),

    expiration: new Date(credentials.expiration).toISOString(),
  };
}

function normalizeTwilioCredentials(
  credentials: TwilioCredentials,
): TwilioCredentials {
  return {
    accountSid: credentials.accountSid.trim(),

    authToken: credentials.authToken.trim(),

    phoneNumber: normalizeOptionalString(credentials.phoneNumber),

    apiKeySid: normalizeOptionalString(credentials.apiKeySid),

    apiKeySecret: normalizeOptionalString(credentials.apiKeySecret),
  };
}

/* -------------------------------------------------------------------------- */
/* Save Complete Credentials                                                  */
/* -------------------------------------------------------------------------- */

export async function saveCredentials(
  input: SaveCredentialsInput,
): Promise<StoredCredentials> {
  const stored = await saveAwsCredentials({
    accountId: input.accountId,
    accountName: input.accountName,
    roleName: input.roleName,
    accessKeyId: input.aws.accessKeyId,
    secretAccessKey: input.aws.secretAccessKey,
    sessionToken: input.aws.sessionToken,
    expiration: input.aws.expiration,
  });

  if (!input.twilio) {
    return stored;
  }

  validateTwilioCredentials(input.twilio);
  return {
    ...stored,
    twilio: normalizeTwilioCredentials(input.twilio),
  };
}

export async function getSafeSelectedCredentials(): Promise<StoredCredentials | null> {
  try {
    const credentials = await getSelectedCredentials();

    if (!credentials) {
      return null;
    }

    const expectedId = createCredentialsId(
      credentials.accountId,
      credentials.roleName,
    );

    const invalidRecord =
      !credentials.id?.trim() ||
      credentials.id !== expectedId ||
      !/^\d{12}$/.test(credentials.accountId) ||
      !credentials.roleName?.trim() ||
      !credentials.aws;

    if (invalidRecord) {
      await clearSelectedCredentials();
      return null;
    }

    const aws = credentials.aws;

    const incompleteCredentials =
      !aws.accessKeyId?.trim() ||
      !aws.secretAccessKey?.trim() ||
      !aws.sessionToken?.trim() ||
      !aws.expiration?.trim();

    if (incompleteCredentials || areAwsCredentialsExpired(aws)) {
      await clearSelectedCredentials();
      return null;
    }

    return credentials;
  } catch {
    await clearSelectedCredentials().catch(() => undefined);
    return null;
  }
}

function isUsableCredentials(credentials: StoredCredentials): boolean {
  const expectedId = createCredentialsId(credentials.accountId, credentials.roleName);

  if (
    !credentials.id?.trim() ||
    credentials.id !== expectedId ||
    !/^\d{12}$/.test(credentials.accountId) ||
    !credentials.roleName?.trim() ||
    !credentials.aws
  ) {
    return false;
  }

  const aws = credentials.aws;

  if (
    !aws.accessKeyId?.trim() ||
    !aws.secretAccessKey?.trim() ||
    !aws.sessionToken?.trim() ||
    !aws.expiration?.trim()
  ) {
    return false;
  }

  return !areAwsCredentialsExpired(aws);
}

/**
 * Prefer the currently selected account/role.
 * If none is selected (or it expired), use the first valid stored credential.
 * With one account → that one; with multiple → first after stable sort.
 */
export async function getPreferredCredentials(): Promise<StoredCredentials | null> {
  const selected = await getSafeSelectedCredentials();

  if (selected) {
    return selected;
  }

  try {
    const all = await getAllCredentials();
    const usable = all.filter(isUsableCredentials);

    if (usable.length === 0) {
      return null;
    }

    const preferred = usable[0];
    await setSelectedCredentials(preferred.id);
    return preferred;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Save Only AWS Credentials                                                  */
/* -------------------------------------------------------------------------- */

export async function saveAwsCredentials(
  input: SaveAwsCredentialsInput,
): Promise<StoredCredentials> {
  const { accountId, roleName } = validateAccountAndRole(
    input.accountId,
    input.roleName,
  );

  const awsCredentials: AwsCredentials = {
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
    sessionToken: input.sessionToken,
    expiration: input.expiration,
  };

  validateAwsCredentials(awsCredentials);
  const normalized = normalizeAwsCredentials(awsCredentials);

  const auth = await saveIdbRoleCredentials({
    accountId,
    accountName: normalizeOptionalString(input.accountName),
    roleName,
    accessKeyId: normalized.accessKeyId,
    secretAccessKey: normalized.secretAccessKey,
    sessionToken: normalized.sessionToken,
    expiration: normalized.expiration,
  });

  const role = getSelectedRole(auth);
  if (!role) {
    throw new Error("AWS credentials could not be saved to IndexedDB auth store.");
  }

  return roleToStoredCredentials(role);
}

/* -------------------------------------------------------------------------- */
/* Twilio — resolved from server mappings; not persisted in IndexedDB         */
/* -------------------------------------------------------------------------- */

export async function saveTwilioCredentials(
  input: SaveTwilioCredentialsInput,
): Promise<StoredCredentials> {
  const { accountId, roleName } = validateAccountAndRole(
    input.accountId,
    input.roleName,
  );

  validateTwilioCredentials(input.twilio);

  const existing = await getCredentials(accountId, roleName);

  if (!existing) {
    throw new Error(
      "AWS credentials must be saved before adding Twilio credentials.",
    );
  }

  return {
    ...existing,
    twilio: normalizeTwilioCredentials(input.twilio),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Twilio account map is no longer cached in IndexedDB.
 * Twilio is resolved server-side from twilio-mappings.
 */
export async function upsertTwilioForAccount(
  _accountId: string,
  _twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber?: string;
  },
): Promise<TwilioAccountMap> {
  return {};
}

export async function getTwilioAccountMap(): Promise<TwilioAccountMap> {
  return {};
}

export async function getTwilioForAccount(
  _accountId: string,
): Promise<TwilioAccountEntry | null> {
  return null;
}

/* -------------------------------------------------------------------------- */
/* AWS SSO Token — stored in voice-ai-db / auth (session)                      */
/* -------------------------------------------------------------------------- */

export type SaveAwsSsoTokenInput = {
  accessToken: string;
  region: string;
  expiresInSeconds: number;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
};

export async function saveAwsSsoToken(
  input: SaveAwsSsoTokenInput,
): Promise<AwsSsoToken> {
  const normalizedAccessToken = input.accessToken?.trim();
  const normalizedRegion = input.region?.trim() || "us-east-1";
  const expiresInSeconds = input.expiresInSeconds;

  if (!normalizedAccessToken) {
    throw new Error("AWS SSO access token is required.");
  }

  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("AWS SSO token expiration is invalid.");
  }

  const expiresAt = new Date(
    Date.now() + expiresInSeconds * 1000,
  ).toISOString();

  const auth = await saveIdbSsoSession({
    accessToken: normalizedAccessToken,
    refreshToken: input.refreshToken?.trim(),
    accessTokenExpiresAt: expiresAt,
    clientId: input.clientId?.trim(),
    clientSecret: input.clientSecret?.trim(),
    region: normalizedRegion,
    keepRoles: true,
  });

  const token = authToAwsSsoToken(auth);
  if (!token) {
    throw new Error("AWS SSO token could not be saved.");
  }
  return token;
}

async function refreshAwsSsoToken(token: AwsSsoToken): Promise<AwsSsoToken | null> {
  const refreshToken = token.refreshToken?.trim();
  const clientId = token.clientId?.trim();
  const clientSecret = token.clientSecret?.trim();
  const region = token.region?.trim() || "us-east-1";

  if (!refreshToken || !clientId || !clientSecret) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        refreshToken,
        clientId,
        clientSecret,
        region,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      region?: string;
    };

    if (!response.ok || !data.success || !data.accessToken || !data.expiresIn) {
      return null;
    }

    return saveAwsSsoToken({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      clientId,
      clientSecret,
      region: data.region || region,
      expiresInSeconds: data.expiresIn,
    });
  } catch {
    return null;
  }
}

/** Read the stored SSO token without refreshing (for UI display). */
export async function getAwsSsoTokenSnapshot(): Promise<AwsSsoToken | null> {
  const auth = await loadIdbAuth();
  if (!auth) return null;
  return authToAwsSsoToken(auth);
}

/**
 * Force-refresh the SSO access token (and refresh token when rotated)
 * in voice-ai-db / auth.
 */
export async function refreshStoredAwsSsoToken(): Promise<AwsSsoToken | null> {
  const snapshot = await getAwsSsoTokenSnapshot();
  if (!snapshot) {
    return null;
  }
  return refreshAwsSsoToken(snapshot);
}

/**
 * Returns a usable SSO access token from IndexedDB.
 * If the access token expired, refreshes it with the long-lived refresh token
 * (no device approval) when client registration details are available.
 */
export async function getValidAwsSsoToken(): Promise<AwsSsoToken | null> {
  const auth = await loadIdbAuth();
  if (!auth) return null;

  const token = authToAwsSsoToken(auth);
  if (!token?.accessToken) {
    return null;
  }

  const expirationTime = new Date(token.expiresAt).getTime();
  const stillValid =
    !Number.isNaN(expirationTime) && expirationTime > Date.now() + 60_000;

  if (stillValid) {
    return token;
  }

  const refreshed = await refreshAwsSsoToken(token);
  if (refreshed) {
    return refreshed;
  }

  // Access token unusable and refresh failed — full re-auth required.
  await clearIdbAuth();
  return null;
}

export async function clearAwsSsoToken(): Promise<void> {
  await clearIdbAuth();
}

/* -------------------------------------------------------------------------- */
/* Read Credentials — from voice-ai-db / auth.roles                           */
/* -------------------------------------------------------------------------- */

export async function getCredentials(
  accountId: string,
  roleName: string,
): Promise<StoredCredentials | null> {
  const normalized = validateAccountAndRole(accountId, roleName);
  const auth = await loadIdbAuth();
  if (!auth) return null;
  const role = auth.roles[`${normalized.accountId}:${normalized.roleName}`];
  return role ? roleToStoredCredentials(role) : null;
}

export async function getCredentialsByAccountId(
  accountId: string,
): Promise<StoredCredentials[]> {
  const normalizedAccountId = validateAccountId(accountId);
  const auth = await loadIdbAuth();
  if (!auth) return [];
  return listCachedRoles(auth)
    .filter((role) => role.accountId === normalizedAccountId)
    .map(roleToStoredCredentials);
}

export async function getAllCredentials(): Promise<StoredCredentials[]> {
  const auth = await loadIdbAuth();
  const credentials = listCachedRoles(auth).map(roleToStoredCredentials);

  return credentials.sort((first, second) => {
    const firstName = first.accountName || first.accountId;
    const secondName = second.accountName || second.accountId;
    const accountComparison = firstName.localeCompare(secondName);
    if (accountComparison !== 0) {
      return accountComparison;
    }
    return first.roleName.localeCompare(second.roleName);
  });
}

/* -------------------------------------------------------------------------- */
/* Selected Credentials                                                       */
/* -------------------------------------------------------------------------- */

export async function setSelectedCredentials(
  credentialsId: string,
): Promise<void> {
  const parsed = parseCredentialsId(credentialsId);
  if (!parsed) {
    throw new Error("Invalid credentials id.");
  }
  await setIdbSelectedRole(parsed.accountId, parsed.roleName);
}

export async function selectCredentials(
  accountId: string,
  roleName: string,
): Promise<StoredCredentials> {
  const credentials = await getCredentials(accountId, roleName);

  if (!credentials) {
    throw new Error(
      "Credentials were not found for the selected account and role.",
    );
  }

  if (areAwsCredentialsExpired(credentials.aws)) {
    throw new Error("AWS credentials for the selected account have expired.");
  }

  await setIdbSelectedRole(credentials.accountId, credentials.roleName);
  return credentials;
}

export async function getSelectedCredentials(): Promise<StoredCredentials | null> {
  const auth = await loadIdbAuth();
  const role = getSelectedRole(auth);
  return role ? roleToStoredCredentials(role) : null;
}

export async function getValidSelectedCredentials(): Promise<StoredCredentials | null> {
  const credentials = await getSelectedCredentials();

  if (!credentials) {
    return null;
  }

  if (areAwsCredentialsExpired(credentials.aws)) {
    return null;
  }

  return credentials;
}

/*
 * Backward-compatible helper.
 *
 * Returns the complete selected record containing
 * both AWS and Twilio credentials.
 */
export async function getSelectedAwsCredentials(): Promise<StoredCredentials | null> {
  return getSelectedCredentials();
}

export async function getSelectedAwsOnly(): Promise<AwsCredentials | null> {
  const credentials = await getValidSelectedCredentials();

  return credentials?.aws ?? null;
}

export async function getSelectedTwilioCredentials(): Promise<TwilioCredentials | null> {
  const credentials = await getSelectedCredentials();

  return credentials?.twilio ?? null;
}

export async function clearSelectedCredentials(): Promise<void> {
  const existing = await loadIdbAuth();
  if (!existing) return;
  await saveIdbAuth({
    ...existing,
    selected: undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* Active project — stored on voice-ai-db auth session                        */
/* -------------------------------------------------------------------------- */

/**
 * Read the active projectId from IndexedDB (voice-ai-db / auth session).
 * This is the client source of truth for the current project.
 */
export async function getActiveProjectIdSetting(): Promise<string | null> {
  if (!isBrowser()) return null;
  return getIdbActiveProjectId();
}

/**
 * Persist the active projectId on the IndexedDB auth session.
 */
export async function setActiveProjectIdSetting(projectId: string): Promise<void> {
  if (!isBrowser()) return;
  await setIdbActiveProjectId(projectId);
}

export async function clearActiveProjectIdSetting(): Promise<void> {
  if (!isBrowser()) return;
  await clearIdbActiveProjectId();
}

/* -------------------------------------------------------------------------- */
/* Expiration Helpers                                                         */
/* -------------------------------------------------------------------------- */

export function areAwsCredentialsExpired(
  credentials: Pick<AwsCredentials, "expiration">,
  bufferSeconds = 60,
): boolean {
  const expirationTime = new Date(credentials.expiration).getTime();

  if (Number.isNaN(expirationTime)) {
    return true;
  }

  const normalizedBuffer = Math.max(0, bufferSeconds);

  return expirationTime <= Date.now() + normalizedBuffer * 1000;
}

export function getAwsCredentialsRemainingSeconds(
  credentials: Pick<AwsCredentials, "expiration">,
): number {
  const expirationTime = new Date(credentials.expiration).getTime();

  if (Number.isNaN(expirationTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((expirationTime - Date.now()) / 1000));
}

/* -------------------------------------------------------------------------- */
/* Delete Credentials                                                         */
/* -------------------------------------------------------------------------- */

export async function deleteCredentials(
  accountId: string,
  roleName: string,
): Promise<void> {
  const normalized = validateAccountAndRole(accountId, roleName);
  const auth = await loadIdbAuth();
  if (!auth) return;

  const key = authRoleKey(normalized.accountId, normalized.roleName);
  if (!auth.roles[key]) return;

  const roles = { ...auth.roles };
  delete roles[key];

  const selected =
    auth.selected?.accountId === normalized.accountId &&
    auth.selected?.roleName === normalized.roleName
      ? undefined
      : auth.selected;

  await saveIdbAuth({
    ...auth,
    selected,
    roles,
  });
}

export async function deleteCredentialsByAccountId(
  accountId: string,
): Promise<void> {
  const normalizedAccountId = validateAccountId(accountId);
  const auth = await loadIdbAuth();
  if (!auth) return;

  const roles: typeof auth.roles = {};
  for (const [key, role] of Object.entries(auth.roles)) {
    if (role.accountId !== normalizedAccountId) {
      roles[key] = role;
    }
  }

  const selected =
    auth.selected?.accountId === normalizedAccountId
      ? undefined
      : auth.selected;

  await saveIdbAuth({
    ...auth,
    selected,
    roles,
  });
}

/* -------------------------------------------------------------------------- */
/* Clear Credentials                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Clears the temporary AWS role credentials and selected-account setting.
 *
 * The cached AWS SSO token remains available.
 * This allows users to fetch accounts and roles again
 * without repeating AWS device approval.
 */
export async function clearStoredAccountCredentials(): Promise<void> {
  await clearIdbRoleCredentials();
}

/*
 * Clears credentials, selected accounts, cached
 * SSO tokens, and active project on the auth session.
 *
 * Use this function only for explicit logout.
 */
export async function clearAllCredentials(): Promise<void> {
  await clearIdbAuth();
  await deleteLegacyCredentialsDatabase();
}

/* -------------------------------------------------------------------------- */
/* Database Connection Cleanup                                                */
/* -------------------------------------------------------------------------- */

export async function closeCredentialsDatabase(): Promise<void> {
  await closeIdb();
}

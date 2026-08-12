"use client";

import { type DBSchema, type IDBPDatabase, openDB } from "idb";

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

type AppSetting = {
  key: string;
  value: unknown;
  updatedAt: string;
};

/* -------------------------------------------------------------------------- */
/* IndexedDB Schema                                                           */
/* -------------------------------------------------------------------------- */

interface CredentialsDatabase extends DBSchema {
  logCredentials: {
    key: string;
    value: StoredCredentials;

    indexes: {
      accountId: string;
      roleName: string;
      expiration: string;
      updatedAt: string;
    };
  };

  appSettings: {
    key: string;
    value: AppSetting;
  };
}

/* -------------------------------------------------------------------------- */
/* Database Configuration                                                     */
/* -------------------------------------------------------------------------- */

const DATABASE_NAME = "voice-ai-dashboard";
const DATABASE_VERSION = 3;

const CREDENTIALS_STORE = "logCredentials";
const SETTINGS_STORE = "appSettings";

const SELECTED_CREDENTIALS_KEY = "selectedCredentialsId";

const ACTIVE_PROJECT_ID_KEY = "activeProjectId";

const AWS_SSO_TOKEN_KEY = "awsSsoToken";

/** Map of AWS account ID → Twilio credentials (from server env, cached in IDB). */
const TWILIO_BY_ACCOUNT_KEY = "twilioCredentialsByAccount";

const LEGACY_SELECTED_KEYS = [
  "selectedAwsCredentialsId",
  "selectedAccountCredentialsId",
] as const;

export type TwilioAccountEntry = {
  twilioSid: string;
  twilioAuthToken: string;
  phoneNumber?: string;
};

export type TwilioAccountMap = Record<string, TwilioAccountEntry>;

let databasePromise: Promise<IDBPDatabase<CredentialsDatabase>> | null = null;

let databaseConnection: IDBPDatabase<CredentialsDatabase> | null = null;

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

function getStringSettingValue(setting: AppSetting | undefined): string | null {
  if (!setting || typeof setting.value !== "string") {
    return null;
  }

  const value = setting.value.trim();

  return value || null;
}

function isAwsSsoToken(value: unknown): value is AwsSsoToken {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const token = value as Partial<AwsSsoToken>;

  return (
    typeof token.accessToken === "string" &&
    Boolean(token.accessToken.trim()) &&
    typeof token.region === "string" &&
    Boolean(token.region.trim()) &&
    typeof token.expiresAt === "string" &&
    Boolean(token.expiresAt.trim()) &&
    typeof token.savedAt === "string"
  );
}

export function createCredentialsId(
  accountId: string,
  roleName: string,
): string {
  return `${accountId.trim()}::${roleName.trim()}`;
}

/* -------------------------------------------------------------------------- */
/* Database Connection                                                        */
/* -------------------------------------------------------------------------- */

async function getDatabase(): Promise<IDBPDatabase<CredentialsDatabase>> {
  if (!isBrowser()) {
    throw new Error("IndexedDB is available only in the browser.");
  }

  if (!databasePromise) {
    databasePromise = openDB<CredentialsDatabase>(
      DATABASE_NAME,
      DATABASE_VERSION,
      {
        upgrade(database, oldVersion) {
          /*
           * Version 1 contained an old flat credential structure.
           * Recreate only that old credential store during migration.
           */
          if (
            oldVersion < 2 &&
            database.objectStoreNames.contains(CREDENTIALS_STORE)
          ) {
            database.deleteObjectStore(CREDENTIALS_STORE);
          }

          if (!database.objectStoreNames.contains(CREDENTIALS_STORE)) {
            const store = database.createObjectStore(CREDENTIALS_STORE, {
              keyPath: "id",
            });

            store.createIndex("accountId", "accountId", {
              unique: false,
            });

            store.createIndex("roleName", "roleName", {
              unique: false,
            });

            store.createIndex("expiration", "aws.expiration", {
              unique: false,
            });

            store.createIndex("updatedAt", "updatedAt", {
              unique: false,
            });
          }

          if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
            database.createObjectStore(SETTINGS_STORE, {
              keyPath: "key",
            });
          }
        },

        blocked() {
          console.warn(
            "IndexedDB upgrade is blocked. Close other application tabs and refresh.",
          );
        },

        blocking() {
          databaseConnection?.close();

          databaseConnection = null;
          databasePromise = null;
        },

        terminated() {
          databaseConnection = null;
          databasePromise = null;
        },
      },
    )
      .then((database) => {
        databaseConnection = database;

        return database;
      })
      .catch((error) => {
        databaseConnection = null;
        databasePromise = null;

        throw error;
      });
  }

  return databasePromise;
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
/* Selected Setting Helpers                                                   */
/* -------------------------------------------------------------------------- */

async function putSelectedSetting(
  database: IDBPDatabase<CredentialsDatabase>,
  credentialsId: string,
): Promise<void> {
  const normalizedId = credentialsId.trim();

  if (!normalizedId) {
    throw new Error("Credential ID is required.");
  }

  const credentials = await database.get(CREDENTIALS_STORE, normalizedId);

  if (!credentials) {
    throw new Error("The credential record could not be found.");
  }

  const now = new Date().toISOString();

  await database.put(SETTINGS_STORE, {
    key: SELECTED_CREDENTIALS_KEY,

    value: normalizedId,

    updatedAt: now,
  });

  const savedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  if (getStringSettingValue(savedSetting) !== normalizedId) {
    throw new Error("Selected credentials setting could not be saved.");
  }
}

/* -------------------------------------------------------------------------- */
/* Save Complete Credentials                                                  */
/* -------------------------------------------------------------------------- */

export async function saveCredentials(
  input: SaveCredentialsInput,
): Promise<StoredCredentials> {
  const { accountId, roleName } = validateAccountAndRole(
    input.accountId,
    input.roleName,
  );

  validateAwsCredentials(input.aws);

  if (input.twilio) {
    validateTwilioCredentials(input.twilio);
  }

  const database = await getDatabase();

  const id = createCredentialsId(accountId, roleName);

  const existing = await database.get(CREDENTIALS_STORE, id);

  const now = new Date().toISOString();

  const storedCredentials: StoredCredentials = {
    id,
    accountId,

    accountName:
      normalizeOptionalString(input.accountName) || existing?.accountName,

    roleName,

    aws: normalizeAwsCredentials(input.aws),

    twilio: input.twilio
      ? normalizeTwilioCredentials(input.twilio)
      : (existing?.twilio ?? null),

    savedAt: existing?.savedAt ?? now,

    updatedAt: now,
  };

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  await transaction.objectStore(CREDENTIALS_STORE).put(storedCredentials);

  await transaction.objectStore(SETTINGS_STORE).put({
    key: SELECTED_CREDENTIALS_KEY,

    value: id,

    updatedAt: now,
  });

  await transaction.done;

  /*
   * Verify that selectedCredentialsId
   * was successfully saved in appSettings.
   */
  const selectedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  if (getStringSettingValue(selectedSetting) !== id) {
    throw new Error(
      "Credentials were saved, but the selected account setting was not saved.",
    );
  }

  return storedCredentials;
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

  const database = await getDatabase();

  const id = createCredentialsId(accountId, roleName);

  const existing = await database.get(CREDENTIALS_STORE, id);

  const now = new Date().toISOString();

  const storedCredentials: StoredCredentials = {
    id,
    accountId,

    accountName:
      normalizeOptionalString(input.accountName) || existing?.accountName,

    roleName,

    aws: normalizeAwsCredentials(awsCredentials),

    twilio: existing?.twilio ?? null,

    savedAt: existing?.savedAt ?? now,

    updatedAt: now,
  };

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  await transaction.objectStore(CREDENTIALS_STORE).put(storedCredentials);

  await transaction.objectStore(SETTINGS_STORE).put({
    key: SELECTED_CREDENTIALS_KEY,

    value: id,

    updatedAt: now,
  });

  await transaction.done;

  const selectedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  if (getStringSettingValue(selectedSetting) !== id) {
    throw new Error(
      "AWS credentials were saved, but the selected-account setting was not saved.",
    );
  }

  return storedCredentials;
}

/* -------------------------------------------------------------------------- */
/* Save Only Twilio Credentials                                               */
/* -------------------------------------------------------------------------- */

export async function saveTwilioCredentials(
  input: SaveTwilioCredentialsInput,
): Promise<StoredCredentials> {
  const { accountId, roleName } = validateAccountAndRole(
    input.accountId,
    input.roleName,
  );

  validateTwilioCredentials(input.twilio);

  const database = await getDatabase();

  const id = createCredentialsId(accountId, roleName);

  const existing = await database.get(CREDENTIALS_STORE, id);

  if (!existing) {
    throw new Error(
      "AWS credentials must be saved before adding Twilio credentials.",
    );
  }

  const updatedCredentials: StoredCredentials = {
    ...existing,

    twilio: normalizeTwilioCredentials(input.twilio),

    updatedAt: new Date().toISOString(),
  };

  await database.put(CREDENTIALS_STORE, updatedCredentials);

  await upsertTwilioForAccount(accountId, {
    accountSid: input.twilio.accountSid,
    authToken: input.twilio.authToken,
    phoneNumber: input.twilio.phoneNumber,
  });

  return updatedCredentials;
}

function isTwilioAccountMap(value: unknown): value is TwilioAccountMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).every(
    ([accountId, entry]) => {
      if (!/^\d{12}$/.test(accountId)) return false;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const record = entry as Partial<TwilioAccountEntry>;
      return (
        typeof record.twilioSid === "string" &&
        Boolean(record.twilioSid.trim()) &&
        typeof record.twilioAuthToken === "string" &&
        Boolean(record.twilioAuthToken.trim())
      );
    },
  );
}

/**
 * Upsert Twilio credentials for an AWS account ID into the IndexedDB map:
 * `{ [accountId]: { twilioSid, twilioAuthToken, phoneNumber? } }`
 */
export async function upsertTwilioForAccount(
  accountId: string,
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber?: string;
  },
): Promise<TwilioAccountMap> {
  const normalizedAccountId = validateAccountId(accountId);
  validateTwilioCredentials({
    accountSid: twilio.accountSid,
    authToken: twilio.authToken,
    phoneNumber: twilio.phoneNumber,
  });

  const database = await getDatabase();
  const existingSetting = await database.get(SETTINGS_STORE, TWILIO_BY_ACCOUNT_KEY);
  const map: TwilioAccountMap = isTwilioAccountMap(existingSetting?.value)
    ? { ...existingSetting.value }
    : {};

  map[normalizedAccountId] = {
    twilioSid: twilio.accountSid.trim(),
    twilioAuthToken: twilio.authToken.trim(),
    phoneNumber: normalizeOptionalString(twilio.phoneNumber),
  };

  const now = new Date().toISOString();
  await database.put(SETTINGS_STORE, {
    key: TWILIO_BY_ACCOUNT_KEY,
    value: map,
    updatedAt: now,
  });

  return map;
}

export async function getTwilioAccountMap(): Promise<TwilioAccountMap> {
  const database = await getDatabase();
  const setting = await database.get(SETTINGS_STORE, TWILIO_BY_ACCOUNT_KEY);
  return isTwilioAccountMap(setting?.value) ? setting.value : {};
}

export async function getTwilioForAccount(
  accountId: string,
): Promise<TwilioAccountEntry | null> {
  const normalizedAccountId = validateAccountId(accountId);
  const map = await getTwilioAccountMap();
  return map[normalizedAccountId] ?? null;
}

/* -------------------------------------------------------------------------- */
/* AWS SSO Token                                                              */
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

  const database = await getDatabase();
  const now = new Date();

  const existingSetting = await database.get(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);
  const existing = isAwsSsoToken(existingSetting?.value)
    ? existingSetting.value
    : null;

  const token: AwsSsoToken = {
    accessToken: normalizedAccessToken,
    region: normalizedRegion,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
    savedAt: now.toISOString(),
    refreshToken:
      input.refreshToken?.trim() || existing?.refreshToken || undefined,
    clientId: input.clientId?.trim() || existing?.clientId || undefined,
    clientSecret:
      input.clientSecret?.trim() || existing?.clientSecret || undefined,
  };

  await database.put(SETTINGS_STORE, {
    key: AWS_SSO_TOKEN_KEY,
    value: token,
    updatedAt: now.toISOString(),
  });

  const savedSetting = await database.get(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);

  if (!isAwsSsoToken(savedSetting?.value)) {
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

/**
 * Returns a usable SSO access token from IndexedDB.
 * If the access token expired, refreshes it with the long-lived refresh token
 * (no device approval) when client registration details are available.
 */
export async function getValidAwsSsoToken(): Promise<AwsSsoToken | null> {
  const database = await getDatabase();
  const setting = await database.get(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);

  if (!isAwsSsoToken(setting?.value)) {
    if (setting) {
      await database.delete(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);
    }
    return null;
  }

  const token = setting.value;
  const expirationTime = new Date(token.expiresAt).getTime();
  const stillValid =
    !Number.isNaN(expirationTime) && expirationTime > Date.now() + 60_000;

  if (stillValid) {
    return {
      accessToken: token.accessToken.trim(),
      refreshToken: token.refreshToken?.trim() || undefined,
      clientId: token.clientId?.trim() || undefined,
      clientSecret: token.clientSecret?.trim() || undefined,
      region: token.region.trim(),
      expiresAt: token.expiresAt,
      savedAt: token.savedAt,
    };
  }

  const refreshed = await refreshAwsSsoToken(token);

  if (refreshed) {
    return refreshed;
  }

  await database.delete(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);
  return null;
}

export async function clearAwsSsoToken(): Promise<void> {
  const database = await getDatabase();
  await database.delete(SETTINGS_STORE, AWS_SSO_TOKEN_KEY);
}

/* -------------------------------------------------------------------------- */
/* Read Credentials                                                           */
/* -------------------------------------------------------------------------- */

export async function getCredentials(
  accountId: string,
  roleName: string,
): Promise<StoredCredentials | null> {
  const normalized = validateAccountAndRole(accountId, roleName);

  const database = await getDatabase();

  const id = createCredentialsId(normalized.accountId, normalized.roleName);

  return (await database.get(CREDENTIALS_STORE, id)) ?? null;
}

export async function getCredentialsByAccountId(
  accountId: string,
): Promise<StoredCredentials[]> {
  const normalizedAccountId = validateAccountId(accountId);

  const database = await getDatabase();

  return database.getAllFromIndex(
    CREDENTIALS_STORE,
    "accountId",
    normalizedAccountId,
  );
}

export async function getAllCredentials(): Promise<StoredCredentials[]> {
  const database = await getDatabase();

  const credentials = await database.getAll(CREDENTIALS_STORE);

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
  const database = await getDatabase();

  await putSelectedSetting(database, credentialsId);
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

  const database = await getDatabase();

  await putSelectedSetting(database, credentials.id);

  return credentials;
}

export async function getSelectedCredentials(): Promise<StoredCredentials | null> {
  const database = await getDatabase();

  let selectedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  let selectedId = getStringSettingValue(selectedSetting);

  /*
   * Older application versions may have stored
   * the selection using another key.
   */
  if (!selectedId) {
    for (const legacyKey of LEGACY_SELECTED_KEYS) {
      const legacySetting = await database.get(SETTINGS_STORE, legacyKey);

      const legacyId = getStringSettingValue(legacySetting);

      if (!legacyId) {
        continue;
      }

      const legacyCredentials = await database.get(CREDENTIALS_STORE, legacyId);

      if (!legacyCredentials) {
        await database.delete(SETTINGS_STORE, legacyKey);

        continue;
      }

      await putSelectedSetting(database, legacyId);

      await database.delete(SETTINGS_STORE, legacyKey);

      selectedSetting = await database.get(
        SETTINGS_STORE,
        SELECTED_CREDENTIALS_KEY,
      );

      selectedId = getStringSettingValue(selectedSetting);

      break;
    }
  }

  if (!selectedId) {
    return null;
  }

  const credentials = await database.get(CREDENTIALS_STORE, selectedId);

  /*
   * Remove a broken selection when its credentials
   * record no longer exists.
   */
  if (!credentials) {
    await database.delete(SETTINGS_STORE, SELECTED_CREDENTIALS_KEY);

    return null;
  }

  return credentials;
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
  const database = await getDatabase();

  const transaction = database.transaction(SETTINGS_STORE, "readwrite");

  const settingsStore = transaction.objectStore(SETTINGS_STORE);

  await settingsStore.delete(SELECTED_CREDENTIALS_KEY);

  for (const legacyKey of LEGACY_SELECTED_KEYS) {
    await settingsStore.delete(legacyKey);
  }

  await transaction.done;
}

/* -------------------------------------------------------------------------- */
/* Active project (AppSettings)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Read the active projectId from IndexedDB appSettings.
 * This is the client source of truth for the current project.
 */
export async function getActiveProjectIdSetting(): Promise<string | null> {
  if (!isBrowser()) return null;

  const database = await getDatabase();
  const setting = await database.get(SETTINGS_STORE, ACTIVE_PROJECT_ID_KEY);
  return getStringSettingValue(setting);
}

/**
 * Persist the active projectId in IndexedDB appSettings.
 */
export async function setActiveProjectIdSetting(projectId: string): Promise<void> {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error("Project ID is required.");
  }
  if (!isBrowser()) return;

  const database = await getDatabase();
  const now = new Date().toISOString();

  await database.put(SETTINGS_STORE, {
    key: ACTIVE_PROJECT_ID_KEY,
    value: normalized,
    updatedAt: now,
  });

  const saved = await database.get(SETTINGS_STORE, ACTIVE_PROJECT_ID_KEY);
  if (getStringSettingValue(saved) !== normalized) {
    throw new Error("Active project setting could not be saved.");
  }
}

export async function clearActiveProjectIdSetting(): Promise<void> {
  if (!isBrowser()) return;
  const database = await getDatabase();
  await database.delete(SETTINGS_STORE, ACTIVE_PROJECT_ID_KEY);
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

  const database = await getDatabase();

  const id = createCredentialsId(normalized.accountId, normalized.roleName);

  const selectedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  const selectedId = getStringSettingValue(selectedSetting);

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  await transaction.objectStore(CREDENTIALS_STORE).delete(id);

  if (selectedId === id) {
    await transaction
      .objectStore(SETTINGS_STORE)
      .delete(SELECTED_CREDENTIALS_KEY);
  }

  await transaction.done;
}

export async function deleteCredentialsByAccountId(
  accountId: string,
): Promise<void> {
  const credentials = await getCredentialsByAccountId(accountId);

  if (credentials.length === 0) {
    return;
  }

  const database = await getDatabase();

  const selectedSetting = await database.get(
    SETTINGS_STORE,
    SELECTED_CREDENTIALS_KEY,
  );

  const selectedId = getStringSettingValue(selectedSetting);

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  const credentialsStore = transaction.objectStore(CREDENTIALS_STORE);

  for (const item of credentials) {
    await credentialsStore.delete(item.id);
  }

  if (selectedId && credentials.some((item) => item.id === selectedId)) {
    await transaction
      .objectStore(SETTINGS_STORE)
      .delete(SELECTED_CREDENTIALS_KEY);
  }

  await transaction.done;
}

/* -------------------------------------------------------------------------- */
/* Clear Credentials                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Clears the temporary AWS role credentials,
 * Twilio credentials, and selected-account setting.
 *
 * The cached AWS SSO token remains available.
 * This allows users to fetch accounts and roles again
 * without repeating AWS device approval.
 */
export async function clearStoredAccountCredentials(): Promise<void> {
  const database = await getDatabase();

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  await transaction.objectStore(CREDENTIALS_STORE).clear();

  const settingsStore = transaction.objectStore(SETTINGS_STORE);

  await settingsStore.delete(SELECTED_CREDENTIALS_KEY);
  await settingsStore.delete(TWILIO_BY_ACCOUNT_KEY);

  for (const legacyKey of LEGACY_SELECTED_KEYS) {
    await settingsStore.delete(legacyKey);
  }

  await transaction.done;
}

/*
 * Clears credentials, selected accounts, cached
 * SSO tokens, and every app setting.
 *
 * Use this function only for explicit logout.
 */
export async function clearAllCredentials(): Promise<void> {
  const database = await getDatabase();

  const transaction = database.transaction(
    [CREDENTIALS_STORE, SETTINGS_STORE],
    "readwrite",
  );

  await transaction.objectStore(CREDENTIALS_STORE).clear();

  await transaction.objectStore(SETTINGS_STORE).clear();

  await transaction.done;
}

/* -------------------------------------------------------------------------- */
/* Database Connection Cleanup                                                */
/* -------------------------------------------------------------------------- */

export async function closeCredentialsDatabase(): Promise<void> {
  databaseConnection?.close();

  databaseConnection = null;
  databasePromise = null;
}

/**
 * Browser IndexedDB for SSO session, role credentials, and app settings.
 *
 * Database: voice-ai-db
 * Store:    auth
 * Keys:     session  — SSO tokens + selected role credentials
 *           settings — activeProjectId (and future app prefs)
 */

const DB_NAME = "voice-ai-db";
const DB_VERSION = 1;
const STORE = "auth";
const AUTH_KEY = "session";
const SETTINGS_KEY = "settings";

/** Legacy DB previously used for credentials + appSettings — removed after migrate. */
const LEGACY_DB_NAME = "voice-ai-dashboard";

let dbPromise: Promise<IDBDatabase> | null = null;
let legacyMigratePromise: Promise<void> | null = null;

export type IdbRoleCredentials = {
  accountId: string;
  accountName?: string;
  roleName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  savedAt: string;
};

export type IdbAuthState = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  /** OIDC client registration — needed to refresh without device login. */
  clientId?: string;
  clientSecret?: string;
  region?: string;
  selected?: { accountId: string; roleName: string };
  roles: Record<string, IdbRoleCredentials>;
  savedAt: string;
};

export type IdbAppSettings = {
  activeProjectId?: string;
  updatedAt: string;
};

export function authRoleKey(accountId: string, roleName: string) {
  return `${accountId.trim()}:${roleName.trim()}`;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("indexedDB open failed"));
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
    });
  }

  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onerror = () =>
      reject(req.error ?? new Error("indexedDB request failed"));
    req.onsuccess = () => resolve(req.result as T);
  });
}

function deleteLegacyDashboardDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(LEGACY_DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * One-time: copy activeProjectId from voice-ai-dashboard (if present),
 * then delete that database so the app only uses voice-ai-db.
 */
async function migrateLegacyDashboard(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (!legacyMigratePromise) {
    legacyMigratePromise = (async () => {
      let legacyProjectId: string | null = null;

      try {
        legacyProjectId = await new Promise<string | null>((resolve) => {
          let settled = false;
          const finish = (value: string | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };

          const openReq = indexedDB.open(LEGACY_DB_NAME);
          openReq.onerror = () => finish(null);
          openReq.onupgradeneeded = () => {
            // DB did not exist (or needs upgrade) — no useful legacy data.
            finish(null);
          };
          openReq.onsuccess = () => {
            const db = openReq.result;
            if (settled) {
              try {
                db.close();
              } catch {
                /* ignore */
              }
              return;
            }
            try {
              if (!db.objectStoreNames.contains("appSettings")) {
                db.close();
                finish(null);
                return;
              }
              const tx = db.transaction("appSettings", "readonly");
              const store = tx.objectStore("appSettings");
              const getReq = store.get("activeProjectId");
              getReq.onsuccess = () => {
                const row = getReq.result as
                  | { key?: string; value?: unknown }
                  | undefined;
                const value =
                  typeof row?.value === "string" ? row.value.trim() : "";
                db.close();
                finish(value || null);
              };
              getReq.onerror = () => {
                db.close();
                finish(null);
              };
            } catch {
              try {
                db.close();
              } catch {
                /* ignore */
              }
              finish(null);
            }
          };
        });
      } catch {
        legacyProjectId = null;
      }

      if (legacyProjectId) {
        try {
          await openDb();
          const existing = await withStore<IdbAppSettings | undefined>(
            "readonly",
            (store) => store.get(SETTINGS_KEY),
          );
          if (!existing?.activeProjectId?.trim()) {
            await withStore("readwrite", (store) =>
              store.put(
                {
                  activeProjectId: legacyProjectId,
                  updatedAt: new Date().toISOString(),
                } satisfies IdbAppSettings,
                SETTINGS_KEY,
              ),
            );
          }
        } catch {
          /* ignore */
        }
      }

      await deleteLegacyDashboardDb();
    })().catch(() => undefined);
  }
  await legacyMigratePromise;
}

async function ensureReady(): Promise<void> {
  await openDb();
  await migrateLegacyDashboard();
}

export async function loadIdbAuth(): Promise<IdbAuthState | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    await ensureReady();
    const value = await withStore<IdbAuthState | undefined>("readonly", (store) =>
      store.get(AUTH_KEY),
    );
    if (!value?.accessToken && !value?.refreshToken) return null;
    return {
      ...value,
      roles: value.roles ?? {},
    };
  } catch {
    return null;
  }
}

export async function saveIdbAuth(state: IdbAuthState): Promise<IdbAuthState> {
  await ensureReady();
  const payload: IdbAuthState = {
    ...state,
    roles: state.roles ?? {},
    savedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(payload, AUTH_KEY));
  return payload;
}

export async function loadIdbSettings(): Promise<IdbAppSettings | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    await ensureReady();
    const value = await withStore<IdbAppSettings | undefined>(
      "readonly",
      (store) => store.get(SETTINGS_KEY),
    );
    if (!value || typeof value !== "object") return null;
    return value;
  } catch {
    return null;
  }
}

export async function saveIdbSettings(
  settings: IdbAppSettings,
): Promise<IdbAppSettings> {
  await ensureReady();
  const payload: IdbAppSettings = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(payload, SETTINGS_KEY));
  return payload;
}

export async function getIdbActiveProjectId(): Promise<string | null> {
  const settings = await loadIdbSettings();
  const value = settings?.activeProjectId?.trim();
  return value || null;
}

export async function setIdbActiveProjectId(projectId: string): Promise<void> {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error("Project ID is required.");
  }
  const existing = await loadIdbSettings();
  await saveIdbSettings({
    ...existing,
    activeProjectId: normalized,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearIdbActiveProjectId(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await ensureReady();
    const existing = await loadIdbSettings();
    if (!existing) return;
    await saveIdbSettings({
      ...existing,
      activeProjectId: undefined,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
}

export async function saveIdbSsoSession(input: {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  clientId?: string;
  clientSecret?: string;
  region?: string;
  keepRoles?: boolean;
}): Promise<IdbAuthState> {
  const existing = await loadIdbAuth();
  return saveIdbAuth({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? existing?.refreshToken,
    accessTokenExpiresAt:
      input.accessTokenExpiresAt ?? existing?.accessTokenExpiresAt,
    clientId: input.clientId ?? existing?.clientId,
    clientSecret: input.clientSecret ?? existing?.clientSecret,
    region: input.region ?? existing?.region,
    selected: input.keepRoles === false ? undefined : existing?.selected,
    roles: input.keepRoles === false ? {} : (existing?.roles ?? {}),
    savedAt: new Date().toISOString(),
  });
}

export async function saveIdbRoleCredentials(
  role: Omit<IdbRoleCredentials, "savedAt">,
  sso?: {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: string;
    clientId?: string;
    clientSecret?: string;
    region?: string;
  },
): Promise<IdbAuthState> {
  const existing = await loadIdbAuth();
  if (!existing?.accessToken && !sso?.accessToken) {
    throw new Error("No SSO session in IndexedDB — sign in first");
  }

  const key = authRoleKey(role.accountId, role.roleName);
  const entry: IdbRoleCredentials = {
    ...role,
    savedAt: new Date().toISOString(),
  };

  return saveIdbAuth({
    accessToken: sso?.accessToken || existing!.accessToken,
    refreshToken: sso?.refreshToken ?? existing?.refreshToken,
    accessTokenExpiresAt:
      sso?.accessTokenExpiresAt ?? existing?.accessTokenExpiresAt,
    clientId: sso?.clientId ?? existing?.clientId,
    clientSecret: sso?.clientSecret ?? existing?.clientSecret,
    region: sso?.region ?? existing?.region,
    selected: { accountId: role.accountId, roleName: role.roleName },
    roles: {
      ...(existing?.roles ?? {}),
      [key]: entry,
    },
    savedAt: new Date().toISOString(),
  });
}

export async function setIdbSelectedRole(
  accountId: string,
  roleName: string,
): Promise<IdbAuthState | null> {
  const existing = await loadIdbAuth();
  if (!existing) return null;
  const key = authRoleKey(accountId, roleName);
  if (!existing.roles[key]) {
    throw new Error("Role credentials were not found in IndexedDB.");
  }
  return saveIdbAuth({
    ...existing,
    selected: { accountId, roleName },
  });
}

export async function clearIdbAuth(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await ensureReady();
    await withStore("readwrite", (store) => store.delete(AUTH_KEY));
  } catch {
    /* ignore */
  }
}

export async function clearIdbSettings(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await ensureReady();
    await withStore("readwrite", (store) => store.delete(SETTINGS_KEY));
  } catch {
    /* ignore */
  }
}

/** Clears cached role credentials but keeps the SSO access/refresh session. */
export async function clearIdbRoleCredentials(): Promise<void> {
  const existing = await loadIdbAuth();
  if (!existing) return;
  await saveIdbAuth({
    ...existing,
    selected: undefined,
    roles: {},
  });
}

export async function closeIdb(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

/** Best-effort removal of the legacy voice-ai-dashboard database. */
export async function deleteLegacyCredentialsDatabase(): Promise<void> {
  await deleteLegacyDashboardDb();
}

export function getSelectedRole(
  state: IdbAuthState | null,
): IdbRoleCredentials | null {
  if (!state?.selected) return null;
  return (
    state.roles[authRoleKey(state.selected.accountId, state.selected.roleName)] ??
    null
  );
}

export function listCachedRoles(
  state: IdbAuthState | null,
): IdbRoleCredentials[] {
  if (!state) return [];
  return Object.values(state.roles).sort((a, b) =>
    `${a.accountId}:${a.roleName}`.localeCompare(`${b.accountId}:${b.roleName}`),
  );
}

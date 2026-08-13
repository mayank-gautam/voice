/**
 * Browser IndexedDB for SSO session + per-account AWS role credentials.
 * Matches the aws-sso reference shape: one DB, one `auth` store, key `session`.
 *
 * Database: voice-ai-db
 * Store:    auth
 * Key:      session
 */

const DB_NAME = "voice-ai-db";
const DB_VERSION = 1;
const STORE = "auth";
const AUTH_KEY = "session";
/** Removed — only kept for one-time cleanup of older builds. */
const LEGACY_SETTINGS_KEY = "settings";

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
  /** Active mapped project for this browser session. */
  activeProjectId?: string;
  savedAt: string;
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

async function readLegacyDashboardProjectId(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const openReq = indexedDB.open(LEGACY_DB_NAME);
    openReq.onerror = () => finish(null);
    openReq.onupgradeneeded = () => {
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
}

/**
 * One-time cleanup:
 * - migrate activeProjectId from voice-ai-dashboard / old settings key onto session
 * - delete the settings key and voice-ai-dashboard DB
 */
async function migrateLegacyDashboard(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  if (!legacyMigratePromise) {
    legacyMigratePromise = (async () => {
      let legacyProjectId: string | null = null;
      try {
        legacyProjectId = await readLegacyDashboardProjectId();
      } catch {
        legacyProjectId = null;
      }

      try {
        await openDb();
        const [session, leftoverSettings] = await Promise.all([
          withStore<IdbAuthState | undefined>("readonly", (store) =>
            store.get(AUTH_KEY),
          ),
          withStore<{ activeProjectId?: string } | undefined>("readonly", (store) =>
            store.get(LEGACY_SETTINGS_KEY),
          ),
        ]);

        const fromSettings =
          typeof leftoverSettings?.activeProjectId === "string"
            ? leftoverSettings.activeProjectId.trim()
            : "";
        const projectId =
          session?.activeProjectId?.trim() ||
          fromSettings ||
          legacyProjectId ||
          "";

        if (session && (projectId || leftoverSettings)) {
          await withStore("readwrite", (store) =>
            store.put(
              {
                ...session,
                roles: session.roles ?? {},
                activeProjectId: projectId || session.activeProjectId,
                savedAt: session.savedAt || new Date().toISOString(),
              } satisfies IdbAuthState,
              AUTH_KEY,
            ),
          );
        }

        await withStore("readwrite", (store) =>
          store.delete(LEGACY_SETTINGS_KEY),
        );
      } catch {
        /* ignore */
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

export async function getIdbActiveProjectId(): Promise<string | null> {
  const auth = await loadIdbAuth();
  const value = auth?.activeProjectId?.trim();
  return value || null;
}

export async function setIdbActiveProjectId(projectId: string): Promise<void> {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error("Project ID is required.");
  }
  const existing = await loadIdbAuth();
  if (!existing) {
    throw new Error("No SSO session in IndexedDB — sign in first");
  }
  await saveIdbAuth({
    ...existing,
    activeProjectId: normalized,
  });
}

export async function clearIdbActiveProjectId(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const existing = await loadIdbAuth();
    if (!existing?.activeProjectId) return;
    await saveIdbAuth({
      ...existing,
      activeProjectId: undefined,
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
    activeProjectId:
      input.keepRoles === false ? undefined : existing?.activeProjectId,
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
    activeProjectId: existing?.activeProjectId,
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

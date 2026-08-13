/**
 * Browser IndexedDB store for SSO session + per-account AWS role credentials.
 * Matches the aws-sso reference shape: one DB, one `auth` store, key `session`.
 *
 * Database: voice-ai-db
 * Store:    auth
 */

const DB_NAME = "voice-ai-db";
const DB_VERSION = 1;
const STORE = "auth";
const AUTH_KEY = "session";

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

export function authRoleKey(accountId: string, roleName: string) {
  return `${accountId.trim()}:${roleName.trim()}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
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

export async function loadIdbAuth(): Promise<IdbAuthState | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
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
  const payload: IdbAuthState = {
    ...state,
    roles: state.roles ?? {},
    savedAt: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(payload, AUTH_KEY));
  return payload;
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

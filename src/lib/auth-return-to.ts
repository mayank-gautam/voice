/**
 * Shared helpers for post-SSO return paths.
 * Safe to import from Edge proxy and client code.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/sso",
  "/api/auth/login",
  "/api/auth/poll",
  "/api/auth/refresh",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/aws",
  "/api/mappings",
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Only allow same-origin relative paths. Reject open redirects and auth loops.
 */
export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.length > 512) return null;

  const pathOnly = value.split("?")[0]?.split("#")[0] || value;
  if (isPublicPath(pathOnly)) return null;

  return value;
}

export function buildSsoHref(returnTo?: string | null): string {
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return "/sso";
  return `/sso?returnTo=${encodeURIComponent(safe)}`;
}

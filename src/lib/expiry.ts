/** Normalize AWS/SDK expiration values to an ISO string, or null if unknown. */
export function toIsoExpiry(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return toIsoExpiry(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  return null;
}

export function msUntil(isoOrUnknown: unknown): number | null {
  const iso = toIsoExpiry(isoOrUnknown);
  if (!iso) return null;
  return Date.parse(iso) - Date.now();
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 48) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatExpiry(isoOrUnknown: unknown): string {
  const iso = toIsoExpiry(isoOrUnknown);
  if (!iso) return "Not available";
  const ms = Date.parse(iso);
  const remaining = ms - Date.now();
  const absolute = new Date(ms).toLocaleString();
  if (remaining <= 0) return `Expired · ${absolute}`;
  return `${absolute} · ${formatDuration(remaining)} left`;
}

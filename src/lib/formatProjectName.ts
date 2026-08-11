/**
 * Presentation-only helper: show project names in UPPERCASE in the UI.
 * Does not mutate stored project ids/names or API payloads.
 */
export function formatProjectNameDisplay(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "";
  return trimmed.toUpperCase();
}

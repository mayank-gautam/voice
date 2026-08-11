import { promises as fs } from "fs";
import path from "path";
import type { AccountHierarchy } from "@/lib/accountHierarchy";
import bundledDefault from "@/config/account-hierarchy.json";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "account-hierarchy.json");

function isValidHierarchy(value: unknown): value is AccountHierarchy {
  if (!value || typeof value !== "object") return false;
  const accounts = (value as AccountHierarchy).accounts;
  return Array.isArray(accounts);
}

/**
 * Loads Account → Role → Project → Twilio Groups.
 * Prefers `.data/account-hierarchy.json` (easy local edits);
 * falls back to the bundled dummy config under `src/config/`.
 *
 * Swap this loader later for real AWS/Twilio-backed data without changing UI.
 */
export async function loadAccountHierarchy(): Promise<AccountHierarchy> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isValidHierarchy(parsed)) {
      return parsed;
    }
  } catch {
    /* missing or invalid — seed from bundled default */
  }

  const fallback = bundledDefault as AccountHierarchy;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(fallback, null, 2), "utf8");
  } catch {
    /* non-fatal: still return in-memory default */
  }
  return fallback;
}

import { NextResponse } from "next/server";
import { loadAccountHierarchy } from "@/lib/server/accountHierarchy";

/**
 * Returns Account → Role → Project → Twilio Groups.
 * Dummy JSON today; replace `loadAccountHierarchy` later with live AWS/Twilio.
 */
export async function GET() {
  try {
    const hierarchy = await loadAccountHierarchy();
    return NextResponse.json(hierarchy);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load account hierarchy";
    return NextResponse.json(
      { error: { code: "HIERARCHY_LOAD_FAILED", message } },
      { status: 500 },
    );
  }
}

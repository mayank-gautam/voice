import { NextResponse } from "next/server";
import { getMappedScopeCatalog } from "@/lib/server/twilioMappings";

/**
 * Public catalog of account → roles from twilio-mappings (no Twilio secrets).
 * Used during SSO to filter AWS accounts/roles to mapped entries only.
 */
export async function GET() {
  const accounts = await getMappedScopeCatalog();
  return NextResponse.json({
    success: true,
    accounts,
    source: "twilio-mappings",
  });
}

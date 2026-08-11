import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, resolveProjectId, isAuthOk } from "@/lib/server/api";
import { getDecryptedActiveProject } from "@/lib/server/projectStore";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { requireTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";

export type TwilioPhoneNumberItem = {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthOk(auth)) return auth.response;

  const projectId = await resolveProjectId(request.nextUrl.searchParams);
  const project = await getDecryptedActiveProject(projectId, { accountId: auth.accountId, roleName: auth.roleName });

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") || 100), 1),
    200
  );

  try {
    const twilioConfig = requireTwilioConfigForAwsAccount(auth.accountId);
    const client = getTwilioClientFromConfig(twilioConfig);
    const list = await client.incomingPhoneNumbers.list({ limit });

    const numbers: TwilioPhoneNumberItem[] = list
      .map((n) => ({
        sid: n.sid,
        phoneNumber: String(n.phoneNumber || ""),
        friendlyName: String(n.friendlyName || n.phoneNumber || ""),
        capabilities: {
          voice: Boolean(n.capabilities?.voice),
          sms: Boolean(n.capabilities?.sms),
          mms: Boolean(n.capabilities?.mms),
        },
      }))
      .filter((n) => n.phoneNumber)
      .sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));

    return NextResponse.json({
      numbers,
      total: numbers.length,
      source: "twilio",
      projectId: project?.id ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list Twilio phone numbers";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}

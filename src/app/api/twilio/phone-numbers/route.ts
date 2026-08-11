import { NextRequest, NextResponse } from "next/server";
import { apiError, requireAuth, isAuthOk } from "@/lib/server/api";
import { getTwilioClientFromConfig } from "@/lib/server/twilio";
import { isProjectTwilioOk, requireProjectTwilio } from "@/lib/server/projectTwilio";

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

  const ctx = await requireProjectTwilio(auth, request.nextUrl.searchParams);
  if (!isProjectTwilioOk(ctx)) return ctx.response;

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") || 100), 1),
    200
  );

  try {
    const client = getTwilioClientFromConfig(ctx.twilio);
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
      projectId: ctx.project.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list Twilio phone numbers";
    return apiError(message, 502, "TWILIO_ERROR");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { GetRoleCredentialsCommand, SSOClient } from "@aws-sdk/client-sso";

import { getTwilioConfigForAwsAccount } from "@/lib/server/twilioEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  accessToken?: string;
  accountId?: string;
  roleName?: string;
  region?: string;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    const accessToken = body.accessToken?.trim();
    const accountId = body.accountId?.trim();
    const roleName = body.roleName?.trim();
    const region = body.region?.trim() || "us-east-1";

    if (!accessToken || !accountId || !roleName) {
      return NextResponse.json(
        {
          success: false,
          message: "Access token, account ID and role name are required.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (!/^\d{12}$/.test(accountId)) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS account ID must contain exactly 12 digits.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const ssoClient = new SSOClient({ region });

    const awsResponse = await ssoClient.send(
      new GetRoleCredentialsCommand({
        accessToken,
        accountId,
        roleName,
      }),
    );

    const roleCredentials = awsResponse.roleCredentials;

    if (!roleCredentials) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS did not return temporary credentials.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const accessKeyId = roleCredentials.accessKeyId?.trim();
    const secretAccessKey = roleCredentials.secretAccessKey?.trim();
    const sessionToken = roleCredentials.sessionToken?.trim();
    const expiration = roleCredentials.expiration;

    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS did not return complete temporary credentials.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    if (typeof expiration !== "number" || !Number.isFinite(expiration)) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS returned an invalid credential expiration.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const expirationDate = new Date(expiration);

    if (Number.isNaN(expirationDate.getTime()) || expirationDate.getTime() <= Date.now()) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS returned credentials that are already expired.",
        },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    // Twilio stays server-side (env TWILIO_*_<accountId>). Never return auth tokens to the browser.
    const twilioConfig = getTwilioConfigForAwsAccount(accountId);

    return NextResponse.json(
      {
        success: true,
        account: { accountId },
        roleName,
        aws: {
          accessKeyId,
          secretAccessKey,
          sessionToken,
          expiration: expirationDate.toISOString(),
        },
        twilioConfigured: Boolean(twilioConfig),
        twilioAccountSidHint: twilioConfig
          ? `${twilioConfig.accountSid.slice(0, 4)}…${twilioConfig.accountSid.slice(-4)}`
          : null,
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message =
      error instanceof Error ? error.message : "Unable to fetch role credentials.";

    console.error("Fetch role credentials error:", { name, message });

    if (name === "UnauthorizedException" || name === "ExpiredTokenException") {
      return NextResponse.json(
        {
          success: false,
          message: "AWS SSO access token is invalid or expired. Please sign in again.",
        },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }

    if (name === "ForbiddenException") {
      return NextResponse.json(
        {
          success: false,
          message: "You are not authorized to use the selected AWS account and role.",
        },
        { status: 403, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { success: false, message },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

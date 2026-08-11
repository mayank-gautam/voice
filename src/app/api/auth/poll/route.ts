import {
  AuthorizationPendingException,
  CreateTokenCommand,
  ExpiredTokenException,
  SlowDownException,
  SSOOIDCClient,
} from "@aws-sdk/client-sso-oidc";

import { NextRequest, NextResponse } from "next/server";

type PollRequestBody = {
  clientId?: string;
  clientSecret?: string;
  deviceCode?: string;
  region?: string;
};

function getAwsErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as { name?: string; Error?: { Code?: string }; code?: string };
  return record.name || record.Error?.Code || record.code;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PollRequestBody;

    if (!body.clientId || !body.clientSecret || !body.deviceCode) {
      return NextResponse.json(
        {
          status: "error",
          error: "Device authorization information is missing.",
        },
        { status: 400 },
      );
    }

    const client = new SSOOIDCClient({
      region: body.region || "us-east-1",
    });

    const response = await client.send(
      new CreateTokenCommand({
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        deviceCode: body.deviceCode,
        grantType: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    );

    if (!response.accessToken) {
      throw new Error("AWS SSO access token was not received.");
    }

    return NextResponse.json({
      status: "authenticated",
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresIn: response.expiresIn,
      region: body.region || "us-east-1",
    });
  } catch (error) {
    if (error instanceof AuthorizationPendingException) {
      return NextResponse.json({ status: "pending" });
    }

    if (error instanceof SlowDownException) {
      return NextResponse.json({ status: "slow_down" });
    }

    if (error instanceof ExpiredTokenException) {
      return NextResponse.json(
        {
          status: "expired",
          error:
            "AWS SSO authorization expired before approval. Please sign in again.",
        },
        { status: 400 },
      );
    }

    const code = getAwsErrorCode(error)?.toLowerCase() || "";
    const message =
      error instanceof Error ? error.message.toLowerCase() : "";

    if (
      code.includes("access_denied") ||
      message.includes("access_denied") ||
      message.includes("denied") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    ) {
      return NextResponse.json(
        {
          status: "error",
          error: "AWS SSO authorization was cancelled or denied.",
        },
        { status: 400 },
      );
    }

    console.error("AWS token polling error:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "AWS login failed.",
    });

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "AWS login failed.",
      },
      { status: 400 },
    );
  }
}

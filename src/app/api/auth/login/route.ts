import { NextResponse } from "next/server";

import {
  RegisterClientCommand,
  SSOOIDCClient,
  StartDeviceAuthorizationCommand,
} from "@aws-sdk/client-sso-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const region = process.env.AWS_SSO_REGION?.trim() || "us-east-1";
    const startUrl = process.env.AWS_SSO_START_URL?.trim();

    if (!startUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "AWS_SSO_START_URL is not configured.",
        },
        { status: 500 },
      );
    }

    const client = new SSOOIDCClient({ region });

    const registrationResponse = await client.send(
      new RegisterClientCommand({
        clientName: "voiceai-observability",
        clientType: "public",
        scopes: ["sso:account:access"],
      }),
    );

    const { clientId, clientSecret } = registrationResponse;

    if (!clientId || !clientSecret) {
      throw new Error("AWS OIDC client registration returned incomplete information.");
    }

    const authorizationResponse = await client.send(
      new StartDeviceAuthorizationCommand({
        clientId,
        clientSecret,
        startUrl,
      }),
    );

    const {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete,
      expiresIn,
      interval,
    } = authorizationResponse;

    if (!deviceCode || !userCode) {
      throw new Error("AWS device authorization returned incomplete information.");
    }

    return NextResponse.json({
      success: true,
      clientId,
      clientSecret,
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete,
      expiresIn,
      interval: interval || 5,
      region,
    });
  } catch (error) {
    console.error("Start AWS SSO login error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unable to start AWS SSO login.",
      },
      { status: 500 },
    );
  }
}

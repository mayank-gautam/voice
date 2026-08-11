import { CreateTokenCommand, SSOOIDCClient } from "@aws-sdk/client-sso-oidc";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefreshRequestBody = {
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  region?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RefreshRequestBody;

    if (!body.refreshToken || !body.clientId || !body.clientSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Refresh token and OIDC client details are required.",
        },
        { status: 400 },
      );
    }

    const region = body.region?.trim() || "us-east-1";
    const client = new SSOOIDCClient({ region });

    const response = await client.send(
      new CreateTokenCommand({
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        refreshToken: body.refreshToken,
        grantType: "refresh_token",
      }),
    );

    if (!response.accessToken) {
      throw new Error("AWS SSO access token was not received from refresh.");
    }

    if (!response.expiresIn || response.expiresIn <= 0) {
      throw new Error("AWS SSO token expiration was not returned from refresh.");
    }

    return NextResponse.json({
      success: true,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken || body.refreshToken,
      expiresIn: response.expiresIn,
      region,
    });
  } catch (error) {
    console.error("AWS SSO token refresh error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh AWS SSO access token.",
      },
      { status: 401 },
    );
  }
}

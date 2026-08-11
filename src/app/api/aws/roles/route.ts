import { ListAccountRolesCommand, SSOClient } from "@aws-sdk/client-sso";

import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  accessToken?: string;
  accountId?: string;
  region?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.accessToken || !body.accountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Access token and account ID are required.",
        },
        { status: 400 },
      );
    }

    const client = new SSOClient({
      region: body.region || "us-east-1",
    });

    const roles: Array<{
      accountId: string;
      roleName: string;
    }> = [];

    let nextToken: string | undefined;

    do {
      const response = await client.send(
        new ListAccountRolesCommand({
          accessToken: body.accessToken,
          accountId: body.accountId,
          nextToken,
          maxResults: 100,
        }),
      );

      for (const role of response.roleList ?? []) {
        if (!role.roleName) {
          continue;
        }

        roles.push({
          accountId: role.accountId || body.accountId,
          roleName: role.roleName,
        });
      }

      nextToken = response.nextToken;
    } while (nextToken);

    return NextResponse.json({
      success: true,
      roles,
      total: roles.length,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message =
      error instanceof Error ? error.message : "Unable to fetch AWS roles.";

    console.error("Fetch AWS roles error:", { name, message });

    if (name === "UnauthorizedException" || name === "ExpiredTokenException") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SSO_TOKEN_EXPIRED",
            message:
              "AWS SSO access token is invalid or expired. Please sign in again.",
          },
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "ROLES_FETCH_FAILED", message },
      },
      { status: 500 },
    );
  }
}

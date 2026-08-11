import { ListAccountsCommand, SSOClient } from "@aws-sdk/client-sso";

import { NextRequest, NextResponse } from "next/server";

type RequestBody = {
  accessToken?: string;
  region?: string;
};

const AWS_ALLOWED_ACCOUNT_IDS: string[] =
  process.env.AWS_ALLOWED_ACCOUNT_IDS?.split(",").map((id) => id.trim()).filter(Boolean) ||
  [];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: "AWS SSO access token is required.",
        },
        { status: 400 },
      );
    }

    const client = new SSOClient({
      region: body.region || "us-east-1",
    });

    const accounts: Array<{
      accountId: string;
      accountName: string;
      emailAddress: string | null;
    }> = [];

    let nextToken: string | undefined;

    do {
      const response = await client.send(
        new ListAccountsCommand({
          accessToken: body.accessToken,
          nextToken,
          maxResults: 100,
        }),
      );

      for (const account of response.accountList ?? []) {
        if (!account.accountId) {
          continue;
        }

        // Empty allowlist = all assigned accounts. Non-empty = restrict to listed IDs.
        if (
          AWS_ALLOWED_ACCOUNT_IDS.length > 0 &&
          !AWS_ALLOWED_ACCOUNT_IDS.includes(account.accountId)
        ) {
          continue;
        }

        accounts.push({
          accountId: account.accountId,
          accountName: account.accountName || `AWS Account ${account.accountId}`,
          emailAddress: account.emailAddress || null,
        });
      }

      nextToken = response.nextToken;
    } while (nextToken);

    return NextResponse.json({
      success: true,
      accounts,
      total: accounts.length,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message =
      error instanceof Error ? error.message : "Unable to fetch AWS accounts.";

    console.error("Fetch AWS accounts error:", { name, message });

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
        error: { code: "ACCOUNTS_FETCH_FAILED", message },
      },
      { status: 500 },
    );
  }
}

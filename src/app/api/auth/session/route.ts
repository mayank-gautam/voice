import { NextRequest, NextResponse } from "next/server";

import { createAuthenticatedSession } from "@/lib/session";

type RequestBody = {
  accountId?: string;
  accountName?: string;
  roleName?: string;
  expiration?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.accountId || !body.roleName || !body.expiration) {
      return NextResponse.json(
        {
          success: false,
          message: "Account ID, role name and expiration are required.",
        },
        { status: 400 },
      );
    }

    await createAuthenticatedSession({
      accountId: body.accountId,
      accountName: body.accountName,
      roleName: body.roleName,
      expiration: body.expiration,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create session error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to create session.",
      },
      { status: 500 },
    );
  }
}

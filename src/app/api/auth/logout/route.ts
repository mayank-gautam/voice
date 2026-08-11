import { NextResponse } from "next/server";

import { destroySession } from "@/lib/session";

export async function POST() {
  try {
    await destroySession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Destroy session error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Unable to clear the session.",
      },
      { status: 500 },
    );
  }
}

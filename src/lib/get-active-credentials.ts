"use client";

import {
  areAwsCredentialsExpired,
  clearSelectedCredentials,
  getPreferredCredentials,
  type AwsCredentials,
  type StoredCredentials,
} from "@/lib/credentials-store";

export type ActiveCredentialsResult =
  | {
      ok: true;
      credentials: StoredCredentials;
      aws: AwsCredentials;
    }
  | {
      ok: false;
      reason: "NOT_SELECTED" | "AWS_EXPIRED" | "AWS_INCOMPLETE";
      message: string;
    };

export async function getActiveCredentials(): Promise<ActiveCredentialsResult> {
  const credentials = await getPreferredCredentials();

  if (!credentials) {
    return {
      ok: false,
      reason: "NOT_SELECTED",
      message: "No AWS account is currently selected. Please sign in with AWS SSO.",
    };
  }

  if (areAwsCredentialsExpired(credentials.aws)) {
    await clearSelectedCredentials();

    return {
      ok: false,
      reason: "AWS_EXPIRED",
      message: "AWS temporary credentials have expired.",
    };
  }

  if (
    !credentials.aws.accessKeyId?.trim() ||
    !credentials.aws.secretAccessKey?.trim() ||
    !credentials.aws.sessionToken?.trim()
  ) {
    await clearSelectedCredentials();

    return {
      ok: false,
      reason: "AWS_INCOMPLETE",
      message: "AWS temporary credentials are incomplete.",
    };
  }

  return {
    ok: true,
    credentials,
    aws: credentials.aws,
  };
}

export function buildAwsCredentialHeaders(
  aws: AwsCredentials,
  accountId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "x-aws-access-key-id": aws.accessKeyId,
    "x-aws-secret-access-key": aws.secretAccessKey,
    "x-aws-session-token": aws.sessionToken,
  };

  if (accountId?.trim()) {
    headers["x-selected-aws-account-id"] = accountId.trim();
  }

  return headers;
}

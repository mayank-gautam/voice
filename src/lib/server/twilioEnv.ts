import "server-only";

import { resolveTwilioRegionEdge } from "@/lib/twilioRegions";
import {
  getTwilioConfigFromHierarchy,
  requireTwilioConfigFromHierarchy,
} from "@/lib/server/accountHierarchy";

export type TwilioEnvConfig = {
  accountSid: string;
  authToken: string;
  region: string;
  edge: string;
  phoneNumber?: string;
};

/**
 * Env keys are field-first, then 12-digit AWS account ID:
 *   TWILIO_ACCOUNT_SID_4728472847874=ACxxxx
 *   TWILIO_AUTH_TOKEN_4728472847874=xxxx
 *
 * Prefer account-hierarchy.json (account → project → twilio) when a projectId
 * is provided. Env remains a fallback for account-only lookups.
 */
function envKey(field: string, accountId: string): string {
  return `TWILIO_${field}_${accountId.trim()}`;
}

function readEnv(field: string, accountId: string): string | undefined {
  const value = process.env[envKey(field, accountId)]?.trim();
  return value || undefined;
}

/**
 * Resolve Twilio credentials from env keyed by 12-digit AWS account number.
 * Prefer {@link getTwilioConfigForProject} when a project is known.
 */
export function getTwilioConfigForAwsAccount(accountId: string): TwilioEnvConfig | null {
  const normalizedAccountId = accountId?.trim();

  if (!normalizedAccountId || !/^\d{12}$/.test(normalizedAccountId)) {
    return null;
  }

  const accountSid = readEnv("ACCOUNT_SID", normalizedAccountId);
  const authToken = readEnv("AUTH_TOKEN", normalizedAccountId);

  if (!accountSid || !authToken) {
    return null;
  }

  if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) {
    throw new Error(
      `${envKey("ACCOUNT_SID", normalizedAccountId)} has an invalid format.`,
    );
  }

  const { region, edge } = resolveTwilioRegionEdge(
    readEnv("REGION", normalizedAccountId),
    readEnv("EDGE", normalizedAccountId),
  );

  return {
    accountSid,
    authToken,
    region,
    edge,
    phoneNumber: readEnv("PHONE_NUMBER", normalizedAccountId),
  };
}

export function requireTwilioConfigForAwsAccount(accountId: string): TwilioEnvConfig {
  const config = getTwilioConfigForAwsAccount(accountId);

  if (!config) {
    throw new Error(
      `Twilio is not configured for AWS account ${accountId}. Add credentials to account-hierarchy.json or set ${envKey("ACCOUNT_SID", accountId)} / ${envKey("AUTH_TOKEN", accountId)}.`,
    );
  }

  return config;
}

/**
 * Preferred resolver: account-hierarchy project Twilio, then env by AWS account.
 */
export async function getTwilioConfigForProject(
  accountId: string,
  projectId: string,
): Promise<TwilioEnvConfig | null> {
  const fromHierarchy = await getTwilioConfigFromHierarchy(accountId, projectId);
  if (fromHierarchy) return fromHierarchy;
  return getTwilioConfigForAwsAccount(accountId);
}

export async function requireTwilioConfigForProject(
  accountId: string,
  projectId: string,
): Promise<TwilioEnvConfig> {
  const config = await getTwilioConfigForProject(accountId, projectId);
  if (config) return config;
  try {
    return await requireTwilioConfigFromHierarchy(accountId, projectId);
  } catch {
    return requireTwilioConfigForAwsAccount(accountId);
  }
}

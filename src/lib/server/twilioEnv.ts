import "server-only";

import { resolveTwilioRegionEdge } from "@/lib/twilioRegions";

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
 *   TWILIO_REGION_4728472847874=us1          (optional)
 *   TWILIO_EDGE_4728472847874=ashburn        (optional)
 *   TWILIO_PHONE_NUMBER_4728472847874=+1...  (optional)
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
      `Twilio is not configured for AWS account ${accountId}. Add ${envKey("ACCOUNT_SID", accountId)} and ${envKey("AUTH_TOKEN", accountId)} to your environment.`,
    );
  }

  return config;
}

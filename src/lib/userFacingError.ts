import { toast } from "sonner";

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

function asMessage(input: unknown): string {
  if (typeof input === "string") return input.trim();
  if (input instanceof Error) return input.message.trim();
  if (input && typeof input === "object" && "message" in input) {
    const value = (input as { message?: unknown }).message;
    if (typeof value === "string") return value.trim();
  }
  return "";
}

/**
 * Maps technical API / AWS / Twilio / HTTP errors to short, plain language
 * suitable for toasts and on-screen alerts. Safe to call on already-friendly copy.
 */
export function toUserFacingMessage(
  input: unknown,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const message = asMessage(input);
  if (!message) return fallback;

  const lower = message.toLowerCase();

  /* ---- Already clear product copy (pass through) ---- */
  if (
    /^(no project selected|select a |enter a |configure |give the |numbers? must|to' and 'from|trace not found)/i.test(
      message,
    ) &&
    !/twilio|cloudwatch|status\s*\d{3}|\/api\//i.test(message)
  ) {
    // still soften a few known technical phrases below
  }

  /* ---- Auth / SSO / session ---- */
  if (
    /no projects found in twilio-mappings|no projects are mapped/i.test(message)
  ) {
    return "No projects are available for this account and role. Try another role or contact your admin.";
  }

  if (/twilio-mappings/i.test(message)) {
    if (/select a project|must be selected/i.test(message)) {
      return "Select a project for this account and role to continue.";
    }
    return "Unable to load projects for this account and role. Try again or contact your admin.";
  }

  if (
    lower.includes("session has expired") ||
    lower.includes("session is unavailable") ||
    lower.includes("approve sign-in again") ||
    (/expired/.test(lower) &&
      /(sso|login|session|token|credential)/.test(lower))
  ) {
    return "Your sign-in session has expired. Please sign in again.";
  }

  if (
    /access token is unavailable|token was not received|token expiration was not returned|token is invalid|auth_required|unauthorized|401\b/i.test(
      message,
    )
  ) {
    return "Your sign-in session is no longer valid. Please sign in again.";
  }

  if (/no aws accounts|no accounts are assigned|no accounts available/i.test(message)) {
    return "No accounts are available for your sign-in. Sign out and try again, or contact your admin.";
  }

  if (
    /no iam identity center roles|no .*roles are assigned|no roles (are )?available|no roles in this account/i.test(
      message,
    )
  ) {
    return "No roles are available for this account. Try another account or contact your admin.";
  }

  if (/unable to fetch aws roles|unable to load roles|roles api/i.test(message)) {
    return "Unable to load roles for this account. Please try again.";
  }

  if (
    /unable to fetch aws accounts|unable to load.*accounts|accounts api/i.test(
      message,
    )
  ) {
    return "Unable to load your accounts. Please try again.";
  }

  if (/unable to load mapped projects|unable to load projects/i.test(message)) {
    return "Unable to load projects for this account and role. Please try again.";
  }

  if (
    /device authorization|unable to start|login api|polling api|login failed or expired|unable to complete aws|unable to check aws|unable to restore|unable to retry/i.test(
      message,
    )
  ) {
    return "Sign-in could not be completed. Please try again.";
  }

  if (/mapped project must be selected|select a project mapped/i.test(message)) {
    return "Select a project for this account and role to continue.";
  }

  if (
    /credential|accesskey|secret|missing fields|role credentials|unable to generate|unable to authorize|could not be verified|temporary aws/i.test(
      message,
    )
  ) {
    return "Unable to prepare access for the selected role. Please try again.";
  }

  if (
    /\b(AWS SSO|IAM Identity Center)\b/i.test(message) &&
    /unable|failed|error|invalid|incomplete/i.test(message)
  ) {
    return "Something went wrong during sign-in. Please try again.";
  }

  /* ---- Project / account context ---- */
  if (
    /no project selected for this aws account|no project configured for the selected aws|no active project/i.test(
      message,
    )
  ) {
    return "Select a project to continue.";
  }

  if (/unable to switch project|failed to load projects/i.test(message)) {
    return "Unable to switch or load projects. Please try again.";
  }

  if (/unable to verify access|failed to .*access/i.test(message)) {
    return "We couldn't verify your access. Please try again.";
  }

  /* ---- Calls / overview / Twilio telephony ---- */
  if (/failed to load calls|failed to fetch twilio calls|failed to build twilio overview|failed to load overview/i.test(message)) {
    return "Unable to load calls. Please try again.";
  }

  if (/failed to load call from twilio|failed to fetch.*call\b/i.test(message)) {
    return "Unable to load this call. Please try again.";
  }

  if (/failed to load telephony|failed to fetch telephony/i.test(message)) {
    return "Unable to load call quality details. Please try again.";
  }

  if (/failed to load call recording|failed to fetch recording|recording media/i.test(message)) {
    return "Unable to load the call recording. Please try again.";
  }

  if (
    /failed to create (twilio )?call|failed to create call/i.test(message)
  ) {
    return "Unable to start the call. Please check your numbers and try again.";
  }

  if (
    /failed to list (twilio )?phone numbers|failed to list numbers/i.test(message)
  ) {
    return "Unable to load phone numbers. Please try again.";
  }

  if (/twilio page cap|latest 1,?000 calls/i.test(message)) {
    return "Showing the latest 1,000 calls in this date range.";
  }

  if (/e\.164/i.test(message)) {
    return "Enter a phone number with country code, for example +14155550142.";
  }

  if (/twiml/i.test(message)) {
    return "Enter a valid call script, or use a webhook URL instead.";
  }

  if (/webhook url/i.test(message) && /http/i.test(message)) {
    return "Enter a valid web address starting with http:// or https://.";
  }

  /* ---- Logs / CloudWatch ---- */
  if (
    /failed to (load|fetch|download).*logs|cloudwatch logs|failed to load more logs|failed to load all logs/i.test(
      message,
    )
  ) {
    if (/download/i.test(message)) {
      return "Unable to download logs. Please try again.";
    }
    if (/more|all/i.test(message)) {
      return "Unable to load more logs. Please try again.";
    }
    return "Unable to load logs. Please try again.";
  }

  if (/log group|log stream|cloudwatch/i.test(message)) {
    return "Logs aren't available for this project right now. Check project settings or try again.";
  }

  /* ---- Env / tags / hierarchy ---- */
  if (/failed to resolve env tags|account hierarchy|failed to load account hierarchy/i.test(message)) {
    return "Unable to load account settings. Please try again.";
  }

  /* ---- Generic technical leakage ---- */
  if (
    /\b(status\s*\d{3}|HTTP\/?\d|invalid JSON|empty response)\b/i.test(message) ||
    /\/api\/|accountId\s*:|\{\s*"|\[\s*\{/.test(message) ||
    /\b(accessKeyId|secretAccessKey|sessionToken|clientSecret|deviceCode|authToken|sid|AccountSid)\b/i.test(
      message,
    ) ||
    /\b(AccessDenied|UnauthorizedOperation|InvalidClient|expired_token|invalid_grant|ResourceNotFoundException|Throttling)\b/i.test(
      message,
    ) ||
    /\b(ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|networkerror)\b/i.test(message)
  ) {
    return fallback;
  }

  if (
    /failed to|unable to|error:|exception/i.test(message) &&
    /(aws|twilio|api|json|http|sdk|stack|null|undefined)/i.test(message)
  ) {
    return fallback;
  }

  // Remaining copy that still names internals → generic fallback
  if (/\b(CloudWatch|twilio-mappings|account-hierarchy|AccessKey|SessionToken)\b/i.test(message)) {
    return fallback;
  }

  return message;
}

/** Show an error toast with plain-language copy. */
export function toastError(
  input: unknown,
  options?: Parameters<typeof toast.error>[1],
): void {
  toast.error(toUserFacingMessage(input), options);
}

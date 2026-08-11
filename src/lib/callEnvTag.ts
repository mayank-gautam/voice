/** Environment inferred from Twilio Request Inspector webhook URLs. */
export type CallEnvTag = "UAT" | "DEV" | "PROD";

/**
 * Tag from webhook/request URL text.
 * Priority: uat → UAT, then prod → PROD, then dev → DEV
 * (prod before dev so "production" is not misread if both somehow match).
 */
export function inferEnvTagFromText(text?: string | null): CallEnvTag | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase();
  if (s.includes("uat")) return "UAT";
  if (s.includes("prod")) return "PROD";
  if (s.includes("dev")) return "DEV";
  return null;
}

/** First matching tag across multiple URL/text snippets. */
export function inferEnvTagFromTexts(texts: Array<string | null | undefined>): CallEnvTag | null {
  // Prefer UAT / PROD / DEV across the whole set (not just first URL)
  let foundDev: CallEnvTag | null = null;
  let foundProd: CallEnvTag | null = null;
  for (const t of texts) {
    const tag = inferEnvTagFromText(t);
    if (tag === "UAT") return "UAT";
    if (tag === "PROD") foundProd = "PROD";
    if (tag === "DEV") foundDev = "DEV";
  }
  return foundProd || foundDev;
}

/** Collect string URLs from a Twilio Call Event `request` payload. */
export function collectUrlsFromCallEventRequest(request: unknown): string[] {
  if (!request || typeof request !== "object") return [];
  const req = request as Record<string, unknown>;
  const urls: string[] = [];
  if (typeof req.url === "string" && req.url.trim()) urls.push(req.url);

  const params = req.parameters;
  if (params && typeof params === "object") {
    for (const value of Object.values(params as Record<string, unknown>)) {
      if (typeof value !== "string") continue;
      const v = value.trim();
      if (/^https?:\/\//i.test(v)) urls.push(v);
    }
  }
  return urls;
}

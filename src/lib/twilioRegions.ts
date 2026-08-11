export const DEFAULT_TWILIO_REGION = "us1";
export const DEFAULT_TWILIO_EDGE = "ashburn";

/**
 * Default edge for each Twilio processing region.
 * Non-US regions require edge+region (e.g. api.sydney.au1.twilio.com).
 */
export const TWILIO_REGION_DEFAULT_EDGE: Record<string, string> = {
  us1: "ashburn",
  au1: "sydney",
  ie1: "dublin",
  jp1: "tokyo",
  sg1: "singapore",
  br1: "sao-paulo",
  de1: "frankfurt",
};

/** Twilio API regions for the project credentials dropdown. */
export const twilioRegions: { value: string; label: string; edge: string }[] = [
  { value: "us1", label: "US (us1)", edge: "ashburn" },
  { value: "au1", label: "Australia (au1)", edge: "sydney" },
  { value: "ie1", label: "Ireland (ie1)", edge: "dublin" },
  { value: "jp1", label: "Japan (jp1)", edge: "tokyo" },
  { value: "sg1", label: "Singapore (sg1)", edge: "singapore" },
  { value: "br1", label: "Brazil (br1)", edge: "sao-paulo" },
  { value: "de1", label: "Germany (de1)", edge: "frankfurt" },
];

export function resolveTwilioRegionEdge(
  region?: string | null,
  edge?: string | null
): { region: string; edge: string } {
  const r = (region || DEFAULT_TWILIO_REGION).trim() || DEFAULT_TWILIO_REGION;
  const e =
    (edge || "").trim() || TWILIO_REGION_DEFAULT_EDGE[r] || DEFAULT_TWILIO_EDGE;
  return { region: r, edge: e };
}

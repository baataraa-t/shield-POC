import type {
  FraudDecision,
  ShieldDeviceIntelligence,
  ShieldDeviceResult,
} from "./types";

const HIGH_RISK_SCORE = 40;
const MEDIUM_RISK_SCORE = 80;

export function decideFraudAction(
  result: ShieldDeviceResult | null,
): { decision: FraudDecision; reasons: string[] } {
  const intelligence = result?.device_intelligence;
  const reasons: string[] = [];

  if (!intelligence) {
    return {
      decision: "challenge",
      reasons: ["Device intelligence unavailable — manual review recommended"],
    };
  }

  if (intelligence.is_bot) reasons.push("Bot activity detected");
  if (intelligence.is_emulated) reasons.push("Emulated environment detected");
  if (intelligence.is_browser_spoofed) {
    reasons.push("Browser spoofing detected");
  }
  if (intelligence.ai_browser) reasons.push("AI browser detected");

  const score = intelligence.device_score;
  if (typeof score === "number" && score <= HIGH_RISK_SCORE) {
    reasons.push(`High risk device score (${score}/120)`);
  }

  if (reasons.length > 0) {
    return { decision: "block", reasons };
  }

  const challengeReasons = collectChallengeReasons(intelligence, score);
  if (challengeReasons.length > 0) {
    return { decision: "challenge", reasons: challengeReasons };
  }

  return { decision: "allow", reasons: ["No significant risk signals detected"] };
}

function collectChallengeReasons(
  intelligence: ShieldDeviceIntelligence,
  score?: number,
): string[] {
  const reasons: string[] = [];

  if (intelligence.is_proxy) reasons.push("Proxy or VPN detected");
  if (intelligence.is_tor) reasons.push("Tor browser detected");
  if (intelligence.is_incognito) reasons.push("Incognito mode detected");
  if (intelligence.is_anti_fingerprinting) {
    reasons.push("Anti-fingerprinting tools detected");
  }
  if (intelligence.prv_set) reasons.push("Privacy-focused settings enabled");
  if (typeof score === "number" && score <= MEDIUM_RISK_SCORE) {
    reasons.push(`Elevated device score (${score}/120)`);
  }

  return reasons;
}

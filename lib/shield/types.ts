export type FraudDecision = "allow" | "challenge" | "block";

export interface ShieldDeviceIntelligence {
  device_score?: number;
  shield_id?: string;
  shield_id_confidence_score?: number;
  is_anti_fingerprinting?: boolean;
  is_bot?: boolean;
  is_browser_spoofed?: boolean;
  is_emulated?: boolean;
  is_incognito?: boolean;
  is_proxy?: boolean;
  is_tor?: boolean;
  prv_set?: boolean;
  ai_browser?: boolean;
  [key: string]: unknown;
}

export interface ShieldDeviceResult {
  session_id?: string;
  platform?: string;
  timestamp?: number;
  version?: string;
  device_intelligence?: ShieldDeviceIntelligence;
  device_used_by_more_than_3_users?: boolean;
  user_id?: string;
  [key: string]: unknown;
}

export interface ShieldClientResponse {
  result?: ShieldDeviceResult;
  [key: string]: unknown;
}

export interface ShieldApiResponse {
  code?: string;
  message?: string;
  status?: boolean;
  result?: ShieldDeviceResult;
}

export interface VerifyResult {
  decision: FraudDecision;
  reasons: string[];
  sessionId: string;
  deviceIntelligence: ShieldDeviceIntelligence | null;
  raw: ShieldDeviceResult | null;
}

export type ShieldEvent = "login" | "signup";

export interface WebhookDelivery {
  id: string;
  receivedAt: string;
  sessionId: string | null;
  payload: ShieldDeviceResult;
}

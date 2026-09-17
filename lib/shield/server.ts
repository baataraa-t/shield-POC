import { generateShieldSignature } from "./signature";
import type { ShieldApiResponse, ShieldDeviceResult } from "./types";
import { getLatestWebhookResult } from "./webhook-store";

interface ShieldConfig {
  siteId: string;
  secretKey: string;
  apiEndpoint: string;
  endpointVersion: number;
}

let cachedEndpoint: { url: string; version: number } | null = null;

/** Merchant endpoint from SHIELD Get Endpoint docs. Discovery currently 401s for this site. */
const DEFAULT_API_ENDPOINT = "https://ap-device-pro.csftr.com";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getConfig(): ShieldConfig {
  const siteId = env("SHIELD_SITE_ID");
  const secretKey = env("SHIELD_SECRET_KEY");
  const apiEndpoint = env("SHIELD_API_ENDPOINT") || DEFAULT_API_ENDPOINT;

  if (!siteId || !secretKey) {
    throw new Error("SHIELD_SITE_ID and SHIELD_SECRET_KEY must be set");
  }

  return {
    siteId,
    secretKey,
    apiEndpoint,
    endpointVersion: Number(env("SHIELD_ENDPOINT_VERSION") || "0"),
  };
}

/* v8 ignore start -- unreachable: getConfig() always defaults apiEndpoint,
 * so resolveEndpoint() below returns before ever calling discoverEndpoint().
 * Kept for when SHIELD service discovery is re-enabled for this site. */
function discoveryUrl(siteId: string, staging: boolean): string {
  const host = staging
    ? "svc-discovery-staging.shield.com"
    : "service-discovery.shield.com";
  return `https://${host}/discovery/v1/endpoint?sid=${encodeURIComponent(siteId)}`;
}

async function parseJsonBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function discoveryErrorMessage(
  status: number,
  body: Record<string, unknown>,
  staging: boolean,
): string {
  const detail =
    (typeof body.message === "string" && body.message) ||
    (typeof body.code === "string" && body.code) ||
    "";
  const envLabel = staging ? "staging" : "production";
  const hint =
    /site-id/i.test(detail)
      ? " Recheck SHIELD_SITE_ID and SHIELD_SECRET_KEY from the dashboard sidebar. If this is a staging site, set SHIELD_ENV=staging. You can also set SHIELD_API_ENDPOINT to skip discovery."
      : "";

  return `SHIELD service discovery failed (${status}${detail ? `: ${detail}` : ""})${hint} [${envLabel}]`;
}

async function requestEndpoint(
  siteId: string,
  secretKey: string,
  staging: boolean,
): Promise<{ url: string; version: number } | { status: number; body: Record<string, unknown> }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateShieldSignature(timestamp, siteId, secretKey);

  const response = await fetch(discoveryUrl(siteId, staging), {
    headers: {
      "Site-Id": siteId,
      Timestamp: String(timestamp),
      "Shield-Signature": signature,
      "X-Endpoint-Version": "0",
    },
    cache: "no-store",
  });

  const body = await parseJsonBody(response);
  if (!response.ok) {
    return { status: response.status, body };
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    throw new Error("SHIELD service discovery returned no endpoint");
  }

  return {
    url: endpoint.replace(/\/$/, ""),
    version: typeof body.version === "number" ? body.version : 0,
  };
}

async function discoverEndpoint(
  siteId: string,
  secretKey: string,
): Promise<{ url: string; version: number }> {
  const preferStaging = env("SHIELD_ENV") === "staging";
  const first = await requestEndpoint(siteId, secretKey, preferStaging);

  if ("url" in first) return first;

  // If the configured environment rejects the site, try the other one once.
  const second = await requestEndpoint(siteId, secretKey, !preferStaging);
  if ("url" in second) return second;

  throw new Error(discoveryErrorMessage(first.status, first.body, preferStaging));
}
/* v8 ignore stop */

async function resolveEndpoint(config: ShieldConfig): Promise<{
  url: string;
  version: number;
}> {
  if (config.apiEndpoint) {
    return {
      url: config.apiEndpoint.replace(/\/$/, ""),
      version: config.endpointVersion,
    };
  }

  /* v8 ignore start -- unreachable, see discoverEndpoint above */
  if (cachedEndpoint) return cachedEndpoint;

  cachedEndpoint = await discoverEndpoint(config.siteId, config.secretKey);
  return cachedEndpoint;
  /* v8 ignore stop */
}

export async function fetchDeviceIntelligence(
  sessionId: string,
): Promise<ShieldDeviceResult> {
  const config = getConfig();
  const { url, version } = await resolveEndpoint(config);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateShieldSignature(
    timestamp,
    config.siteId,
    config.secretKey,
  );

  const apiUrl = `${url}/shield-fp/v1/api/intelligence/${encodeURIComponent(sessionId)}?platform=WEB`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Site-Id": config.siteId,
      Timestamp: String(timestamp),
      "Shield-Signature": signature,
      "X-Endpoint-Version": String(version),
    },
    cache: "no-store",
  });

  if (response.status === 301) {
    cachedEndpoint = null;
    const body = (await response.json()) as { endpoint?: string; version?: number };
    if (body.endpoint) {
      cachedEndpoint = {
        url: body.endpoint.replace(/\/$/, ""),
        version: body.version ?? version,
      };
      return fetchDeviceIntelligence(sessionId);
    }
  }

  const payload = (await response.json()) as ShieldApiResponse;

  if (!response.ok) {
    throw new Error(
      payload.message ?? `SHIELD API error (${response.status})`,
    );
  }

  if (payload.result) {
    return payload.result;
  }

  if (payload.status === false) {
    throw new Error(
      payload.message ?? `SHIELD returned an unsuccessful response (${payload.code ?? "unknown"})`,
    );
  }

  return payload as unknown as ShieldDeviceResult;
}

export function isPullMethodDisabled(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /pull method is not allowed|4005/i.test(message);
}

export type IntelligenceSource = "pull" | "webhook" | "client";

export async function resolveDeviceIntelligence(
  sessionId: string,
  clientResult?: ShieldDeviceResult | null,
): Promise<{ result: ShieldDeviceResult; source: IntelligenceSource }> {
  const webhookResult = await getLatestWebhookResult(sessionId);
  if (webhookResult) {
    return { result: webhookResult, source: "webhook" };
  }

  try {
    const result = await fetchDeviceIntelligence(sessionId);
    return { result, source: "pull" };
  } catch (error) {
    if (clientResult && isPullMethodDisabled(error)) {
      return { result: clientResult, source: "client" };
    }
    throw error;
  }
}

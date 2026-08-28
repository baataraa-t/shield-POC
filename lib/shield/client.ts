"use client";

import { Shield } from "shield-js-npm";
import type { ShieldClientResponse } from "./types";

let shieldInstance: Shield | null = null;
let initPromise: Promise<Shield> | null = null;

export function formatShieldError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Failed to initialize SHIELD SDK";
}

function getSiteId(): string {
  const siteId = process.env.NEXT_PUBLIC_SHIELD_SITE_ID?.trim();
  if (!siteId) {
    throw new Error("NEXT_PUBLIC_SHIELD_SITE_ID is not configured");
  }
  return siteId;
}

function waitForGlobalSldWsdk(timeoutMs = 15_000): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SHIELD SDK can only run in the browser"));
  }

  if ("sldwsdk" in window) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      if ("sldwsdk" in window) {
        resolve();
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        reject(
          new Error(
            "SHIELD wsdk.js did not load. Check network access and domain whitelist for localhost.",
          ),
        );
        return;
      }

      window.setTimeout(check, 100);
    };

    check();
  });
}

function resetShieldState() {
  shieldInstance = null;
  initPromise = null;
}

async function ensureShield(): Promise<Shield> {
  if (typeof window === "undefined") {
    throw new Error("SHIELD SDK can only run in the browser");
  }

  if (initPromise) {
    return initPromise;
  }

  const siteId = getSiteId();

  initPromise = (async () => {
    await waitForGlobalSldWsdk();

    const shield = new Shield();
    await shield.init({ siteId });
    shieldInstance = shield;
    return shield;
  })().catch((error) => {
    resetShieldState();
    throw error;
  });

  return initPromise;
}

export async function getDeviceIntelligence(userId?: string) {
  const shield = await ensureShield();
  const props = userId
    ? { userAttrData: { user_id: userId } }
    : undefined;

  try {
    return (await shield.getDeviceIntelligence(
      props,
    )) as ShieldClientResponse;
  } catch (error) {
    resetShieldState();
    throw new Error(formatShieldError(error));
  }
}

export async function getSessionId(userId?: string): Promise<string> {
  const response = await getDeviceIntelligence(userId);
  const sessionId = response.result?.session_id;

  if (!sessionId) {
    throw new Error("SHIELD did not return a session ID");
  }

  return sessionId;
}

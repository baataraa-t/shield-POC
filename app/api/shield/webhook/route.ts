import { NextResponse } from "next/server";
import { verifyShieldSignature } from "@/lib/shield/signature";
import {
  listWebhookDeliveries,
  normalizeWebhookPayload,
  storeWebhookDelivery,
} from "@/lib/shield/webhook-store";

export const dynamic = "force-dynamic";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getCredentials() {
  const siteId = env("SHIELD_SITE_ID");
  const secretKey = env("SHIELD_SECRET_KEY");
  if (!siteId || !secretKey) {
    throw new Error("SHIELD_SITE_ID and SHIELD_SECRET_KEY must be set");
  }
  return { siteId, secretKey };
}

/** SHIELD pushes device intelligence here. Give this public HTTPS URL to the SHIELD team. */
export async function POST(request: Request) {
  try {
    const { siteId, secretKey } = getCredentials();
    const signature = request.headers.get("Shield-Signature") ?? "";
    const timestamp = request.headers.get("Timestamp") ?? "";

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Shield-Signature and Timestamp headers are required" },
        { status: 400 },
      );
    }

    if (!verifyShieldSignature(signature, timestamp, siteId, secretKey)) {
      return NextResponse.json(
        { error: "Invalid or expired SHIELD signature" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const payload = normalizeWebhookPayload(body);
    const delivery = await storeWebhookDelivery(payload);

    return NextResponse.json({
      received: true,
      id: delivery.id,
      sessionId: delivery.sessionId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handling failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POC inspector: list recent webhook deliveries. */
export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
    const deliveries = await listWebhookDeliveries(sessionId || undefined);

    return NextResponse.json({
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list webhooks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
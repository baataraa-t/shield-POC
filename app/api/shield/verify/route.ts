import { NextResponse } from "next/server";
import { decideFraudAction } from "@/lib/shield/decide";
import { resolveDeviceIntelligence } from "@/lib/shield/server";
import type { ShieldDeviceResult, ShieldEvent } from "@/lib/shield/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      event?: ShieldEvent;
      clientResult?: ShieldDeviceResult;
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const { result, source } = await resolveDeviceIntelligence(
      body.sessionId,
      body.clientResult,
    );
    const { decision, reasons } = decideFraudAction(result);
    if (source === "webhook") {
      reasons.push("Used SHIELD webhook payload");
    } else if (source === "client") {
      reasons.push(
        "SHIELD pull API is disabled (webhook-only); used client SDK payload",
      );
    }

    return NextResponse.json({
      decision,
      reasons,
      sessionId: body.sessionId,
      event: body.event ?? "login",
      source,
      deviceIntelligence: result.device_intelligence ?? null,
      raw: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

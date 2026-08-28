import { NextResponse } from "next/server";
import { createUser } from "@/lib/auth-store";
import { decideFraudAction } from "@/lib/shield/decide";
import { resolveDeviceIntelligence } from "@/lib/shield/server";
import type { ShieldDeviceResult } from "@/lib/shield/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      sessionId?: string;
      clientResult?: ShieldDeviceResult;
    };

    if (!body.email || !body.password || !body.sessionId) {
      return NextResponse.json(
        { error: "email, password, and sessionId are required" },
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

    if (decision === "block") {
      return NextResponse.json(
        {
          error: "Signup blocked due to device risk",
          decision,
          reasons,
          event: "signup",
          email: body.email,
        },
        { status: 403 },
      );
    }

    await createUser(body.email, body.password);

    return NextResponse.json({
      decision,
      reasons,
      event: "signup",
      email: body.email,
      challenged: decision === "challenge",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signup failed";

    if (message === "User already exists") {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

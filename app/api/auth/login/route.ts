import { NextResponse } from "next/server";
import { findUser } from "@/lib/auth-store";
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
          error: "Login blocked due to device risk",
          decision,
          reasons,
          event: "login",
          email: body.email,
        },
        { status: 403 },
      );
    }

    const user = await findUser(body.email, body.password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      decision,
      reasons,
      event: "login",
      email: user.email,
      challenged: decision === "challenge",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

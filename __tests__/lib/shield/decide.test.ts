import { describe, expect, it } from "vitest";
import { decideFraudAction } from "@/lib/shield/decide";
import type { ShieldDeviceResult } from "@/lib/shield/types";

function withIntelligence(
  intelligence: NonNullable<ShieldDeviceResult["device_intelligence"]>,
): ShieldDeviceResult {
  return { device_intelligence: intelligence };
}

describe("decideFraudAction", () => {
  it("allows when no risk signals are present", () => {
    const { decision, reasons } = decideFraudAction(withIntelligence({}));
    expect(decision).toBe("allow");
    expect(reasons).toEqual(["No significant risk signals detected"]);
  });

  it("blocks on bot activity", () => {
    const { decision, reasons } = decideFraudAction(
      withIntelligence({ is_bot: true }),
    );
    expect(decision).toBe("block");
    expect(reasons).toContain("Bot activity detected");
  });

  it("blocks when the device score is at the high-risk threshold", () => {
    const { decision, reasons } = decideFraudAction(
      withIntelligence({ device_score: 40 }),
    );
    expect(decision).toBe("block");
    expect(reasons).toContain("High risk device score (40/120)");
  });

  it("challenges on a proxy/VPN signal", () => {
    const { decision, reasons } = decideFraudAction(
      withIntelligence({ is_proxy: true }),
    );
    expect(decision).toBe("challenge");
    expect(reasons).toContain("Proxy or VPN detected");
  });

  it("challenges when device intelligence is unavailable", () => {
    const { decision, reasons } = decideFraudAction(null);
    expect(decision).toBe("challenge");
    expect(reasons).toEqual([
      "Device intelligence unavailable — manual review recommended",
    ]);
  });
});

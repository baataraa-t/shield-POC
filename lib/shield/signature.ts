import { createHmac, timingSafeEqual } from "crypto";

/** Matches SHIELD's Java sample: HMAC-SHA256(key, message) as lowercase hex. */
function hmacSha256Hex(message: string, key: string): string {
  return createHmac("sha256", Buffer.from(key, "utf8"))
    .update(Buffer.from(message, "utf8"))
    .digest("hex");
}

/** SHIELD API signature: HMAC(timestamp, secret) then HMAC(siteId, timeHash). */
export function generateShieldSignature(
  timestamp: number,
  siteId: string,
  secretKey: string,
): string {
  const timeHash = hmacSha256Hex(String(timestamp), secretKey);
  return hmacSha256Hex(siteId, timeHash);
}

const SIGNATURE_MAX_AGE_SECONDS = 300;

/** Verify Shield-Signature + Timestamp from a SHIELD webhook or API callback. */
export function verifyShieldSignature(
  signature: string,
  timestamp: string,
  siteId: string,
  secretKey: string,
): boolean {
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SIGNATURE_MAX_AGE_SECONDS) return false;

  const expected = generateShieldSignature(ts, siteId, secretKey);
  const received = signature.trim().toLowerCase();
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

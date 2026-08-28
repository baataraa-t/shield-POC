import { getSupabase } from "@/lib/supabase";
import type { ShieldDeviceResult, WebhookDelivery } from "./types";

const LIST_LIMIT = 50;

type WebhookRow = {
  id: string;
  session_id: string | null;
  payload: ShieldDeviceResult;
  received_at: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toDelivery(row: WebhookRow): WebhookDelivery {
  return {
    id: row.id,
    receivedAt: row.received_at,
    sessionId: row.session_id,
    payload: row.payload,
  };
}

export function normalizeWebhookPayload(body: unknown): ShieldDeviceResult {
  const record = asRecord(body);
  if (!record) return {};

  const nested = asRecord(record.result);
  if (nested && (nested.session_id || nested.device_intelligence)) {
    return nested as ShieldDeviceResult;
  }

  return record as ShieldDeviceResult;
}

export async function storeWebhookDelivery(
  payload: ShieldDeviceResult,
): Promise<WebhookDelivery> {
  const supabase = getSupabase();
  const sessionId =
    typeof payload.session_id === "string" ? payload.session_id : null;

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .insert({
      session_id: sessionId,
      payload,
    })
    .select("id, session_id, payload, received_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to store webhook delivery");
  }

  return toDelivery(data);
}

export async function listWebhookDeliveries(
  sessionId?: string,
): Promise<WebhookDelivery[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("webhook_deliveries")
    .select("id, session_id, payload, received_at")
    .order("received_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(toDelivery);
}

export async function getLatestWebhookResult(
  sessionId: string,
): Promise<ShieldDeviceResult | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("payload")
    .eq("session_id", sessionId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.payload ?? null;
}

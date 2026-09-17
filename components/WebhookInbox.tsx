"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebhookDelivery } from "@/lib/shield/types";

export function WebhookInbox() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ignoreRef = useRef(false);

  const load = useCallback(async () => {
    if (ignoreRef.current) return;
    try {
      const response = await fetch("/api/shield/webhook", { cache: "no-store" });
      const data = (await response.json()) as {
        deliveries?: WebhookDelivery[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load webhook deliveries");
      }
      if (ignoreRef.current) return;
      setDeliveries(data.deliveries ?? []);
      setError(null);
    } catch (err) {
      if (ignoreRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load webhooks");
    }
  }, []);

  useEffect(() => {
    ignoreRef.current = false;
    if (!ignoreRef.current) {
      void load();
    }
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      ignoreRef.current = true;
      window.clearInterval(timer);
    };
  }, [load]);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            SHIELD webhook
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Give this URL to the SHIELD team:{" "}
            <code className="break-all rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-800">
              /api/shield/webhook
            </code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : null}

      {deliveries.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No webhook payloads yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {deliveries.map((item) => (
            <li
              key={item.id}
              className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
            >
              <p className="font-mono text-xs text-zinc-500">{item.receivedAt}</p>
              <p className="mt-1 break-all font-mono text-xs">
                session: {item.sessionId ?? "—"}
              </p>
              <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5 text-zinc-800">
                {JSON.stringify(item.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
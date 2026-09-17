"use client";

import { useShield } from "@/components/ShieldProvider";
import { WebhookInbox } from "@/components/WebhookInbox";

function SignalRow({
  label,
  value,
  risky,
  testId,
}: {
  label: string;
  value: string | number | boolean | undefined;
  risky?: boolean;
  testId?: string;
}) {
  const display =
    typeof value === "boolean" ? (value ? "Yes" : "No") : (value ?? "—");

  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between border-b border-zinc-100 py-3 last:border-b-0"
    >
      <span className="text-sm text-zinc-600">{label}</span>
      <span
        className={`text-sm font-medium ${risky ? "text-rose-700" : "text-zinc-900"}`}
      >
        {display}
      </span>
    </div>
  );
}

export function InspectorPanel() {
  const { loading, error, sessionId, payload, refresh } = useShield();
  const intelligence = payload?.result?.device_intelligence;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Device Intelligence Inspector
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Live output from{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5">
                shield-js-npm
              </code>{" "}
              via{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5">
                getDeviceIntelligence()
              </code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {!error && loading ? (
          <p className="mt-6 text-sm text-zinc-500">
            Initializing SHIELD and collecting device signals...
          </p>
        ) : null}
      </div>

      <WebhookInbox />

      {!error && !loading && payload ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Session
              </h3>
              <p className="mt-3 break-all font-mono text-sm text-zinc-900">
                {sessionId ?? "No session ID"}
              </p>
              <div className="mt-4 space-y-2 text-sm text-zinc-600">
                <p>Platform: {payload.result?.platform ?? "—"}</p>
                <p>Version: {payload.result?.version ?? "—"}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Risk Snapshot
              </h3>
              <div className="mt-4">
                <SignalRow
                  label="Device score"
                  value={intelligence?.device_score}
                />
                <SignalRow label="Shield ID" value={intelligence?.shield_id} />
                <SignalRow
                  label="Confidence score"
                  value={intelligence?.shield_id_confidence_score}
                />
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Detection Flags
            </h3>
            <div className="mt-4 grid gap-0 md:grid-cols-2">
              <SignalRow
                testId="signal-is-bot"
                label="Bot"
                value={intelligence?.is_bot}
                risky={Boolean(intelligence?.is_bot)}
              />
              <SignalRow
                testId="signal-is-emulated"
                label="Emulator"
                value={intelligence?.is_emulated}
                risky={Boolean(intelligence?.is_emulated)}
              />
              <SignalRow
                testId="signal-is-browser-spoofed"
                label="Browser spoofed"
                value={intelligence?.is_browser_spoofed}
                risky={Boolean(intelligence?.is_browser_spoofed)}
              />
              <SignalRow
                testId="signal-is-proxy"
                label="Proxy / VPN"
                value={intelligence?.is_proxy}
                risky={Boolean(intelligence?.is_proxy)}
              />
              <SignalRow
                testId="signal-is-tor"
                label="Tor"
                value={intelligence?.is_tor}
                risky={Boolean(intelligence?.is_tor)}
              />
              <SignalRow
                testId="signal-is-incognito"
                label="Incognito"
                value={intelligence?.is_incognito}
                risky={Boolean(intelligence?.is_incognito)}
              />
              <SignalRow
                testId="signal-is-anti-fingerprinting"
                label="Anti-fingerprinting"
                value={intelligence?.is_anti_fingerprinting}
                risky={Boolean(intelligence?.is_anti_fingerprinting)}
              />
              <SignalRow
                testId="signal-prv-set"
                label="Privacy settings"
                value={intelligence?.prv_set}
                risky={Boolean(intelligence?.prv_set)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Raw JSON
            </h3>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}

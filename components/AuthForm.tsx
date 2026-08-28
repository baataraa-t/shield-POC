"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useShield } from "@/components/ShieldProvider";
import { getDeviceIntelligence } from "@/lib/shield/client";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { ready, error: shieldError } = useShield();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = await getDeviceIntelligence(email.trim().toLowerCase());
      const sessionId = payload.result?.session_id;
      if (!sessionId) {
        throw new Error("SHIELD did not return a session ID");
      }

      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          sessionId,
          clientResult: payload.result,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        decision?: string;
        reasons?: string[];
        email?: string;
        event?: string;
      };

      if (!response.ok && response.status !== 403) {
        throw new Error(data.error ?? "Request failed");
      }

      const params = new URLSearchParams({
        decision: data.decision ?? (response.ok ? "allow" : "block"),
        event: data.event ?? mode,
        email: data.email ?? email,
        reasons: JSON.stringify(
          data.reasons ?? (data.error ? [data.error] : []),
        ),
      });

      router.push(`/result?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <h2 className="text-2xl font-semibold capitalize text-zinc-900">{mode}</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Submits your SHIELD session ID to the server for fraud validation before{" "}
        {mode === "login" ? "signing in" : "creating an account"}.
      </p>

      {!ready && !shieldError ? (
        <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-600">
          Waiting for SHIELD SDK...
        </p>
      ) : null}

      {shieldError ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {shieldError}
        </p>
      ) : null}

      <label className="mt-6 block text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none ring-blue-600 focus:ring-2"
        />
      </label>

      <label className="mt-4 block text-sm font-medium text-zinc-700">
        Password
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none ring-blue-600 focus:ring-2"
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !ready || Boolean(shieldError)}
        className="mt-6 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? "Checking device..." : `Continue to ${mode}`}
      </button>
    </form>
  );
}

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { DecisionBadge } from "@/components/DecisionBadge";
import type { FraudDecision } from "@/lib/shield/types";

interface ResultPageProps {
  searchParams: Promise<{
    decision?: string;
    event?: string;
    email?: string;
    reasons?: string;
  }>;
}

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  const decision = (params.decision ?? "allow") as FraudDecision;
  const event = params.event ?? "login";
  const email = params.email ?? "";
  let reasons: string[] = [];

  try {
    reasons = params.reasons ? JSON.parse(params.reasons) : [];
  } catch {
    reasons = params.reasons ? [params.reasons] : [];
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <DecisionBadge decision={decision} />
            <span className="text-sm uppercase tracking-wide text-zinc-500">
              {event}
            </span>
          </div>

          <h2
            data-testid="result-heading"
            className="mt-6 text-2xl font-semibold text-zinc-900"
          >
            {decision === "allow" && "Access granted"}
            {decision === "challenge" && "Step-up verification required"}
            {decision === "block" && "Access denied"}
          </h2>

          {email ? (
            <p className="mt-2 text-sm text-zinc-600">
              Account: <span className="font-medium text-zinc-900">{email}</span>
            </p>
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Decision reasons
            </h3>
            <ul data-testid="result-reasons" className="mt-3 space-y-2">
              {reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {decision === "challenge" ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              In production you would trigger MFA, email OTP, or manual review
              here. This POC still completes the {event} flow after flagging the
              session.
            </p>
          ) : null}

          <div className="mt-8 flex gap-3">
            <Link
              href="/"
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to inspector
            </Link>
            <Link
              href={event === "signup" ? "/login" : "/signup"}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Try another flow
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

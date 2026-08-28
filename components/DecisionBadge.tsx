import type { FraudDecision } from "@/lib/shield/types";

const styles: Record<FraudDecision, string> = {
  allow: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  challenge: "bg-amber-100 text-amber-900 ring-amber-200",
  block: "bg-rose-100 text-rose-800 ring-rose-200",
};

export function DecisionBadge({ decision }: { decision: FraudDecision }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide ring-1 ring-inset ${styles[decision]}`}
    >
      {decision}
    </span>
  );
}

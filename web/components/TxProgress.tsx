"use client";

import { txUrl } from "@/lib/contract";
import { PHASE_STEPS, type Phase } from "@/lib/useCourt";

const ORDER: Phase[] = ["wallet", "signing", "pending", "accepted", "finalized"];

export function TxProgress({
  phase,
  hash,
  error,
}: {
  phase: Phase;
  hash: string | null;
  error: string | null;
}) {
  if (phase === "idle") return null;

  if (phase === "error") {
    return (
      <div
        className="mono mt-5 border-l-2 px-4 py-3 text-xs leading-relaxed"
        style={{ borderColor: "var(--color-rot)", background: "#b33a1a0f" }}
      >
        <span className="label" style={{ color: "var(--color-rot)" }}>
          refused
        </span>
        <p className="mt-1.5 text-ink-soft">{error}</p>
      </div>
    );
  }

  const current = ORDER.indexOf(phase);

  return (
    <div className="mt-5 border-t border-rule pt-4">
      <ol className="grid gap-2.5">
        {PHASE_STEPS.map((step) => {
          const index = ORDER.indexOf(step.key);
          const done = current > index;
          const active = current === index;
          return (
            <li key={step.key} className="flex items-baseline gap-3">
              <span
                className="mono inline-block h-2 w-2 shrink-0 translate-y-[1px] border"
                style={{
                  borderColor: done || active ? "var(--color-ink)" : "var(--color-rule-strong)",
                  background: done
                    ? "var(--color-ink)"
                    : active
                      ? "var(--color-alive)"
                      : "transparent",
                }}
              />
              <span
                className="mono text-[0.7rem] tracking-[0.1em] uppercase"
                style={{ color: done || active ? "var(--color-ink)" : "var(--color-ink-faint)" }}
              >
                {step.label}
              </span>
              {active && (
                <span className="text-[0.72rem] text-ink-faint italic">{step.note}</span>
              )}
            </li>
          );
        })}
      </ol>

      {hash && (
        <a
          className="mono mt-4 inline-block border-b border-rule-strong text-[0.68rem] tracking-[0.08em] hover:border-ink"
          href={txUrl(hash)}
          target="_blank"
          rel="noreferrer"
        >
          {hash.slice(0, 18)}… ↗
        </a>
      )}

      {phase === "accepted" && (
        <p className="mt-3 max-w-md text-[0.78rem] leading-relaxed text-ink-soft">
          The verdict is on chain. Reload to read it — it stays appealable until
          finality.
        </p>
      )}
    </div>
  );
}

import Link from "next/link";

import { formatDate, parseEvidence, repoPath, statusStyle } from "@/lib/format";
import type { Pact } from "@/lib/types";

export function CaseCard({ pact, index }: { pact: Pact; index: number }) {
  const style = statusStyle(pact.status);
  const evidence = parseEvidence(pact.evidence_json);

  return (
    <Link
      href={repoPath(pact.repo)}
      className="sheet group relative flex flex-col justify-between p-5 transition-transform duration-150 hover:-translate-y-0.5"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: style.color }}
      />

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="label">case {String(index + 1).padStart(3, "0")}</span>
          <span
            className="mono text-[0.6rem] tracking-[0.16em] uppercase"
            style={{ color: style.color }}
          >
            {pact.status || "unheard"}
          </span>
        </div>

        <h3 className="mono mt-3 text-[0.95rem] leading-snug break-words group-hover:underline group-hover:decoration-rule-strong group-hover:underline-offset-4">
          {pact.repo}
        </h3>

        <p className="mt-3 line-clamp-3 text-[0.82rem] leading-relaxed text-ink-soft">
          {pact.headline || "No inquest has been opened on this repository yet."}
        </p>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-rule pt-3">
        <div>
          <dt className="label">last push</dt>
          <dd className="mono text-[0.72rem]">{evidence.since_last_push ?? "n/a"}</dd>
        </div>
        <div>
          <dt className="label">urgency</dt>
          <dd className="mono text-[0.72rem]">
            {pact.has_verdict ? `${pact.urgency}/100` : "n/a"}
          </dd>
        </div>
        <div>
          <dt className="label">open threads</dt>
          <dd className="mono text-[0.72rem]">{evidence.open_threads ?? "n/a"}</dd>
        </div>
        <div>
          <dt className="label">heard</dt>
          <dd className="mono text-[0.72rem]">{formatDate(pact.decided_at)}</dd>
        </div>
      </dl>
    </Link>
  );
}

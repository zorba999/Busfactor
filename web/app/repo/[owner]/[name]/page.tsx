import type { Metadata } from "next";
import Link from "next/link";

import { EvidenceLedger } from "@/components/EvidenceLedger";
import { PactActions } from "@/components/PactActions";
import { StatusStamp } from "@/components/StatusStamp";
import { addressUrl } from "@/lib/contract";
import {
  formatDate,
  isZero,
  parseEvidence,
  parseReasons,
  shortAddress,
  statusStyle,
} from "@/lib/format";
import { getDefaultPolicy, getPact } from "@/lib/read";
import type { Pact } from "@/lib/types";

// StudioNet allows 30 RPC calls per minute, and every render of this page
// costs two. A short revalidate window burns that budget on nobody's behalf.
export const revalidate = 60;

type Params = { params: Promise<{ owner: string; name: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { owner, name } = await params;
  const repo = `${decodeURIComponent(owner)}/${decodeURIComponent(name)}`;
  const pact = await getPact(repo);

  return {
    title: pact?.has_verdict
      ? `${repo} · ${statusStyle(pact.status).label} · BusFactor`
      : `${repo} · BusFactor`,
    description:
      pact?.headline ?? `No dormancy inquest has been heard for ${repo} yet.`,
  };
}

function EmptyDossier({ repo }: { repo: string }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <p className="label">no ruling on file</p>
      <h1 className="display mt-4 text-[clamp(2.4rem,8vw,4.5rem)]">
        the court has not
        <br />
        heard this one
      </h1>
      <p className="mono mt-6 text-sm text-ink-soft">{repo}</p>
      <p className="mt-6 max-w-lg leading-relaxed text-ink-soft">
        Nobody has opened an inquest on this repository yet. Anyone can. It takes
        one transaction, and the ruling belongs to everybody afterwards.
      </p>
      <Link href="/" className="btn mt-8 inline-block">
        ← open an inquest
      </Link>
    </main>
  );
}

export default async function RepoPage({ params }: Params) {
  const { owner, name } = await params;
  const repo = `${decodeURIComponent(owner)}/${decodeURIComponent(name)}`.toLowerCase();

  const [pact, defaultPolicy] = await Promise.all([getPact(repo), getDefaultPolicy()]);

  if (!pact) return <EmptyDossier repo={repo} />;

  const style = statusStyle(pact.status);
  const evidence = parseEvidence(pact.evidence_json);
  const reasons = parseReasons(pact.reasons_json);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <Link href="/" className="label hover:text-ink">
        ← the docket
      </Link>

      {/* ------------------------------------------------------ certificate */}
      <article className="sheet mt-5 overflow-hidden">
        <div className="h-[5px]" style={{ background: style.color }} />

        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <p className="label">certificate of dormancy · genlayer studio</p>

            <h1 className="mono mt-4 text-[clamp(1.4rem,4.5vw,2.15rem)] leading-tight break-words">
              {pact.repo}
            </h1>

            <a
              href={`https://github.com/${pact.repo}`}
              target="_blank"
              rel="noreferrer"
              className="mono mt-1.5 inline-block text-[0.7rem] tracking-[0.08em] text-ink-faint hover:text-ink"
            >
              github.com/{pact.repo} ↗
            </a>

            {evidence.description && (
              <p className="mt-3 text-[0.85rem] text-ink-faint italic">
                {evidence.description}
              </p>
            )}

            {pact.has_verdict ? (
              <p className="display-quoted mt-7 text-[clamp(1.7rem,4.4vw,2.7rem)]">
                {pact.headline}
              </p>
            ) : (
              <p className="mt-7 text-lg text-ink-soft">
                A pact exists for this repository, but no inquest has been heard yet.
              </p>
            )}

            {reasons.length > 0 && (
              <ul className="mt-7 space-y-2.5">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex gap-3 text-[0.92rem] leading-relaxed">
                    <span
                      className="mono shrink-0 text-[0.72rem]"
                      style={{ color: style.color }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink-soft">{reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col items-center gap-4 lg:items-end">
            <StatusStamp
              status={pact.status}
              urgency={pact.has_verdict ? pact.urgency : undefined}
              size={186}
            />
            <p className="max-w-[15rem] text-center text-[0.8rem] leading-relaxed text-ink-soft lg:text-right">
              {style.gloss}
            </p>
          </div>
        </div>

        <Register pact={pact} />
      </article>

      {/* ---------------------------------------------------------- evidence */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <section className="sheet p-6 sm:p-7">
          <EvidenceLedger evidence={evidence} />

          <p className="mt-6 border-t border-rule pt-4 text-[0.82rem] leading-relaxed text-ink-soft">
            Durations are stored as buckets, never as timestamps. That is not
            imprecision. It is the only way two validators fetching the same page
            forty minutes apart can be asked to agree.
          </p>
        </section>

        <div className="space-y-8">
          <section className="sheet p-6 sm:p-7">
            <p className="label">the policy this was judged against</p>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-ink-soft">
              {pact.policy}
            </p>
            <p className="mono mt-4 text-[0.68rem] text-ink-faint">
              {pact.registered
                ? "written by the registered steward"
                : "court default, no maintainer has claimed this pact"}
            </p>
          </section>

          <PactActions pact={pact} defaultPolicy={defaultPolicy} />
        </div>
      </div>
    </main>
  );
}

function Register({ pact }: { pact: Pact }) {
  const cells: { label: string; value: React.ReactNode }[] = [
    { label: "heard on", value: formatDate(pact.decided_at) },
    { label: "inquests", value: pact.inquests },
    {
      label: "urgency",
      value: pact.has_verdict ? `${pact.urgency}/100` : "n/a",
    },
    {
      label: "steward",
      value: isZero(pact.steward) ? (
        "unclaimed"
      ) : (
        <a
          href={addressUrl(pact.steward)}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {shortAddress(pact.steward)}
        </a>
      ),
    },
    {
      label: "successor",
      value: pact.successor_handle ? `@${pact.successor_handle}` : "none named",
    },
    {
      label: "handover",
      value: pact.handover_armed ? "armed" : "disarmed",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px border-t border-rule bg-rule sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-paper-raised px-4 py-3">
          <p className="label">{cell.label}</p>
          <p className="mono mt-1 text-[0.82rem] break-words">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

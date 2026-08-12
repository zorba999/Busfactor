import Link from "next/link";

import { CaseCard } from "@/components/CaseCard";
import { InquestForm } from "@/components/InquestForm";
import { StatusStamp } from "@/components/StatusStamp";
import { Ticker } from "@/components/Ticker";
import { STATUS_COPY } from "@/lib/format";
import { getDocket, getStats } from "@/lib/read";
import type { Status } from "@/lib/types";

export const revalidate = 20;

const MECHANISM = [
  {
    step: "01",
    title: "anyone opens an inquest",
    body: "No maintainer has to opt in for the world to be allowed to ask the question, and no server has to stay up to answer it.",
  },
  {
    step: "02",
    title: "every validator reads GitHub itself",
    body: "Three calls, live, with no oracle in between. Each node fetches the repository, its open threads, and what the owner has been doing elsewhere.",
  },
  {
    step: "03",
    title: "the facts are blunted into buckets",
    body: "Not “last push 2019-04-19T14:16:20Z” but “over 2 years ago”. Two nodes fetching minutes apart land in the same bucket, so they can agree at all.",
  },
  {
    step: "04",
    title: "the model rules, the network checks",
    body: "Validators re-run the whole investigation and compare the one decision that carries consequences: does this need a new steward. Then they compare the pivotal facts behind it. Urgency is never asked for; it is computed from facts everyone already agreed on.",
  },
];

export default async function Home() {
  const [stats, docket] = await Promise.all([getStats(), getDocket(0, 50)]);

  const ordered = [...docket].sort((a, b) => {
    if (a.has_verdict !== b.has_verdict) return a.has_verdict ? -1 : 1;
    return b.urgency - a.urgency;
  });

  return (
    <main>
      {/* ------------------------------------------------------------ hero */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:items-start">
          <div>
            <p className="label">
              open-source dormancy court · genlayer bradbury testnet
            </p>

            <h1 className="display mt-5 text-[clamp(3rem,10.5vw,7.5rem)]">
              is it dead,
              <br />
              or just
              <em className="not-italic" style={{ color: "var(--color-rot)" }}>
                {" "}
                finished
              </em>
              ?
            </h1>

            <p className="mt-7 max-w-xl text-[1.02rem] leading-relaxed text-ink-soft">
              Zero commits for two years describes a complete little library and a
              rotting one with an unpatched CVE. The raw numbers are identical.
              Registries wait years to tell them apart, because someone has to{" "}
              <em>judge</em>, and nobody wants to be that someone.
            </p>

            <p className="mt-4 max-w-xl text-[1.02rem] leading-relaxed text-ink-soft">
              So the judging happens here, in the open, on a network built to do
              exactly that.
            </p>

            <div className="sheet mt-9 p-5 sm:p-6">
              <InquestForm />
            </div>
          </div>

          <aside className="lg:pt-10">
            <div className="flex justify-center lg:justify-end">
              <StatusStamp status="ROTTING" urgency={75} size={210} />
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-px border border-rule bg-rule">
              {(
                [
                  ["inquests heard", stats.inquests],
                  ["repos on the docket", stats.pacts],
                  ["pacts registered", stats.registered],
                  ["proofs of life", stats.heartbeats],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-paper-raised px-4 py-3.5">
                  <dt className="label">{label}</dt>
                  <dd className="mono mt-1 text-2xl">{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <Ticker stats={stats} repos={ordered.map((pact) => pact.repo)} />

      {/* ---------------------------------------------------------- verdicts */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(STATUS_COPY) as Exclude<Status, "">[]).map((status) => {
            const copy = STATUS_COPY[status];
            const count = {
              ACTIVE: stats.active,
              FINISHED: stats.finished,
              DORMANT: stats.dormant,
              ROTTING: stats.rotting,
            }[status];

            return (
              <div key={status} className="border-t-2 pt-4" style={{ borderColor: copy.color }}>
                <div className="flex items-baseline justify-between">
                  <span
                    className="mono text-[0.68rem] tracking-[0.18em] uppercase"
                    style={{ color: copy.color }}
                  >
                    {status}
                  </span>
                  <span className="mono text-lg">{count}</span>
                </div>
                <p className="mt-2 text-[0.84rem] leading-relaxed text-ink-soft">
                  {copy.gloss}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ docket */}
      <section className="mx-auto max-w-6xl px-5 pb-6">
        <div className="flex items-end justify-between gap-4 border-b border-rule pb-4">
          <h2 className="display text-[clamp(2.2rem,6vw,3.6rem)]">the docket</h2>
          <p className="label pb-1.5 text-right">
            every ruling this court
            <br />
            has handed down
          </p>
        </div>

        {ordered.length === 0 ? (
          <div className="sheet mt-8 p-10 text-center">
            <p className="mono text-sm text-ink-soft">
              The docket is empty. Open the first inquest above.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((pact, index) => (
              <CaseCard key={pact.repo} pact={pact} index={index} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- mechanism */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="display text-[clamp(2.2rem,6vw,3.6rem)]">how a ruling is made</h2>

        <div className="mt-9 grid gap-px border border-rule bg-rule sm:grid-cols-2">
          {MECHANISM.map((item) => (
            <div key={item.step} className="bg-paper-raised p-6">
              <span className="mono text-[2.4rem] leading-none text-ink-faint/45">
                {item.step}
              </span>
              <h3 className="mono mt-4 text-[0.92rem] tracking-[0.04em]">{item.title}</h3>
              <p className="mt-2.5 text-[0.88rem] leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- the xz line */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div
          className="sheet grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.15fr]"
          style={{ borderLeft: "3px solid var(--color-rot)" }}
        >
          <div>
            <p className="label" style={{ color: "var(--color-rot)" }}>
              what this deliberately is not
            </p>
            <h2 className="display mt-4 text-[clamp(2rem,5vw,3.2rem)]">
              a way to take
              <br />
              your package
            </h2>
          </div>

          <div className="space-y-4 text-[0.95rem] leading-relaxed text-ink-soft">
            <p>
              Automatic handover is not a feature. It is the xz attack. Someone
              befriends a tired maintainer, inherits commit rights, and ships a
              backdoor to the world.
            </p>
            <p>
              So the contract will happily rule that a repository is dormant, then
              do <strong className="text-ink">nothing</strong> with it. A
              handover only arms when the maintainer named a successor themselves,
              while they were alive and holding the key, before any claim existed.
            </p>
            <p>
              With no pre-designated successor, the verdict stays exactly what it
              is: a neutral, timestamped, evidence-backed second opinion that a
              registry or a foundation can point at. That is the whole product.
            </p>
            <p className="mono border-t border-rule pt-4 text-[0.8rem] text-ink-faint">
              A heartbeat from the steward clears any standing verdict instantly.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="hairline flex flex-wrap items-center justify-between gap-4 pt-8">
          <p className="max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
            Maintain something small and quiet? Register a pact and write your own
            dormancy policy, in plain language, not a number of days.
          </p>
          <Link href="/repo/stevemao/left-pad" className="btn btn-ghost">
            read a verdict →
          </Link>
        </div>
      </section>
    </main>
  );
}

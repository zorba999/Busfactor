import { bucketWords } from "@/lib/format";
import type { Evidence } from "@/lib/types";

const PIVOTAL = new Set([
  "archived",
  "disabled",
  "since_last_push",
  "stale_open_threads",
  "stale_security_thread",
  "maintainer_replied_recently",
  "self_declared_deprecated",
]);

type Row = { key: string; label: string; value: string; note?: string };

function yesNo(value?: boolean) {
  return value === undefined ? "n/a" : value ? "yes" : "no";
}

export function EvidenceLedger({ evidence }: { evidence: Evidence }) {
  const rows: Row[] = [
    {
      key: "since_last_push",
      label: "last push",
      value: evidence.since_last_push ?? "n/a",
      note: bucketWords(evidence.since_last_push),
    },
    {
      key: "stale_open_threads",
      label: "threads untouched 90d+",
      value: evidence.stale_open_threads ?? "n/a",
    },
    {
      key: "open_threads",
      label: "open threads",
      value: evidence.open_threads ?? "n/a",
    },
    {
      key: "oldest_open_thread_age",
      label: "oldest open thread",
      value: evidence.oldest_open_thread_age ?? "n/a",
      note: bucketWords(evidence.oldest_open_thread_age),
    },
    {
      key: "stale_security_thread",
      label: "stale security thread",
      value: yesNo(evidence.stale_security_thread),
    },
    {
      key: "maintainer_replied_recently",
      label: "owner on a live thread (90d)",
      value: yesNo(evidence.maintainer_replied_recently),
      note: "proxy, not proof of a reply",
    },
    {
      key: "maintainer_active_elsewhere",
      label: "owner active elsewhere",
      value: evidence.maintainer_active_elsewhere ?? "n/a",
      note: "gone, or just done with this one?",
    },
    {
      key: "maintainer_active_here",
      label: "owner active here",
      value: yesNo(evidence.maintainer_active_here),
    },
    {
      key: "self_declared_deprecated",
      label: "said goodbye in the readme",
      value: yesNo(evidence.self_declared_deprecated),
    },
    { key: "archived", label: "archived", value: yesNo(evidence.archived) },
    { key: "disabled", label: "disabled", value: yesNo(evidence.disabled) },
    { key: "stars", label: "reach (stars)", value: evidence.stars ?? "n/a" },
    { key: "license", label: "licence", value: evidence.license ?? "n/a" },
    {
      key: "snapshot_day",
      label: "snapshot taken",
      value: evidence.snapshot_day ?? "n/a",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
        <p className="label">the evidence, as the validators saw it</p>
        <p className="mono text-[0.62rem] tracking-[0.1em] text-ink-faint">
          ● must match across nodes
        </p>
      </div>

      <dl className="mt-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="ledger-row flex items-baseline justify-between gap-4 py-2.5"
          >
            <dt className="flex min-w-0 items-baseline gap-2 text-[0.85rem] text-ink-soft">
              {PIVOTAL.has(row.key) && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ background: "var(--color-ink)" }}
                  title="Validators must reproduce this exactly"
                />
              )}
              <span className="truncate">{row.label}</span>
            </dt>
            <dd className="mono shrink-0 text-right text-[0.8rem]">
              {row.value}
              {row.note && row.note !== row.value && (
                <span className="ml-2 hidden text-ink-faint italic sm:inline">
                  {row.note}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

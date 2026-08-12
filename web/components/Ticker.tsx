import type { Stats } from "@/lib/types";

export function Ticker({ stats, repos }: { stats: Stats; repos: string[] }) {
  const claims = [
    `${stats.inquests} inquest${stats.inquests === 1 ? "" : "s"} heard`,
    `${stats.rotting} rotting`,
    `${stats.dormant} dormant`,
    `${stats.finished} finished, not dead`,
    `${stats.active} still steered`,
    "no oracle",
    "no server",
    "evidence pinned on chain",
    ...repos.slice(0, 6),
  ];

  const line = [...claims, ...claims];

  return (
    <div className="overflow-hidden border-y border-rule bg-paper-sunk py-2.5">
      <div className="ticker-track">
        {line.map((claim, index) => (
          <span
            key={`${claim}-${index}`}
            className="mono flex shrink-0 items-center gap-6 px-6 text-[0.68rem] tracking-[0.14em] whitespace-nowrap text-ink-soft uppercase"
          >
            {claim}
            <span aria-hidden className="text-ink-faint">
              ✦
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

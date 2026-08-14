"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { refreshVerdict } from "@/app/actions";
import { isZero } from "@/lib/format";
import type { Pact } from "@/lib/types";
import { useCourt } from "@/lib/useCourt";

import { TxProgress } from "./TxProgress";

type Tab = "inquest" | "register" | "heartbeat";

export function PactActions({ pact, defaultPolicy }: { pact: Pact; defaultPolicy: string }) {
  const court = useCourt();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inquest");
  const [policy, setPolicy] = useState(pact.registered ? pact.policy : defaultPolicy);
  const [handle, setHandle] = useState(pact.successor_handle);
  const [successor, setSuccessor] = useState(
    isZero(pact.successor_addr) ? "" : pact.successor_addr,
  );
  const [pkg, setPkg] = useState(pact.package);

  // Any of these three writes changes what this page shows, so the cached
  // render has to go before the reader looks at it again.
  useEffect(() => {
    if (court.phase !== "accepted") return;
    let cancelled = false;

    (async () => {
      await refreshVerdict(pact.repo);
      if (!cancelled) router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [court.phase, pact.repo, router]);

  const isSteward =
    court.address && !isZero(pact.steward)
      ? court.address.toLowerCase() === pact.steward.toLowerCase()
      : false;

  const tabs: { key: Tab; label: string }[] = [
    { key: "inquest", label: "re-open inquest" },
    { key: "register", label: pact.registered ? "update pact" : "claim as maintainer" },
    ...(isSteward ? [{ key: "heartbeat" as Tab, label: "prove i'm alive" }] : []),
  ];

  return (
    <div className="sheet p-5 sm:p-6">
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-rule pb-3">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className="mono text-[0.68rem] tracking-[0.12em] uppercase"
            style={{
              color: tab === entry.key ? "var(--color-ink)" : "var(--color-ink-faint)",
              borderBottom:
                tab === entry.key ? "2px solid var(--color-ink)" : "2px solid transparent",
              paddingBottom: "0.35rem",
              marginBottom: "-0.85rem",
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "inquest" && (
          <div>
            <p className="text-[0.88rem] leading-relaxed text-ink-soft">
              Re-runs the whole investigation against GitHub as it is right now and
              replaces the standing verdict. Costs one transaction and a few minutes
              of consensus.
            </p>
            <button
              className="btn mt-5"
              disabled={court.busy}
              onClick={() =>
                court.isConnected
                  ? court.send("open_inquest", [pact.repo])
                  : court.connectWallet()
              }
            >
              {court.busy
                ? "in session…"
                : court.isConnected
                  ? "re-open inquest"
                  : "connect & re-open"}
            </button>
          </div>
        )}

        {tab === "register" && (
          <div className="space-y-4">
            <p className="text-[0.88rem] leading-relaxed text-ink-soft">
              Claiming the pact lets you write the policy the court judges you
              by, in plain language rather than a day count, and name the one
              person who may ever inherit it.
            </p>

            <div
              className="border-l-2 px-4 py-3"
              style={{ borderColor: "var(--color-drift)", background: "#c2740a0f" }}
            >
              <p className="label" style={{ color: "var(--color-drift)" }}>
                first, prove you control the repository
              </p>
              <p className="mt-2 text-[0.84rem] leading-relaxed text-ink-soft">
                Commit a file named{" "}
                <span className="mono text-[0.8rem]">.busfactor</span> to the
                default branch of{" "}
                <span className="mono text-[0.8rem]">{pact.repo}</span>,
                containing your address. Only someone with write access can do
                that, which is exactly the authority you are claiming.
              </p>
              <pre className="mono mt-3 overflow-x-auto border border-rule bg-paper-sunk px-3 py-2 text-[0.72rem]">
                busfactor-steward: {court.address ?? "0x… connect your wallet"}
              </pre>
            </div>

            <label className="block">
              <span className="label">your dormancy policy</span>
              <textarea
                className="field mt-1 min-h-[7rem] resize-y text-[0.82rem] leading-relaxed"
                value={policy}
                onChange={(event) => setPolicy(event.target.value)}
                maxLength={1200}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">registry id (optional)</span>
                <input
                  className="field mt-1 text-[0.82rem]"
                  placeholder="npm:left-pad"
                  value={pkg}
                  onChange={(event) => setPkg(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">successor github handle</span>
                <input
                  className="field mt-1 text-[0.82rem]"
                  placeholder="sarah-dev"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="label">successor wallet (optional)</span>
              <input
                className="field mt-1 text-[0.82rem]"
                placeholder="0x…"
                value={successor}
                onChange={(event) => setSuccessor(event.target.value)}
              />
            </label>

            <p className="mono text-[0.7rem] leading-relaxed text-ink-faint">
              Leave both successor fields blank and a dormant verdict will still
              be issued; it just will never move anything. Fill one and you must
              fill the other, since a handle with no address names an heir who
              cannot receive anything. Changing either the policy or the
              successor voids any standing verdict.
            </p>

            <button
              className="btn"
              disabled={court.busy}
              onClick={() =>
                court.isConnected
                  ? court.send("register_pact", [
                      pact.repo,
                      pkg,
                      policy,
                      handle,
                      successor,
                    ])
                  : court.connectWallet()
              }
            >
              {court.busy
                ? "signing…"
                : court.isConnected
                  ? "sign the pact"
                  : "connect & sign"}
            </button>
          </div>
        )}

        {tab === "heartbeat" && (
          <div>
            <p className="text-[0.88rem] leading-relaxed text-ink-soft">
              A heartbeat resets the clock and clears any standing verdict on the
              spot. It is the maintainer&rsquo;s unconditional veto over this court.
            </p>
            <button
              className="btn mt-5"
              disabled={court.busy}
              onClick={() => court.send("heartbeat", [pact.repo])}
            >
              {court.busy ? "signing…" : "i'm still here"}
            </button>
          </div>
        )}
      </div>

      <TxProgress phase={court.phase} hash={court.hash} error={court.error} />
    </div>
  );
}

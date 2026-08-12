"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { normaliseRepo, repoPath } from "@/lib/format";
import { useCourt } from "@/lib/useCourt";

import { TxProgress } from "./TxProgress";

const SUGGESTIONS = [
  "stevemao/left-pad",
  "dominictarr/event-stream",
  "jonschlinkert/is-odd",
];

export function InquestForm({ autofocus = false }: { autofocus?: boolean }) {
  const router = useRouter();
  const court = useCourt();
  const [input, setInput] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const repo = normaliseRepo(input);

  // Once the verdict is on chain, walk the reader to the certificate.
  useEffect(() => {
    if (court.phase === "accepted" && repo) {
      const timer = setTimeout(() => router.push(repoPath(repo)), 1200);
      return () => clearTimeout(timer);
    }
  }, [court.phase, repo, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!repo) {
      setHint("Give me a GitHub repository: owner/name, or paste the URL.");
      return;
    }
    setHint(null);
    if (!court.isConnected) {
      court.connectWallet();
      return;
    }
    await court.send("open_inquest", [repo]);
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="label">the repository in question</span>
          <input
            className="field mt-1 text-base sm:text-lg"
            placeholder="owner/name"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoFocus={autofocus}
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <button className="btn shrink-0" disabled={court.busy}>
          {court.busy
            ? "in session…"
            : court.isConnected
              ? "open inquest"
              : "connect & open"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="label">try</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setInput(suggestion)}
            className="mono text-[0.7rem] text-ink-soft underline decoration-rule underline-offset-4 hover:decoration-ink"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {hint && <p className="mono mt-3 text-[0.72rem] text-ink-soft">{hint}</p>}

      <TxProgress phase={court.phase} hash={court.hash} error={court.error} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { walletChain } from "@/lib/contract";
import { shortAddress } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // Injected providers land after hydration; rendering wallet state on the
  // server would guarantee a mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className="mono text-[0.66rem] tracking-[0.16em] text-ink-faint uppercase">
        wallet …
      </span>
    );
  }

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <button
        className="btn btn-ghost"
        onClick={() => injected && connect({ connector: injected })}
        disabled={isPending || !injected}
      >
        {isPending ? "connecting…" : "connect wallet"}
      </button>
    );
  }

  if (chainId !== walletChain.id) {
    return (
      <button
        className="btn"
        style={{ background: "var(--color-rot)", boxShadow: "3px 3px 0 0 var(--color-ink)" }}
        onClick={() => switchChain({ chainId: walletChain.id })}
      >
        switch to studio
      </button>
    );
  }

  return (
    <button
      className="mono group flex items-center gap-2 border border-rule px-3 py-2 text-[0.68rem] tracking-[0.1em]"
      onClick={() => disconnect()}
      title="Disconnect"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--color-alive)" }}
      />
      <span>{shortAddress(address)}</span>
      <span className="text-ink-faint group-hover:text-ink">✕</span>
    </button>
  );
}

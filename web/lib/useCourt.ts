"use client";

import { useCallback, useRef, useState } from "react";
import { useAccount, useConnect, useSwitchChain } from "wagmi";

import { CHAIN, CONTRACT_ADDRESS, bradburyChain } from "./contract";

export type Phase =
  | "idle"
  | "wallet"
  | "signing"
  | "pending"
  | "accepted"
  | "finalized"
  | "error";

export const PHASE_STEPS: { key: Phase; label: string; note: string }[] = [
  { key: "signing", label: "Signed", note: "your wallet authorised the call" },
  { key: "pending", label: "In consensus", note: "validators are fetching and judging" },
  { key: "accepted", label: "Accepted", note: "the verdict is on chain" },
  { key: "finalized", label: "Final", note: "the appeal window has closed" },
];

const TERMINAL_FAILURES = new Set(["CANCELED", "UNDETERMINED"]);

type CourtState = {
  phase: Phase;
  hash: string | null;
  error: string | null;
};

const INITIAL: CourtState = { phase: "idle", hash: null, error: null };

/**
 * Bridges wagmi (wallet, chain) to genlayer-js (consensus calls).
 *
 * genlayer-js is imported lazily inside the callback so nothing touches
 * `window` during SSR -- that import at module scope is what breaks these apps
 * on Vercel.
 */
export function useCourt() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { switchChainAsync } = useSwitchChain();

  const [state, setState] = useState<CourtState>(INITIAL);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setState(INITIAL);
  }, []);

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors[0];
    if (injectedConnector) connect({ connector: injectedConnector });
  }, [connect, connectors]);

  const send = useCallback(
    async (functionName: string, args: unknown[]) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);

      if (!isConnected || !address || !connector) {
        setState({ phase: "error", hash: null, error: "Connect a wallet first." });
        return;
      }

      setState({ phase: "wallet", hash: null, error: null });

      try {
        if (chainId !== bradburyChain.id) {
          await switchChainAsync({ chainId: bradburyChain.id });
        }

        const { createClient } = await import("genlayer-js");
        const provider = (await connector.getProvider()) as never;

        const client = createClient({
          chain: CHAIN,
          account: address,
          provider,
        });
        await client.connect("testnetBradbury");

        setState({ phase: "signing", hash: null, error: null });

        const hash = (await client.writeContract({
          address: CONTRACT_ADDRESS,
          functionName,
          args: args as never[],
          value: BigInt(0),
        })) as string;

        setState({ phase: "pending", hash, error: null });

        // Poll rather than await finality: a serverless function would time
        // out long before consensus settles, so the browser owns the wait.
        const poll = async (attempt: number) => {
          if (attempt > 120) return;
          try {
            const tx = (await client.getTransaction({ hash: hash as never })) as {
              status?: string;
              status_name?: string;
            };
            const status = String(tx?.status_name ?? tx?.status ?? "").toUpperCase();

            if (status === "FINALIZED") {
              setState({ phase: "finalized", hash, error: null });
              return;
            }
            if (status === "ACCEPTED" || status === "READY_TO_FINALIZE") {
              setState({ phase: "accepted", hash, error: null });
            }
            if (TERMINAL_FAILURES.has(status)) {
              setState({
                phase: "error",
                hash,
                error: `Consensus ended as ${status}. Try again.`,
              });
              return;
            }
          } catch {
            // Transient RPC hiccup -- keep polling.
          }
          pollTimer.current = setTimeout(() => void poll(attempt + 1), 4000);
        };

        pollTimer.current = setTimeout(() => void poll(0), 3000);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The transaction was rejected.";
        setState({ phase: "error", hash: null, error: message.slice(0, 220) });
      }
    },
    [address, chainId, connector, isConnected, switchChainAsync],
  );

  return {
    ...state,
    address,
    isConnected,
    isConnecting,
    onWrongChain: isConnected && chainId !== bradburyChain.id,
    connectWallet,
    send,
    reset,
    busy: ["wallet", "signing", "pending"].includes(state.phase),
  };
}

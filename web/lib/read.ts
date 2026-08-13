import "server-only";

import { createClient } from "genlayer-js";

import { CHAIN, CONTRACT_ADDRESS } from "./contract";
import type { Pact, Stats } from "./types";

/**
 * Read-only client. No wallet, no signer -- so it runs on the server and the
 * whole docket renders for visitors who never connect anything.
 */
const readClient = createClient({ chain: CHAIN });

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const result = await readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as never[],
    jsonSafeReturn: true,
  });
  return result as T;
}

export async function getStats(): Promise<Stats> {
  try {
    return await read<Stats>("get_stats");
  } catch {
    return {
      pacts: 0,
      registered: 0,
      inquests: 0,
      heartbeats: 0,
      active: 0,
      finished: 0,
      dormant: 0,
      rotting: 0,
    };
  }
}

export async function getDocket(offset = 0, limit = 50): Promise<Pact[]> {
  try {
    const rows = await read<Pact[]>("get_docket", [offset, limit]);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function getPact(repo: string): Promise<Pact | null> {
  try {
    const pact = await read<Pact>("get_pact", [repo]);
    if (!pact || !pact.repo) return null;
    return pact;
  } catch {
    return null;
  }
}

/**
 * The court default is a constant in the contract, so fetching it on every
 * dossier render just burns Studio's 30-calls-per-minute budget for an answer
 * that cannot change. Hold it for the life of the process.
 */
let cachedDefaultPolicy: string | null = null;

export async function getDefaultPolicy(): Promise<string> {
  if (cachedDefaultPolicy !== null) return cachedDefaultPolicy;
  try {
    const policy = await read<string>("get_default_policy");
    cachedDefaultPolicy = policy;
    return policy;
  } catch {
    return "";
  }
}

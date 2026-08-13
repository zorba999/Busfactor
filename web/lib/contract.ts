import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x9d71d8A233E9EC769757bC1C59EF587cB928Fd78") as `0x${string}`;

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://genlayer-explorer.vercel.app";

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;

/** The GenLayer chain as wagmi/viem sees it: same id, plain viem shape. */
export const walletChain = {
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [...CHAIN.rpcUrls.default.http] } },
  blockExplorers: { default: { name: "GenLayer Explorer", url: EXPLORER_URL } },
  testnet: true,
} as const;

import { testnetBradbury } from "genlayer-js/chains";

export const CHAIN = testnetBradbury;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0xbd8f2BbBc62e2566500b4b67bd1e16B9f43A5756") as `0x${string}`;

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer-bradbury.genlayer.com";

export const RPC_URL = CHAIN.rpcUrls.default.http[0];

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;

/** Bradbury as wagmi/viem sees it. Same chain id, plain viem shape. */
export const bradburyChain = {
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [...CHAIN.rpcUrls.default.http] } },
  blockExplorers: { default: { name: "Bradbury Explorer", url: EXPLORER_URL } },
  testnet: true,
} as const;

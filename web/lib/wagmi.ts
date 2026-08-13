import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { RPC_URL, walletChain } from "./contract";

/**
 * Injected-only on purpose: no WalletConnect project id to provision, nothing
 * to configure before a fresh `vercel deploy` works. wagmi is here as the
 * adapter -- it owns discovery, chain switching and account state, and hands
 * genlayer-js a plain EIP-1193 provider.
 */
export const wagmiConfig = createConfig({
  chains: [walletChain],
  connectors: [injected()],
  transports: { [walletChain.id]: http(RPC_URL) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

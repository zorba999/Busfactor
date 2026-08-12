import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

import { ConnectButton } from "@/components/ConnectButton";
import { Providers } from "@/components/Providers";
import { CONTRACT_ADDRESS, addressUrl } from "@/lib/contract";

import "./globals.css";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BusFactor: is it dead, or just finished?",
  description:
    "A neutral dormancy court for open source, running as an intelligent contract on GenLayer Bradbury. Validators read the repository themselves and rule on whether a package is abandoned, finished, or rotting.",
  openGraph: {
    title: "BusFactor, the dormancy court for open source",
    description:
      "Zero commits for two years describes both a finished library and a rotting one. BusFactor settles which, on chain.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="antialiased">
        <Providers>
          <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
              <Link href="/" className="group flex items-baseline gap-2.5">
                <span className="mono text-[0.95rem] font-bold tracking-[0.2em]">
                  BUSFACTOR
                </span>
                <span className="label hidden sm:inline">dormancy court</span>
              </Link>

              <div className="flex items-center gap-4">
                <a
                  href={addressUrl(CONTRACT_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="label hidden hover:text-ink md:inline"
                >
                  bradbury · {CONTRACT_ADDRESS.slice(0, 8)}…
                </a>
                <ConnectButton />
              </div>
            </div>
          </header>

          {children}

          <footer className="mt-24 border-t border-rule">
            <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 sm:grid-cols-3">
              <div>
                <p className="label">the court</p>
                <p className="mt-2 max-w-xs text-[0.82rem] leading-relaxed text-ink-soft">
                  BusFactor issues attestations, not takeovers. It never moves
                  stewardship to anyone a maintainer did not name while alive.
                </p>
              </div>
              <div>
                <p className="label">contract</p>
                <a
                  href={addressUrl(CONTRACT_ADDRESS)}
                  target="_blank"
                  rel="noreferrer"
                  className="mono mt-2 block text-[0.72rem] break-all text-ink-soft hover:text-ink"
                >
                  {CONTRACT_ADDRESS}
                </a>
                <p className="mono mt-1 text-[0.72rem] text-ink-faint">
                  GenLayer Bradbury · chain 4221
                </p>
              </div>
              <div>
                <p className="label">evidence</p>
                <p className="mt-2 max-w-xs text-[0.82rem] leading-relaxed text-ink-soft">
                  Every ruling stores the exact bucketed snapshot the validators
                  judged, so an appeal re-argues the same facts.
                </p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

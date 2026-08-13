# BusFactor frontend

Next.js 16 App Router frontend for the BusFactor dormancy court. See the
[project README](../README.md) for the contract, the consensus design, and the
Vercel deployment notes.

```bash
npm install && npm run dev
```

Environment variables live in `.env.example`. There are no server secrets;
every write is signed by the visitor's own wallet.

## Where things are

| Path | Role |
|---|---|
| `lib/read.ts` | server-side read client, `server-only`; renders the docket without a wallet |
| `lib/useCourt.ts` | wagmi → genlayer-js bridge for writes, plus transaction polling |
| `lib/wagmi.ts` | injected-only wallet adapter, Studio chain config |
| `lib/format.ts` | verdict palette, evidence bucket wording, repo normalisation |
| `components/StatusStamp.tsx` | the rubber stamp on each certificate |
| `app/repo/[owner]/[name]` | the verdict dossier |

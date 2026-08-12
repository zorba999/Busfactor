# BusFactor: a dormancy court for open source

**Is this package dead, or is it just finished?**

Zero commits for two years describes two completely different repositories: a
small library that is simply complete, and a rotting one with an unpatched CVE
and two hundred unanswered issues. The raw numbers are identical. Telling them
apart needs judgment, and judgment is exactly what a normal smart contract
cannot do and an oracle cannot supply.

So BusFactor runs as an **Intelligent Contract on GenLayer Bradbury**: every
validator fetches the repository from GitHub itself, normalises the facts, asks
a language model to rule, and then re-runs the whole investigation to check the
leader rather than trust it.

- **Contract** `0xbd8f2BbBc62e2566500b4b67bd1e16B9f43A5756` on Bradbury (chain `4221`)
- **Explorer** https://explorer-bradbury.genlayer.com
- **Frontend** Next.js 16 App Router, deployable to Vercel as-is

---

## What it actually does

Three things, and deliberately not a fourth:

1. **Dormancy attestation.** A neutral, timestamped, evidence-backed ruling
   (`ACTIVE` / `FINISHED` / `DORMANT` / `ROTTING`) that a registry, a funder, or
   a foundation can point at. Today that call is made by an employee inside a
   company with no transparency. Here it is made in the open and is appealable.
2. **Pacts and heartbeats.** A maintainer can claim a repository, write their
   own dormancy policy *in plain language* ("if I go quiet for two seasons and
   there's a security issue open, hand it to Sarah"), and clear any standing
   verdict instantly with a heartbeat.
3. **A gated handover signal.** `handover_armed` only ever turns true when the
   maintainer named a successor themselves, while alive and holding the key.

**What it is not: a way to take someone's package.** Automatic handover is not
a feature, it is the xz/liblzma attack: befriend a tired maintainer, inherit
commit rights, ship a backdoor. With no pre-designated successor, a `DORMANT`
verdict moves nothing at all. The attestation is the product.

---

## Why this needs GenLayer

| Layer | Owns |
|---|---|
| Frontend | wallet UX, browsing, formatting, share pages |
| **Contract** | the evidence snapshot, the ruling, the heartbeat clock, the successor gate |
| GitHub | raw facts, never trusted; every validator re-fetches and re-derives |

The consensus surface is the decision that has consequences: **does this need a
new steward?** Not the adjective.

### Three design decisions that make consensus possible

**Buckets, not timestamps.** The model never sees `2019-04-19T14:16:20Z`; it
sees `"2y+"`. Two validators fetching the same page forty minutes apart land in
the same bucket, which is the only reason they can be asked to agree at all.

**Numbers come from code, judgment comes from the model.** An early version
asked the model for an urgency score from 0 to 100. One node answered 55, the
next answered 70. Both sensible, and a guaranteed `NO_MAJORITY`. Urgency is now *derived*
from facts every validator has already agreed on. The model rules on the
question that genuinely needs judgment and nothing else.

**Independent re-derivation, never schema checks.** The validator re-runs the
entire investigation (three live fetches and a fresh ruling), then compares
`needs_steward`, the urgency band, and seven pivotal facts. It never inspects
the leader's answer for well-formedness and calls that consensus.

---

## Layout

```
contracts/busfactor.py      the intelligent contract (GenVM, Python)
tests/direct/               direct-mode tests -- no server, ~1s for the suite
tests/conftest.py           Windows shim for gltest's fd-0 message injection
scripts/seed.sh             populate the docket with real inquests (with retry)
web/                        Next.js frontend (Vercel root directory)
```

---

## Running it

### Contract

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
```

Lint, then test, always in that order:

```bash
.venv/Scripts/genvm-lint check contracts/busfactor.py
```

```bash
.venv/Scripts/python -m pytest tests/direct -q
```

Deploy to Bradbury (needs a funded account; the
[faucet](https://testnet-faucet.genlayer.foundation/) gives 100 GEN per day):

```bash
npx genlayer network set testnet-bradbury
```

```bash
echo "$GENLAYER_KEYSTORE_PASSWORD" | npx genlayer deploy --contract contracts/busfactor.py
```

Seed the docket (retries `LEADER_TIMEOUT`, which is transient):

```bash
GENLAYER_KEYSTORE_PASSWORD=... bash scripts/seed.sh <contract-address>
```

### Frontend

```bash
cd web && npm install && npm run dev
```

---

## Deploying the frontend to Vercel

The app is Vercel-ready with no extra configuration.

1. Import the repository, set **Root Directory** to `web`.
2. Add the two environment variables from `web/.env.example`:
   `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_EXPLORER_URL`.
3. Deploy. No server secrets exist; every write is signed by the visitor's
   own wallet.

Four things this codebase does specifically so Vercel works:

- **Split read and write clients.** The read client has no wallet and runs on
  the server, so the whole docket renders (and indexes) for visitors who never
  connect anything. The write client is created in the browser only.
- **`genlayer-js` is imported lazily** inside the click handler. Importing a
  wallet SDK at module scope is what breaks these apps during SSR.
- **The browser owns the wait.** A serverless function times out long before
  GenLayer consensus settles, so no route handler ever awaits finality. The
  client polls `getTransaction` and drives the progress stepper.
- **Injected-only wallet adapter.** wagmi handles discovery, account state and
  chain switching, and hands `genlayer-js` a plain EIP-1193 provider. No
  WalletConnect project id to provision before a fresh deploy works.

---

## Known constraints

- **Unauthenticated GitHub API.** 60 requests/hour per IP, and each inquest
  costs three per validator. Heavy seeding will start tripping rate limits,
  which surface as `[TRANSIENT]` errors. Production would front this with an
  authenticated proxy.
- **`LEADER_TIMEOUT` is transient.** A leader that misses its deadline is
  rotated and the transaction settles as `IDLE` with no state change. Retrying
  is the correct response, which is why `scripts/seed.sh` retries. Keeping each
  non-deterministic block small is the other half of the fix. An earlier
  version pulled `events/public?per_page=100`, which is megabytes of JSON to
  parse inside the VM, and the leader died holding it every single time.
- **Direct-mode tests do not exercise validators.** They run the leader
  function only. Agreement is only ever proven on a real network.

---

## The runner pin

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

Never `py-genlayer:test` or `:latest`. Those are local-development aliases that
every GenLayer network rejects. Pinning also means the model behaviour your
contract was tested against does not change underneath it.

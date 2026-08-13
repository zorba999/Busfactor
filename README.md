# BusFactor

A dormancy court for open source, running as an Intelligent Contract on
GenLayer Studio.

Zero commits for two years describes two different repositories: a small
library that is simply complete, and a rotting one with an unpatched CVE and
two hundred unanswered issues. The raw numbers are identical, so separating
them requires judgment rather than computation. BusFactor puts that judgment on
chain: every validator fetches the repository from GitHub itself, normalises
the facts, rules on them, and then re-runs the whole investigation to verify
the leader instead of trusting it.

| | |
|---|---|
| Contract | [`0x9d71d8A233E9EC769757bC1C59EF587cB928Fd78`](https://explorer-studio.genlayer.com) |
| Network | GenLayer Studio Network, chain `61999` |
| Frontend | Next.js 16 App Router, deploys to Vercel unmodified |

## Verdicts

| Status | Meaning |
|---|---|
| `ACTIVE` | recent commits, or the maintainer is answering threads |
| `FINISHED` | quiet on purpose; nothing open, nothing broken |
| `DORMANT` | the maintainer stopped and work is piling up |
| `ROTTING` | dormant and harmful: stale security thread, or abandoned with users still depending on it |

Each ruling stores the exact bucketed evidence snapshot it was based on, so an
appeal re-argues the same facts.

## Scope

BusFactor issues attestations. It does **not** transfer ownership of anything.

`handover_armed` turns true only when the maintainer named a successor
themselves, while alive and holding the key, before any claim existed.
Automatic handover is the xz/liblzma attack vector, not a feature: with no
pre-designated successor, a `DORMANT` verdict moves nothing. A heartbeat from
the steward clears any standing verdict immediately.

## Design

Three constraints make consensus achievable over a non-deterministic input:

- **Buckets, not timestamps.** The model sees `"2y+"`, never
  `2019-04-19T14:16:20Z`. Two validators fetching minutes apart land in the
  same bucket.
- **Numbers are computed, not asked for.** Urgency is derived from facts the
  validators have already agreed on. Requesting a 0-100 score from the model
  produced `NO_MAJORITY` on sensible-but-different answers.
- **Independent re-derivation.** The validator re-runs both fetches and a
  fresh ruling, then compares `needs_steward`, the urgency band and five
  pivotal facts. It never validates the leader's output by its shape alone.
  Agreeing on a *failed* inquest means raising the same error, not returning
  true: `run_nondet` type-checks the outcome before it reads the boolean.

Ownership boundary: the frontend owns presentation and wallet UX; the contract
owns the evidence snapshot, the ruling, the heartbeat clock and the successor
gate; GitHub supplies raw facts that are never trusted.

## Contract interface

**Writes**

| Method | Purpose |
|---|---|
| `open_inquest(repo)` | run an investigation and record a verdict; permissionless |
| `register_pact(repo, package, policy, successor_handle, successor_addr)` | claim a repository and set its dormancy policy |
| `heartbeat(repo)` | steward proof of life; clears any standing verdict |
| `designate_successor(repo, successor_handle, successor_addr)` | steward-only |

**Views**

| Method | Returns |
|---|---|
| `get_pact(repo)` | full record including verdict and evidence |
| `get_docket(offset, limit)` | paginated records, `limit` capped at 50 |
| `get_index()` | every repository the court has seen |
| `get_stats()` | counters per status |
| `get_default_policy()` | the policy applied to unclaimed repositories |

## Layout

```
contracts/busfactor.py   intelligent contract (GenVM, Python)
tests/direct/            direct-mode tests, no server required
scripts/seed.sh          populate the docket, with retry
web/                     Next.js frontend (Vercel root directory)
```

## Development

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
```

Lint before testing:

```bash
.venv/Scripts/genvm-lint check contracts/busfactor.py
```

```bash
.venv/Scripts/python -m pytest tests/direct -q
```

Deploy to Studio. The account must be funded; the
[faucet](https://testnet-faucet.genlayer.foundation/) issues 100 GEN per day.

```bash
npx genlayer network set studionet
```

```bash
echo "$GENLAYER_KEYSTORE_PASSWORD" | npx genlayer deploy --contract contracts/busfactor.py
```

```bash
GENLAYER_KEYSTORE_PASSWORD=... bash scripts/seed.sh <contract-address>
```

The runner version is pinned in the contract header. `py-genlayer:test` and
`:latest` are local-development aliases that every GenLayer network rejects,
and pinning keeps model behaviour stable across deploys.

## Frontend

```bash
cd web && npm install && npm run dev
```

To deploy: import the repository on Vercel, set **Root Directory** to `web`,
and add the two variables from `web/.env.example`. There are no server secrets;
every write is signed by the visitor's own wallet.

Two details make this work under serverless constraints:

- The read client carries no wallet and runs on the server, so the docket
  renders for visitors who never connect. `genlayer-js` is imported lazily
  inside the click handler so nothing touches `window` during SSR.
- No route handler awaits finality. A serverless function times out long before
  consensus settles, so the browser polls `getTransaction` instead.

wagmi is the wallet adapter, injected-only, so no WalletConnect project id is
required for a fresh deploy.

## Limitations

- **Unauthenticated GitHub API**: 60 requests/hour per IP, two per inquest per
  validator. Sustained testing trips the limit and surfaces as a `[TRANSIENT]`
  failure that all validators agree on. Production would front this with an
  authenticated proxy. An earlier version also read the eight most recently
  updated issues; that list slides between one validator's fetch and the next,
  so derived counts disagreed and inquests on busy repositories came back
  UNDETERMINED. `open_issues_count` answers the same question and holds still.
- **`LEADER_TIMEOUT` is transient.** A leader that misses its deadline is
  rotated and the transaction settles as `IDLE` with no state change; retrying
  is the correct response. Keeping each non-deterministic block small is the
  other half of the fix.
- **Direct-mode tests run the leader function only.** Validator agreement is
  proven on a real network, not locally.

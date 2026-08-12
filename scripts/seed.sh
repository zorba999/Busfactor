#!/usr/bin/env bash
# Seed the docket with real inquests.
#
# LEADER_TIMEOUT is a transient outcome on Bradbury -- a leader that misses its
# deadline is rotated and the transaction settles as IDLE with no state change.
# Retrying is the correct response, so this script retries.
#
#   scripts/seed.sh <contract-address> [repo ...]

set -uo pipefail

CONTRACT="${1:?usage: seed.sh <contract-address> [repo ...]}"
shift

REPOS=("$@")
if [ ${#REPOS[@]} -eq 0 ]; then
  REPOS=(
    "stevemao/left-pad"
    "dominictarr/event-stream"
    "jonschlinkert/is-odd"
    "sindresorhus/slugify"
    "chalk/ansi-regex"
    "vercel/next.js"
  )
fi

PASSWORD="${GENLAYER_KEYSTORE_PASSWORD:?set GENLAYER_KEYSTORE_PASSWORD to your keystore password}"
ATTEMPTS="${SEED_ATTEMPTS:-3}"

for repo in "${REPOS[@]}"; do
  for attempt in $(seq 1 "$ATTEMPTS"); do
    printf '%-32s attempt %s ... ' "$repo" "$attempt"
    out=$(echo "$PASSWORD" | npx --yes genlayer@latest write "$CONTRACT" open_inquest --args "$repo" 2>&1)
    status=$(printf '%s' "$out" | grep -oE "status_name: '[A-Z_]+'" | tail -1 | grep -oE "[A-Z_]+'" | tr -d "'")
    result=$(printf '%s' "$out" | grep -oE "resultName: '[A-Z_]+'" | tail -1 | grep -oE "[A-Z_]+'" | tr -d "'")
    echo "${status:-NO_RECEIPT} / ${result:-?}"

    if [ "$status" = "ACCEPTED" ] || [ "$status" = "FINALIZED" ]; then
      break
    fi
    sleep 25
  done
done

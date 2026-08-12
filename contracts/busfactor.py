# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
BusFactor -- a neutral dormancy court for open source.

The question this contract settles is not "when was the last commit?".
It is "is this package abandoned, or is it simply finished?" -- a judgment
call that no deterministic contract and no oracle can make, because the same
raw numbers (zero commits for two years) describe both a healthy, complete
library and a rotting one with unpatched CVEs.

Consensus boundary
------------------
  Frontend owns   : browsing, wallet UX, formatting, caching, share pages.
  Contract owns   : the evidence snapshot, the verdict, the heartbeat clock,
                    the treasury release condition, and the successor gate.
  GitHub/npm own  : raw facts. They are never trusted -- every validator
                    re-fetches them, re-normalises them into coarse buckets,
                    and re-derives the verdict independently.

Security note
-------------
Automatic handover is the xz/liblzma attack vector. This contract therefore
NEVER hands stewardship to an account the maintainer did not pre-designate
while they were provably alive. With no pre-designated successor the contract
still issues an attestation, but the treasury does not move.
"""

from genlayer import *

import json
from dataclasses import dataclass

# --------------------------------------------------------------------------
# Error classification -- validators need to know which failures are
# deterministic (must match exactly) and which are transient (may differ).
# --------------------------------------------------------------------------

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

GITHUB_API = "https://api.github.com"

HTTP_HEADERS = {
    "User-Agent": "BusFactor-GenLayer-IntelligentContract",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

STATUS_ACTIVE = "ACTIVE"
STATUS_FINISHED = "FINISHED"
STATUS_DORMANT = "DORMANT"
STATUS_ROTTING = "ROTTING"
VALID_STATUSES = (STATUS_ACTIVE, STATUS_FINISHED, STATUS_DORMANT, STATUS_ROTTING)
NEEDS_STEWARD = (STATUS_DORMANT, STATUS_ROTTING)

DEFAULT_POLICY = (
    "Treat this repository as dormant if the maintainer has not shipped a commit "
    "and has not answered an issue or pull request for more than 180 days. "
    "If the library is small and simply complete -- no open bugs, no broken "
    "dependencies -- treat it as finished rather than dormant. "
    "Escalate to rotting only if there are unanswered security-related threads "
    "or the project is visibly broken."
)

DEPRECATION_WORDS = (
    "deprecated",
    "unmaintained",
    "no longer maintained",
    "not maintained",
    "abandoned",
    "archived",
    "looking for a maintainer",
    "looking for maintainers",
    "seeking maintainer",
    "use instead",
)


# --------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------


@allow_storage
@dataclass
class Verdict:
    status: str  # ACTIVE | FINISHED | DORMANT | ROTTING
    urgency: u256  # 0..100, derived from the facts -- never taken from the model
    headline: str
    reasons_json: str  # JSON array of short strings
    evidence_json: str  # normalised, bucketed facts the LLM actually saw
    decided_at: str  # ISO datetime taken from the transaction message
    decided_by: Address  # who paid for the inquest


@allow_storage
@dataclass
class Pact:
    repo: str  # "owner/name", lowercased
    package: str  # optional registry id, e.g. "npm:left-pad"
    steward: Address  # maintainer who registered the pact
    successor_handle: str  # GitHub handle, pre-designated only
    successor_addr: Address
    policy: str  # dormancy policy, written in plain language
    registered: bool  # False for inquest-only repos (no maintainer yet)
    last_heartbeat: str  # ISO datetime of the last proof-of-life
    created_at: str
    inquests: u256
    has_verdict: bool
    verdict: Verdict


# --------------------------------------------------------------------------
# Pure helpers -- deterministic, shared by leader and every validator.
# --------------------------------------------------------------------------


def _err(kind: str, detail: str):
    return gl.vm.UserError(kind + " " + detail)


def _norm_repo(repo: str) -> str:
    cleaned = repo.strip().lower()
    for prefix in ("https://github.com/", "http://github.com/", "github.com/", "www."):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :]
    cleaned = cleaned.strip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    parts = [p for p in cleaned.split("/") if p != ""]
    if len(parts) != 2:
        raise _err(ERROR_EXPECTED, "repo must look like owner/name")
    for part in parts:
        for ch in part:
            if not (ch.isalnum() or ch in "-_."):
                raise _err(ERROR_EXPECTED, "repo contains illegal characters")
    return parts[0] + "/" + parts[1]


def _days_from_civil(y: int, m: int, d: int) -> int:
    """Howard Hinnant's civil-to-days algorithm. No clock, no locale, no drift."""
    y -= 1 if m <= 2 else 0
    era = (y if y >= 0 else y - 399) // 400
    yoe = y - era * 400
    mp = m + (-3 if m > 2 else 9)
    doy = (153 * mp + 2) // 5 + d - 1
    doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468


def _iso_to_days(value) -> int:
    """Convert an ISO-8601 timestamp to a day number. -1 when unparseable."""
    if not isinstance(value, str) or len(value) < 10:
        return -1
    try:
        return _days_from_civil(int(value[0:4]), int(value[5:7]), int(value[8:10]))
    except (ValueError, TypeError):
        return -1


def _age_days(now_iso: str, then_iso) -> int:
    """Whole days between two ISO timestamps. -1 when unknown."""
    now_d = _iso_to_days(now_iso)
    then_d = _iso_to_days(then_iso)
    if now_d < 0 or then_d < 0:
        return -1
    delta = now_d - then_d
    return delta if delta >= 0 else 0


def _age_bucket(days: int) -> str:
    """Coarse buckets. Two validators fetching minutes apart land in the same one."""
    if days < 0:
        return "unknown"
    if days <= 7:
        return "0-7d"
    if days <= 30:
        return "8-30d"
    if days <= 90:
        return "31-90d"
    if days <= 180:
        return "91-180d"
    if days <= 365:
        return "181-365d"
    if days <= 730:
        return "1-2y"
    return "2y+"


def _count_bucket(n: int) -> str:
    if n <= 0:
        return "0"
    if n <= 5:
        return "1-5"
    if n <= 25:
        return "6-25"
    if n <= 100:
        return "26-100"
    return "100+"


def _reach_bucket(n: int) -> str:
    if n < 100:
        return "<100"
    if n < 1000:
        return "100-1k"
    if n < 10000:
        return "1k-10k"
    if n < 50000:
        return "10k-50k"
    return "50k+"


def _urgency_bucket(urgency: int) -> int:
    """Snap 0..100 to steps of 25 so validators are not asked to agree on noise."""
    if urgency < 0:
        urgency = 0
    if urgency > 100:
        urgency = 100
    return (urgency // 25) * 25


def _derive_urgency(evidence: dict, status: str) -> int:
    """Urgency is computed, never asked for.

    An LLM handed a 0-100 scale will answer 55 on one node and 70 on another --
    both perfectly sensible, and a guaranteed NO_MAJORITY once you bucket them.
    So the model rules on the question that needs judgment, and the number is
    derived here from facts every validator has already agreed on.
    """
    if status not in NEEDS_STEWARD:
        return 0
    aggravating = (
        bool(evidence.get("stale_security_thread"))
        or bool(evidence.get("archived"))
        or bool(evidence.get("disabled"))
        or bool(evidence.get("self_declared_deprecated"))
    )
    return 75 if aggravating else 50


def _mentions_deprecation(text) -> bool:
    if not isinstance(text, str):
        return False
    low = text.lower()
    for word in DEPRECATION_WORDS:
        if word in low:
            return True
    return False


def _as_dict(raw) -> dict:
    """exec_prompt(response_format='json') may hand back a dict or raw text."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        text = raw.strip()
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise _err(ERROR_LLM, "model returned no JSON object")
        try:
            parsed = json.loads(text[start : end + 1])
        except ValueError:
            raise _err(ERROR_LLM, "model returned malformed JSON")
        if isinstance(parsed, dict):
            return parsed
    raise _err(ERROR_LLM, "model returned an unexpected shape")


def _pick(data: dict, *names):
    for name in names:
        if name in data and data[name] is not None:
            return data[name]
    return None


ZERO_ADDRESS_BYTES = bytes(20)


def _to_address(value) -> Address:
    """Accept a hex string, raw bytes, or an already-decoded Address."""
    if isinstance(value, Address):
        return value
    if isinstance(value, (bytes, bytearray)):
        return Address(bytes(value)) if len(value) == 20 else Address(ZERO_ADDRESS_BYTES)
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            return Address(ZERO_ADDRESS_BYTES)
        try:
            return Address(text)
        except (ValueError, TypeError):
            raise _err(ERROR_EXPECTED, "successor address is not a valid address")
    return Address(ZERO_ADDRESS_BYTES)


def _to_int(value, fallback: int = 0) -> int:
    try:
        return int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        return fallback


# --------------------------------------------------------------------------
# Evidence gathering -- runs inside the non-deterministic block, on every node.
# --------------------------------------------------------------------------


def _github_json(path: str):
    response = gl.nondet.web.get(GITHUB_API + path, headers=HTTP_HEADERS)
    status = response.status

    if status == 404:
        raise _err(ERROR_EXTERNAL, "github says this repository does not exist")
    if status in (403, 429):
        raise _err(ERROR_TRANSIENT, "github rate limit reached, retry shortly")
    if status >= 500:
        raise _err(ERROR_TRANSIENT, "github is unavailable")
    if status != 200:
        raise _err(ERROR_EXTERNAL, "github returned status " + str(status))
    if response.body is None:
        raise _err(ERROR_TRANSIENT, "github returned an empty body")

    try:
        return json.loads(response.body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise _err(ERROR_TRANSIENT, "github returned unreadable JSON")


def _gather_evidence(repo: str, now_iso: str) -> dict:
    """Fetch raw facts and immediately throw away everything that is not stable.

    Nothing that changes minute-to-minute survives this function: no exact
    timestamps, no exact counts, no ordering. Only buckets and booleans.
    """
    meta = _github_json("/repos/" + repo)
    if not isinstance(meta, dict):
        raise _err(ERROR_EXTERNAL, "github returned an unexpected repository payload")

    owner = meta.get("owner") or {}
    owner_login = str(owner.get("login") or repo.split("/")[0])
    owner_type = str(owner.get("type") or "User")

    # Three round trips, small pages, on purpose. GitHub's event payloads are
    # fat, and a leader that spends its whole deadline parsing JSON inside the
    # VM gets rotated out before it can report -- which reads as a network
    # fault but is really a self-inflicted one. `pushed_at` already carries the
    # last-commit signal, so there is no fourth call for it.
    threads = _github_json(
        "/repos/" + repo + "/issues?state=open&sort=updated&direction=desc&per_page=8"
    )
    stale_threads = 0
    oldest_thread_days = -1
    newest_thread_days = -1
    security_thread_stale = False
    maintainer_replied = False

    if isinstance(threads, list):
        for thread in threads:
            if not isinstance(thread, dict):
                continue
            updated_days = _age_days(now_iso, thread.get("updated_at"))
            created_days = _age_days(now_iso, thread.get("created_at"))
            if created_days > oldest_thread_days:
                oldest_thread_days = created_days
            if newest_thread_days < 0 or (0 <= updated_days < newest_thread_days):
                newest_thread_days = updated_days
            if updated_days > 90:
                stale_threads += 1

            title = str(thread.get("title") or "").lower()
            labels = thread.get("labels") or []
            label_text = ""
            if isinstance(labels, list):
                for label in labels:
                    if isinstance(label, dict):
                        label_text += " " + str(label.get("name") or "").lower()
            blob = title + label_text
            is_security = (
                "security" in blob
                or "cve" in blob
                or "vulnerab" in blob
                or "exploit" in blob
            )
            if is_security and updated_days > 60:
                security_thread_stale = True

            # A proxy, and worth naming as one: this fires when the owner is on
            # a thread that has moved in the last 90 days. Proving they *replied*
            # would need one more request per thread, which is exactly the kind
            # of round-trip budget that gets a leader rotated out.
            thread_author = (thread.get("user") or {}).get("login")
            if str(thread_author or "").lower() == owner_login.lower():
                if 0 <= updated_days <= 90:
                    maintainer_replied = True

    # Is the maintainer gone, or just done with this one project? That single
    # question separates a burned-out human from a finished library, and it is
    # why no timestamp on the repo alone can settle dormancy.
    #
    # The owner's five most recently pushed repositories, newest first. The
    # public events feed answers the same question but ships full commit and
    # issue bodies with it -- for a prolific owner that is megabytes of JSON to
    # parse inside the VM, and the leader dies holding it. This endpoint is a
    # few kilobytes and its timestamps are far steadier across nodes.
    days_since_owner_pushed_elsewhere = -1
    this_repo_is_their_latest = False
    try:
        owned = _github_json(
            "/users/" + owner_login + "/repos?sort=pushed&direction=desc&per_page=5"
        )
    except gl.vm.UserError:
        owned = None

    if isinstance(owned, list):
        for position, item in enumerate(owned):
            if not isinstance(item, dict):
                continue
            full_name = str(item.get("full_name") or "").lower()
            age = _age_days(now_iso, item.get("pushed_at"))
            if full_name == repo:
                if position == 0:
                    this_repo_is_their_latest = True
                continue
            if age >= 0 and (
                days_since_owner_pushed_elsewhere < 0
                or age < days_since_owner_pushed_elsewhere
            ):
                days_since_owner_pushed_elsewhere = age

    if days_since_owner_pushed_elsewhere < 0:
        elsewhere = "none"
    elif days_since_owner_pushed_elsewhere <= 90:
        elsewhere = "high"
    elif days_since_owner_pushed_elsewhere <= 365:
        elsewhere = "low"
    else:
        elsewhere = "none"

    description = str(meta.get("description") or "")

    return {
        "repo": repo,
        "snapshot_day": str(now_iso)[0:10],
        "owner_login": owner_login,
        "owner_type": owner_type,
        "archived": bool(meta.get("archived")),
        "disabled": bool(meta.get("disabled")),
        "is_fork": bool(meta.get("fork")),
        "license": str(((meta.get("license") or {}).get("spdx_id")) or "none"),
        "description": description[:200],
        "stars": _reach_bucket(_to_int(meta.get("stargazers_count"))),
        "forks": _reach_bucket(_to_int(meta.get("forks_count"))),
        "open_threads": _count_bucket(_to_int(meta.get("open_issues_count"))),
        "since_last_push": _age_bucket(_age_days(now_iso, meta.get("pushed_at"))),
        "since_repo_created": _age_bucket(_age_days(now_iso, meta.get("created_at"))),
        "stale_open_threads": _count_bucket(stale_threads),
        "oldest_open_thread_age": _age_bucket(oldest_thread_days),
        "newest_thread_activity": _age_bucket(newest_thread_days),
        "stale_security_thread": security_thread_stale,
        "maintainer_replied_recently": maintainer_replied,
        "maintainer_active_elsewhere": elsewhere,
        "maintainer_active_here": this_repo_is_their_latest,
        "self_declared_deprecated": _mentions_deprecation(description),
    }


def _judge(evidence: dict, policy: str) -> dict:
    """Ask the model the one question that has no formula."""
    prompt = (
        "You are an impartial adjudicator deciding the maintenance status of an "
        "open-source repository. You are given a normalised evidence snapshot. "
        "Every duration is already bucketed -- reason about the buckets, never "
        "invent precise dates, and never use knowledge about this project that "
        "is not in the snapshot.\n\n"
        "MAINTAINER POLICY (written by the maintainer, it overrides the defaults "
        "below wherever the two disagree):\n"
        + policy
        + "\n\nEVIDENCE SNAPSHOT:\n"
        + json.dumps(evidence, sort_keys=True)
        + "\n\nChoose exactly one status:\n"
        '- "ACTIVE": recent commits, or the maintainer is answering threads.\n'
        '- "FINISHED": quiet on purpose. Small or complete scope, few or no open '
        "threads, nothing broken. Silence here is not a defect.\n"
        '- "DORMANT": the maintainer has stopped, work is visibly piling up '
        "(stale threads, unanswered reports), but nothing is dangerous yet.\n"
        '- "ROTTING": dormant AND harmful -- a stale security thread, a '
        "self-declared abandonment with users still depending on it, or an "
        "archived/disabled repository that others still rely on.\n\n"
        "Apply these rules in order and stop at the first one that fires. They "
        "are binding -- do not override them with intuition:\n"
        '1. since_last_push is "0-7d", "8-30d" or "31-90d" -> ACTIVE.\n'
        "2. maintainer_replied_recently is true -> ACTIVE.\n"
        "3. archived is true, or disabled is true, or self_declared_deprecated "
        'is true -> ROTTING if stars is "1k-10k" or "10k-50k" or "50k+", '
        "otherwise DORMANT.\n"
        "4. stale_security_thread is true -> ROTTING.\n"
        '5. stale_open_threads is "0" -> FINISHED.\n'
        "6. otherwise -> DORMANT.\n\n"
        "Respond with JSON only, no prose, no markdown fence:\n"
        '{"status": "ACTIVE|FINISHED|DORMANT|ROTTING", '
        '"headline": "<one sentence, max 140 chars>", '
        '"reasons": ["<short evidence-grounded reason>", "..."]}'
    )

    answer = _as_dict(gl.nondet.exec_prompt(prompt, response_format="json"))

    status = str(_pick(answer, "status", "verdict", "label") or "").strip().upper()
    if status not in VALID_STATUSES:
        raise _err(ERROR_LLM, "model returned unknown status " + status[:32])

    headline = str(_pick(answer, "headline", "summary", "title") or "").strip()
    if headline == "":
        raise _err(ERROR_LLM, "model returned an empty headline")

    raw_reasons = _pick(answer, "reasons", "evidence", "justification") or []
    reasons = []
    if isinstance(raw_reasons, list):
        for reason in raw_reasons[:5]:
            text = str(reason).strip()
            if text != "":
                reasons.append(text[:240])
    if len(reasons) == 0:
        reasons = [headline[:240]]

    return {
        "status": status,
        "urgency": _derive_urgency(evidence, status),
        "headline": headline[:240],
        "reasons": reasons,
    }


def _inquest_leader(repo: str, policy: str, now_iso: str) -> dict:
    evidence = _gather_evidence(repo, now_iso)
    ruling = _judge(evidence, policy)
    return {
        "status": ruling["status"],
        "urgency": ruling["urgency"],
        "headline": ruling["headline"],
        "reasons": ruling["reasons"],
        "evidence": evidence,
    }


# Facts a validator must reproduce exactly. Everything else in the snapshot is
# context for the model, not a consensus surface.
_PIVOTAL_FACTS = (
    "archived",
    "disabled",
    "since_last_push",
    "stale_open_threads",
    "stale_security_thread",
    "maintainer_replied_recently",
    "self_declared_deprecated",
)

def _needs_steward(status) -> bool:
    """The only part of the label that has consequences.

    Validators are asked to agree on this, on the urgency bucket, and on the
    pivotal facts -- not on the adjective. DORMANT versus ROTTING is a shade of
    description; "does this need a new steward" is what arms a handover, so
    that is where consensus belongs. Splitting hairs over the word is how you
    get NO_MAJORITY on a repository everyone actually read the same way.
    """
    return str(status) in NEEDS_STEWARD


def _inquest_validator(leader_result, repo: str, policy: str, now_iso: str) -> bool:
    """Re-run the whole investigation. Never grade the leader on its own answer."""
    if isinstance(leader_result, gl.vm.Return):
        try:
            mine = _inquest_leader(repo, policy, now_iso)
        except gl.vm.UserError:
            # We failed where the leader succeeded -- refuse to rubber-stamp.
            return False

        theirs = leader_result.calldata
        if not isinstance(theirs, dict):
            return False

        if str(theirs.get("status")) not in VALID_STATUSES:
            return False
        if _needs_steward(theirs.get("status")) != _needs_steward(mine["status"]):
            return False
        if _urgency_bucket(_to_int(theirs.get("urgency"))) != mine["urgency"]:
            return False

        their_evidence = theirs.get("evidence")
        if not isinstance(their_evidence, dict):
            return False
        for key in _PIVOTAL_FACTS:
            if their_evidence.get(key) != mine["evidence"].get(key):
                return False
        return True

    # The leader failed. Agree only when we fail the same deterministic way.
    leader_message = ""
    if isinstance(leader_result, gl.vm.UserError):
        leader_message = str(leader_result.message)
    elif isinstance(leader_result, gl.vm.VMError):
        return False

    try:
        _inquest_leader(repo, policy, now_iso)
        return False
    except gl.vm.UserError as mine_error:
        my_message = str(mine_error.message)
        if my_message.startswith(ERROR_EXPECTED) or my_message.startswith(
            ERROR_EXTERNAL
        ):
            return my_message == leader_message
        if my_message.startswith(ERROR_TRANSIENT) and leader_message.startswith(
            ERROR_TRANSIENT
        ):
            return True
        return False


# --------------------------------------------------------------------------
# Contract
# --------------------------------------------------------------------------


class BusFactor(gl.Contract):
    founder: Address
    pacts: TreeMap[str, Pact]
    index: DynArray[str]
    counters: TreeMap[str, u256]

    def __init__(self):
        self.founder = gl.message.sender_address

    # -- internal ----------------------------------------------------------

    @gl.private
    def _now(self) -> str:
        return str(gl.message_raw["datetime"])

    @gl.private
    def _bump(self, key: str, delta: int) -> None:
        current = self.counters.get(key, u256(0))
        nxt = int(current) + delta
        self.counters[key] = u256(nxt if nxt > 0 else 0)

    @gl.private
    def _blank_verdict(self) -> Verdict:
        return Verdict(
            status="",
            urgency=u256(0),
            headline="",
            reasons_json="[]",
            evidence_json="{}",
            decided_at="",
            decided_by=Address(ZERO_ADDRESS_BYTES),
        )

    @gl.private
    def _ensure_pact(self, repo: str) -> Pact:
        if repo in self.pacts:
            return self.pacts[repo]
        now = self._now()
        pact = Pact(
            repo=repo,
            package="",
            steward=Address(ZERO_ADDRESS_BYTES),
            successor_handle="",
            successor_addr=Address(ZERO_ADDRESS_BYTES),
            policy=DEFAULT_POLICY,
            registered=False,
            last_heartbeat="",
            created_at=now,
            inquests=u256(0),
            has_verdict=False,
            verdict=self._blank_verdict(),
        )
        self.pacts[repo] = pact
        self.index.append(repo)
        self._bump("pacts", 1)
        return self.pacts[repo]

    @gl.private
    def _serialize(self, pact: Pact) -> dict:
        return {
            "repo": pact.repo,
            "package": pact.package,
            "steward": pact.steward.as_hex,
            "successor_handle": pact.successor_handle,
            "successor_addr": pact.successor_addr.as_hex,
            "policy": pact.policy,
            "registered": pact.registered,
            "last_heartbeat": pact.last_heartbeat,
            "created_at": pact.created_at,
            "inquests": int(pact.inquests),
            "has_verdict": pact.has_verdict,
            "status": pact.verdict.status,
            "urgency": int(pact.verdict.urgency),
            "headline": pact.verdict.headline,
            "reasons_json": pact.verdict.reasons_json,
            "evidence_json": pact.verdict.evidence_json,
            "decided_at": pact.verdict.decided_at,
            "decided_by": pact.verdict.decided_by.as_hex,
            # Handover is gated on a successor the maintainer named while alive.
            "handover_armed": (
                pact.has_verdict
                and pact.registered
                and pact.successor_handle != ""
                and pact.verdict.status in (STATUS_DORMANT, STATUS_ROTTING)
            ),
        }

    # -- writes ------------------------------------------------------------

    @gl.public.write
    def open_inquest(self, repo: str) -> None:
        """Ask the court whether a repository is abandoned, finished, or rotting.

        Permissionless on purpose: no maintainer has to opt in for the world to
        be able to ask the question, and no server has to stay up to answer it.
        """
        repo_id = _norm_repo(repo)
        pact = self._ensure_pact(repo_id)
        policy = pact.policy
        now = self._now()

        def leader_fn():
            return _inquest_leader(repo_id, policy, now)

        def validator_fn(leader_result) -> bool:
            return _inquest_validator(leader_result, repo_id, policy, now)

        ruling = gl.vm.run_nondet(leader_fn, validator_fn)

        pact = self.pacts[repo_id]
        previous = pact.verdict.status
        status = str(ruling["status"])

        pact.verdict = Verdict(
            status=status,
            urgency=u256(_urgency_bucket(_to_int(ruling["urgency"]))),
            headline=str(ruling["headline"]),
            reasons_json=json.dumps(list(ruling["reasons"])),
            evidence_json=json.dumps(dict(ruling["evidence"]), sort_keys=True),
            decided_at=now,
            decided_by=gl.message.sender_address,
        )
        pact.has_verdict = True
        pact.inquests = u256(int(pact.inquests) + 1)

        if previous != "":
            self._bump("status:" + previous, -1)
        self._bump("status:" + status, 1)
        self._bump("inquests", 1)

    @gl.public.write
    def register_pact(
        self,
        repo: str,
        package: str,
        policy: str,
        successor_handle: str,
        successor_addr: str,
    ) -> None:
        """A maintainer claims a repository and writes their own dormancy policy.

        The successor is named here, while the maintainer is demonstrably alive
        and holding the key. That ordering is the whole anti-takeover design.
        """
        repo_id = _norm_repo(repo)
        pact = self._ensure_pact(repo_id)
        sender = gl.message.sender_address

        if pact.registered and pact.steward != sender:
            raise _err(ERROR_EXPECTED, "this pact already has a steward")

        cleaned_policy = policy.strip()
        if len(cleaned_policy) > 1200:
            raise _err(ERROR_EXPECTED, "policy is too long")

        pact.steward = sender
        pact.registered = True
        pact.package = package.strip()[:120]
        pact.policy = cleaned_policy if cleaned_policy != "" else DEFAULT_POLICY
        pact.successor_handle = successor_handle.strip().lstrip("@")[:80]
        pact.successor_addr = _to_address(successor_addr)
        pact.last_heartbeat = self._now()
        self._bump("registered", 1)

    @gl.public.write
    def heartbeat(self, repo: str) -> None:
        """Proof of life. Resets the clock and clears any standing verdict."""
        repo_id = _norm_repo(repo)
        if repo_id not in self.pacts:
            raise _err(ERROR_EXPECTED, "no pact for this repository")

        pact = self.pacts[repo_id]
        if not pact.registered:
            raise _err(ERROR_EXPECTED, "this pact has no steward")
        if pact.steward != gl.message.sender_address:
            raise _err(ERROR_EXPECTED, "only the steward can send a heartbeat")

        if pact.has_verdict and pact.verdict.status != "":
            self._bump("status:" + pact.verdict.status, -1)
        pact.has_verdict = False
        pact.verdict = self._blank_verdict()
        pact.last_heartbeat = self._now()
        self._bump("heartbeats", 1)

    @gl.public.write
    def designate_successor(
        self, repo: str, successor_handle: str, successor_addr: str
    ) -> None:
        """Only the living steward may name who inherits. Never the claimant."""
        repo_id = _norm_repo(repo)
        if repo_id not in self.pacts:
            raise _err(ERROR_EXPECTED, "no pact for this repository")

        pact = self.pacts[repo_id]
        if not pact.registered or pact.steward != gl.message.sender_address:
            raise _err(ERROR_EXPECTED, "only the steward can designate a successor")

        pact.successor_handle = successor_handle.strip().lstrip("@")[:80]
        pact.successor_addr = _to_address(successor_addr)
        pact.last_heartbeat = self._now()

    # -- views -------------------------------------------------------------

    @gl.public.view
    def get_pact(self, repo: str) -> dict:
        repo_id = _norm_repo(repo)
        if repo_id not in self.pacts:
            return {}
        return self._serialize(self.pacts[repo_id])

    @gl.public.view
    def get_index(self) -> list:
        return [repo for repo in self.index]

    @gl.public.view
    def get_docket(self, offset: int, limit: int) -> list:
        """Paginated board of every repository the court has looked at."""
        total = len(self.index)
        start = max(0, int(offset))
        count = max(0, min(int(limit), 50))
        out = []
        position = start
        while position < total and len(out) < count:
            out.append(self._serialize(self.pacts[self.index[position]]))
            position += 1
        return out

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "pacts": int(self.counters.get("pacts", u256(0))),
            "registered": int(self.counters.get("registered", u256(0))),
            "inquests": int(self.counters.get("inquests", u256(0))),
            "heartbeats": int(self.counters.get("heartbeats", u256(0))),
            "active": int(self.counters.get("status:" + STATUS_ACTIVE, u256(0))),
            "finished": int(self.counters.get("status:" + STATUS_FINISHED, u256(0))),
            "dormant": int(self.counters.get("status:" + STATUS_DORMANT, u256(0))),
            "rotting": int(self.counters.get("status:" + STATUS_ROTTING, u256(0))),
        }

    @gl.public.view
    def get_default_policy(self) -> str:
        return DEFAULT_POLICY

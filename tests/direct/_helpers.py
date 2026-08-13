"""Fixtures and GitHub mock builders for the BusFactor direct-mode tests.

Direct mode runs only the leader function, so these tests cover evidence
normalisation, storage transitions and access control. Validator agreement is
exercised on a real network, not here.
"""

import json
from datetime import datetime, timedelta, timezone

CONTRACT = "contracts/busfactor.py"

NOW = "2026-08-12T09:00:00Z"
_BASE = datetime(2026, 8, 12, 9, 0, 0, tzinfo=timezone.utc)


def iso_days_ago(days: int) -> str:
    return (_BASE - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def repo_meta(**overrides) -> dict:
    meta = {
        "full_name": "acme/widget",
        "owner": {"login": "acme", "type": "User"},
        "description": "A tiny widget library.",
        "archived": False,
        "disabled": False,
        "fork": False,
        "license": {"spdx_id": "MIT"},
        "stargazers_count": 4200,
        "forks_count": 310,
        "open_issues_count": 3,
        "pushed_at": iso_days_ago(400),
        "created_at": iso_days_ago(2600),
    }
    meta.update(overrides)
    return meta


def owned_repo(full_name: str, pushed_days: int) -> dict:
    return {"full_name": full_name, "pushed_at": iso_days_ago(pushed_days)}


def mock_github(direct_vm, meta=None, owned=None):
    """Register the two GitHub calls. Most specific pattern first."""
    direct_vm.mock_web(
        r"api\.github\.com/users/[^/]+/repos",
        {"status": 200, "body": json.dumps(owned if owned is not None else [])},
    )
    direct_vm.mock_web(
        r"api\.github\.com/repos/[^/]+/[^/?]+$",
        {"status": 200, "body": json.dumps(meta if meta is not None else repo_meta())},
    )


def mock_verdict(direct_vm, status: str, urgency: int, headline: str, reasons=None):
    direct_vm.mock_llm(
        r"impartial adjudicator",
        json.dumps(
            {
                "status": status,
                "urgency": urgency,
                "headline": headline,
                "reasons": reasons or ["evidence-grounded reason"],
            }
        ),
    )

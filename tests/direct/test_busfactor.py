import json

from _helpers import (
    iso_days_ago,
    mock_github,
    mock_verdict,
    owned_repo,
    repo_meta,
)


# ---------------------------------------------------------------- input rules


def test_repo_is_normalised_from_a_pasted_url(court, direct_vm):
    mock_github(direct_vm)
    mock_verdict(direct_vm, "FINISHED", 10, "Small library, complete and quiet.")

    court.open_inquest("https://github.com/ACME/Widget.git")

    pact = court.get_pact("acme/widget")
    assert pact["repo"] == "acme/widget"
    assert court.get_index() == ["acme/widget"]


def test_garbage_repo_is_rejected(court, direct_vm):
    with direct_vm.expect_revert("repo must look like owner/name"):
        court.open_inquest("not-a-repo")


# ------------------------------------------------------------------- verdicts


def test_quiet_but_complete_library_is_finished_not_dormant(court, direct_vm):
    """The distinction the whole project exists for: silence is not death."""
    mock_github(
        direct_vm,
        meta=repo_meta(open_issues_count=0, pushed_at=iso_days_ago(900)),
        owned=[owned_repo("acme/other-thing", 4), owned_repo("acme/widget", 900)],
    )
    mock_verdict(
        direct_vm,
        "FINISHED",
        10,
        "Nothing is broken and nothing is pending; the scope is simply complete.",
    )

    court.open_inquest("acme/widget")
    pact = court.get_pact("acme/widget")

    assert pact["status"] == "FINISHED"
    assert pact["has_verdict"] is True
    assert pact["inquests"] == 1

    evidence = json.loads(pact["evidence_json"])
    assert evidence["since_last_push"] == "2y+"
    assert evidence["open_threads"] == "0"
    assert evidence["maintainer_active_elsewhere"] == "high"
    assert evidence["maintainer_active_here"] is False


def test_archived_and_deprecated_surfaces_as_rotting(court, direct_vm):
    mock_github(
        direct_vm,
        meta=repo_meta(
            open_issues_count=64,
            pushed_at=iso_days_ago(500),
            archived=True,
            description="DEPRECATED, no longer maintained.",
        ),
        owned=[],
    )
    mock_verdict(
        direct_vm,
        "ROTTING",
        90,
        "Archived and deprecated while thousands still depend on it.",
        reasons=["archived", "self-declared deprecated"],
    )

    court.open_inquest("acme/widget")
    pact = court.get_pact("acme/widget")

    assert pact["status"] == "ROTTING"
    assert pact["urgency"] == 75  # aggravated by archived + deprecated
    evidence = json.loads(pact["evidence_json"])
    assert evidence["archived"] is True
    assert evidence["self_declared_deprecated"] is True
    assert evidence["open_threads"] == "26-100"
    assert json.loads(pact["reasons_json"])[0] == "archived"


def test_urgency_is_derived_from_facts_not_taken_from_the_model(court, direct_vm):
    """The model's own number is ignored -- it cannot be reproduced across nodes."""
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(3)))
    mock_verdict(direct_vm, "ACTIVE", 95, "Shipping weekly.")

    court.open_inquest("acme/widget")

    assert court.get_pact("acme/widget")["urgency"] == 0


def test_a_plain_dormant_repo_scores_lower_than_an_aggravated_one(court, direct_vm):
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(600)))
    mock_verdict(direct_vm, "DORMANT", 99, "Quiet, but nothing is on fire.")

    court.open_inquest("acme/widget")

    assert court.get_pact("acme/widget")["urgency"] == 50


def test_unknown_status_from_the_model_is_rejected(court, direct_vm):
    mock_github(direct_vm)
    mock_verdict(direct_vm, "PROBABLY_FINE", 10, "shrug")

    with direct_vm.expect_revert("[LLM_ERROR]"):
        court.open_inquest("acme/widget")


def test_self_declared_deprecation_is_picked_up(court, direct_vm):
    mock_github(
        direct_vm,
        meta=repo_meta(description="DEPRECATED - use widget2 instead."),
    )
    mock_verdict(direct_vm, "DORMANT", 60, "The maintainer already said goodbye.")

    court.open_inquest("acme/widget")

    evidence = json.loads(court.get_pact("acme/widget")["evidence_json"])
    assert evidence["self_declared_deprecated"] is True


# ------------------------------------------------------------ external errors


def test_missing_repo_is_an_external_error(court, direct_vm):
    direct_vm.mock_web(r"api\.github\.com/repos/", {"status": 404, "body": "{}"})

    with direct_vm.expect_revert("[EXTERNAL]"):
        court.open_inquest("acme/ghost")


def test_rate_limiting_is_classified_as_transient(court, direct_vm):
    direct_vm.mock_web(r"api\.github\.com/repos/", {"status": 403, "body": "{}"})

    with direct_vm.expect_revert("[TRANSIENT]"):
        court.open_inquest("acme/widget")


def test_a_missing_owner_feed_does_not_sink_the_inquest(court, direct_vm):
    """Owner activity is a nice-to-have signal, not a hard dependency."""
    mock_github(direct_vm)
    direct_vm.mock_web(
        r"api\.github\.com/users/[^/]+/repos", {"status": 404, "body": "{}"}
    )
    mock_verdict(direct_vm, "DORMANT", 55, "Work is piling up.")

    court.open_inquest("acme/widget")

    evidence = json.loads(court.get_pact("acme/widget")["evidence_json"])
    assert evidence["maintainer_active_elsewhere"] == "none"


# ----------------------------------------------------------- pacts & handover


def test_registering_a_pact_stores_policy_and_successor(court, direct_vm, direct_bob):
    court.register_pact(
        "acme/widget",
        "npm:widget",
        "If I go quiet for two seasons, hand it to Sarah.",
        "@sarah-dev",
        direct_bob,
    )

    pact = court.get_pact("acme/widget")
    assert pact["registered"] is True
    assert pact["policy"] == "If I go quiet for two seasons, hand it to Sarah."
    assert pact["successor_handle"] == "sarah-dev"
    assert pact["successor_addr"].lower() == direct_bob.as_hex.lower()
    assert pact["last_heartbeat"].startswith("2026-08-12")


def test_a_second_maintainer_cannot_steal_a_registered_pact(
    court, direct_vm, direct_bob
):
    court.register_pact("acme/widget", "", "", "sarah-dev", direct_bob)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("already has a steward"):
        court.register_pact("acme/widget", "", "", "mallory", direct_bob)


def test_handover_stays_disarmed_without_a_pre_designated_successor(court, direct_vm):
    """The xz lesson: a dormant verdict alone must never move stewardship."""
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(600)))
    mock_verdict(direct_vm, "DORMANT", 70, "Quiet for a year and a half.")

    court.register_pact("acme/widget", "", "", "", "")
    court.open_inquest("acme/widget")

    pact = court.get_pact("acme/widget")
    assert pact["status"] == "DORMANT"
    assert pact["handover_armed"] is False


def test_handover_arms_only_with_a_successor_named_while_alive(
    court, direct_vm, direct_bob
):
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(600)))
    mock_verdict(direct_vm, "DORMANT", 70, "Quiet for a year and a half.")

    court.register_pact("acme/widget", "", "", "sarah-dev", direct_bob)
    court.open_inquest("acme/widget")

    assert court.get_pact("acme/widget")["handover_armed"] is True


# ------------------------------------------------------------------ heartbeat


def test_heartbeat_clears_a_standing_verdict(court, direct_vm, direct_bob):
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(600)))
    mock_verdict(direct_vm, "DORMANT", 70, "Quiet for a year and a half.")

    court.register_pact("acme/widget", "", "", "sarah-dev", direct_bob)
    court.open_inquest("acme/widget")
    assert court.get_stats()["dormant"] == 1

    court.heartbeat("acme/widget")

    pact = court.get_pact("acme/widget")
    assert pact["has_verdict"] is False
    assert pact["status"] == ""
    assert court.get_stats()["dormant"] == 0
    assert court.get_stats()["heartbeats"] == 1


def test_only_the_steward_can_send_a_heartbeat(court, direct_vm, direct_bob):
    court.register_pact("acme/widget", "", "", "sarah-dev", direct_bob)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("only the steward"):
        court.heartbeat("acme/widget")


def test_heartbeat_on_an_unknown_repo_reverts(court, direct_vm):
    with direct_vm.expect_revert("no pact for this repository"):
        court.heartbeat("acme/never-seen")


def test_only_the_steward_can_designate_a_successor(court, direct_vm, direct_bob):
    court.register_pact("acme/widget", "", "", "", "")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("only the steward"):
        court.designate_successor("acme/widget", "mallory", direct_bob)


# ----------------------------------------------------------- docket and stats


def test_docket_paginates_and_stats_track_status_moves(court, direct_vm):
    mock_github(direct_vm)
    mock_verdict(direct_vm, "DORMANT", 60, "Piling up.")
    court.open_inquest("acme/widget")

    direct_vm.clear_mocks()
    mock_github(direct_vm, meta=repo_meta(full_name="other/lib", pushed_at=iso_days_ago(2)))
    mock_verdict(direct_vm, "ACTIVE", 5, "Shipping.")
    court.open_inquest("other/lib")

    assert len(court.get_docket(0, 10)) == 2
    assert court.get_docket(1, 10)[0]["repo"] == "other/lib"
    assert court.get_docket(0, 1)[0]["repo"] == "acme/widget"

    stats = court.get_stats()
    assert stats["pacts"] == 2
    assert stats["inquests"] == 2
    assert stats["dormant"] == 1
    assert stats["active"] == 1


def test_re_running_an_inquest_moves_the_status_counter(court, direct_vm):
    mock_github(direct_vm)
    mock_verdict(direct_vm, "DORMANT", 60, "Piling up.")
    court.open_inquest("acme/widget")

    direct_vm.clear_mocks()
    mock_github(direct_vm, meta=repo_meta(pushed_at=iso_days_ago(1)))
    mock_verdict(direct_vm, "ACTIVE", 5, "Back from the dead.")
    court.open_inquest("acme/widget")

    stats = court.get_stats()
    assert stats["dormant"] == 0
    assert stats["active"] == 1
    assert stats["inquests"] == 2
    assert court.get_pact("acme/widget")["inquests"] == 2


def test_unknown_repo_returns_an_empty_pact(court):
    assert court.get_pact("nobody/nothing") == {}

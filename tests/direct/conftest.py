import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from _helpers import CONTRACT, NOW  # noqa: E402


@pytest.fixture
def court(direct_vm, direct_deploy, direct_alice):
    """A deployed contract with the clock pinned and alice as the caller."""
    direct_vm.warp(NOW)
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    return contract

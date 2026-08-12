"""Test-session shims.

gltest's direct-mode loader writes the VM message to a temp file, dup2s it onto
fd 0, then unlinks it. POSIX allows deleting an open file; Windows does not, so
the unlink raises WinError 32 and every test errors out before it starts.

We tolerate the failed unlink and sweep the temp files at session end.
"""

import os

import pytest

import gltest.direct.loader as _loader

_LEAKED: list[str] = []
_original_inject = _loader._inject_message_to_fd0


def _inject_message_to_fd0_windows_safe(vm):
    real_unlink = os.unlink

    def tolerant_unlink(path):
        try:
            real_unlink(path)
        except PermissionError:
            _LEAKED.append(str(path))

    os.unlink = tolerant_unlink
    try:
        return _original_inject(vm)
    finally:
        os.unlink = real_unlink


_loader._inject_message_to_fd0 = _inject_message_to_fd0_windows_safe


@pytest.fixture(scope="session", autouse=True)
def _sweep_leaked_message_files():
    yield
    for path in _LEAKED:
        try:
            os.unlink(path)
        except OSError:
            pass

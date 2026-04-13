"""Pytest bootstrap configuration.

Ensure mandatory environment variables are set before test collection
and module imports that depend on application settings.
"""

import os
import sys
from pathlib import Path

# Mandatory secret key for settings validation
os.environ.setdefault("SECRET_KEY", "test-secret-key")

# Ensure the real backend/ comes before tests/ in sys.path, otherwise the
# test-side ``tests/infrastructure/external/`` package shadows the real
# ``infrastructure/external/`` and breaks any test that imports from
# ``api.dependencies`` (which transitively pulls in ``infrastructure.external.storage``).
_BACKEND_ROOT = str(Path(__file__).resolve().parent.parent)
_TESTS_ROOT = str(Path(__file__).resolve().parent)
# Push backend/ to the front and shove tests/ to the back so namespace
# resolution prefers real packages over test-side stubs.
for p in (_TESTS_ROOT,):
    while p in sys.path:
        sys.path.remove(p)
if _BACKEND_ROOT in sys.path:
    sys.path.remove(_BACKEND_ROOT)
sys.path.insert(0, _BACKEND_ROOT)
sys.path.append(_TESTS_ROOT)

# Evict any partially loaded shadow packages from the test-side namespace
# (e.g. tests/infrastructure/external/__init__.py picked up first). They
# will be re-imported from the correct path on next ``import``.
for _mod_name in list(sys.modules):
    if _mod_name == "infrastructure" or _mod_name.startswith("infrastructure."):
        _mod = sys.modules[_mod_name]
        _path = getattr(_mod, "__file__", None) or ""
        if "/tests/" in _path:
            del sys.modules[_mod_name]

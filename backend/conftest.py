# input: 无（pytest 自动加载）
# output: pytest rootdir-level sys.path 修复（确保 backend/ 优先于 tests/）
# owner: wanhua.gu
# pos: 测试根 conftest - 解决 tests/infrastructure/external/ 命名空间包遮蔽真实 infrastructure/external/ 的问题；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Backend rootdir conftest.

Loaded by pytest BEFORE any test collection so that ``backend/`` is the first
entry on ``sys.path`` — preventing ``tests/infrastructure/external/`` (which
exists for ``agent_sdk`` test fixtures) from shadowing the real package.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Mandatory secret key for settings validation (mirror tests/conftest.py)
os.environ.setdefault("SECRET_KEY", "test-secret-key")

_BACKEND_ROOT = str(Path(__file__).resolve().parent)
_TESTS_ROOT = str(Path(__file__).resolve().parent / "tests")

# Ensure backend/ comes first
while _BACKEND_ROOT in sys.path:
    sys.path.remove(_BACKEND_ROOT)
sys.path.insert(0, _BACKEND_ROOT)

# Push tests/ to the back so namespace lookups land on real packages
while _TESTS_ROOT in sys.path:
    sys.path.remove(_TESTS_ROOT)
sys.path.append(_TESTS_ROOT)

# Eagerly load the real infrastructure.external.* tree so it's cached in
# sys.modules before any test file's own imports trigger a (shadowed) lookup.
import infrastructure  # noqa: E402, F401
import infrastructure.external  # noqa: E402, F401
import infrastructure.external.agent_sdk  # noqa: E402, F401
import infrastructure.external.storage  # noqa: E402, F401

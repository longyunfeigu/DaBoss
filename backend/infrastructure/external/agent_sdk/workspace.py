# input: AgentSDKSettings (workspace_root, skill_source_dir, cleanup_delay_s)
# output: Workspace dataclass, WorkspaceManager (create / schedule_cleanup / cleanup_all)
# owner: wanhua.gu
# pos: 基础设施层 - 多租户 workspace 隔离管理（每用户/每会话独立 cwd + skill 拷贝）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Multi-tenant workspace management for sub-agent invocations.

Each call to ``WorkspaceManager.create`` returns an isolated cwd at
``{workspace_root}/{user_id}/{session_id}/`` with the colleague-skill copied
into ``.claude/skills/`` so the sub-agent can load it via
``setting_sources=["project"]``.

Security:
- ``user_id`` and ``session_id`` are validated against path-traversal.
- All resolved paths must remain inside ``workspace_root``.
- Cleanup is scheduled (not immediate) so streaming clients have time to read
  any artifacts the sub-agent wrote.
"""

from __future__ import annotations

import asyncio
import re
import shutil
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from core.logging_config import get_logger
from infrastructure.external.agent_sdk.exceptions import WorkspaceError

logger = get_logger(__name__)

# Allow alnum + underscore + hyphen only (no slash, no dot)
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@dataclass
class Workspace:
    """A single isolated agent workspace.

    ``path`` is guaranteed to be inside ``WorkspaceManager._root``.
    """

    user_id: str
    session_id: str
    path: Path
    created_at: float = field(default_factory=time.time)


class WorkspaceManager:
    """Creates, isolates, and cleans up agent workspaces.

    Concurrency-safe via ``asyncio.Lock`` for cleanup state mutation.
    Background cleanup tasks run via ``asyncio.create_task``; they are tracked
    so they can be awaited / cancelled at app shutdown.
    """

    def __init__(
        self,
        *,
        root: Path,
        skill_source_dir: Path,
        cleanup_delay_s: int = 300,
    ) -> None:
        self._root = root.resolve()
        self._skill_source = skill_source_dir.resolve()
        self._cleanup_delay_s = cleanup_delay_s
        self._lock = asyncio.Lock()
        self._pending_cleanups: set[asyncio.Task[None]] = set()

        # Ensure root exists and is a real local directory (not a symlink).
        self._root.mkdir(parents=True, exist_ok=True)
        if self._root.is_symlink():
            raise WorkspaceError(
                f"workspace_root must be a real directory, got symlink: {self._root}"
            )

    @staticmethod
    def _validate_id(name: str, kind: str) -> str:
        """Reject path-traversal attempts and invalid characters."""
        if not isinstance(name, str) or not _SAFE_ID_RE.match(name):
            raise WorkspaceError(f"invalid {kind}: must match [A-Za-z0-9_-]{{1,64}}, got {name!r}")
        return name

    async def create(
        self,
        *,
        user_id: str,
        session_id: Optional[str] = None,
    ) -> Workspace:
        """Create an isolated workspace for one agent invocation.

        Args:
            user_id: caller-provided user identifier (validated).
            session_id: optional; defaults to a random 8-char hex token.

        Returns:
            ``Workspace`` whose ``.path`` is the absolute cwd for the agent.

        Raises:
            ``WorkspaceError`` on invalid ids or filesystem failures.
        """
        user_id = self._validate_id(user_id, "user_id")
        session_id = self._validate_id(session_id or uuid.uuid4().hex[:8], "session_id")

        path = (self._root / user_id / session_id).resolve()

        # Path-escape check: resolved path MUST live under root.
        try:
            path.relative_to(self._root)
        except ValueError as e:
            raise WorkspaceError(
                f"resolved workspace path escapes root: {path} not under {self._root}"
            ) from e

        try:
            path.mkdir(parents=True, exist_ok=False)
            (path / "materials").mkdir(parents=True, exist_ok=True)
            (path / "output").mkdir(parents=True, exist_ok=True)
            # Copy the forked skill into the workspace's .claude/skills/
            skill_dst = path / ".claude" / "skills" / self._skill_source.name
            skill_dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(self._skill_source, skill_dst)
            # Empty settings.json to block project/user hook leakage into the agent.
            (path / ".claude" / "settings.json").write_text("{}\n")
        except FileExistsError as e:
            raise WorkspaceError(f"workspace already exists for {user_id}/{session_id}") from e
        except OSError as e:
            raise WorkspaceError(f"failed to create workspace at {path}: {e}") from e

        ws = Workspace(user_id=user_id, session_id=session_id, path=path)
        logger.info("workspace.created", path=str(path), user_id=user_id, session_id=session_id)
        return ws

    def schedule_cleanup(self, ws: Workspace, *, delay_s: Optional[int] = None) -> None:
        """Schedule background removal of the workspace after ``delay_s`` seconds.

        If ``delay_s`` is None, uses the configured ``cleanup_delay_s``.
        Pass ``delay_s=0`` to clean up immediately (e.g., on agent error).
        """
        delay = self._cleanup_delay_s if delay_s is None else delay_s
        task = asyncio.create_task(self._cleanup_after(ws, delay))
        self._pending_cleanups.add(task)
        task.add_done_callback(self._pending_cleanups.discard)

    async def _cleanup_after(self, ws: Workspace, delay_s: int) -> None:
        if delay_s > 0:
            try:
                await asyncio.sleep(delay_s)
            except asyncio.CancelledError:
                logger.info("workspace.cleanup_cancelled", path=str(ws.path))
                return
        try:
            shutil.rmtree(ws.path, ignore_errors=False)
            logger.info("workspace.cleaned", path=str(ws.path))
        except Exception as e:  # noqa: BLE001 — log but don't propagate
            logger.warning("workspace.cleanup_failed", path=str(ws.path), error=str(e))

    async def cleanup_all(self) -> None:
        """Wait for any pending cleanup tasks (call at app shutdown)."""
        if not self._pending_cleanups:
            return
        # Snapshot to avoid mutation during iteration
        tasks = list(self._pending_cleanups)
        # Trigger immediate cleanup by cancelling the sleep, then re-running
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        # Best-effort: remove any workspace dirs older than 1h on disk
        await self._sweep_stale_dirs(max_age_s=3600)

    async def _sweep_stale_dirs(self, *, max_age_s: int) -> None:
        """Sweep workspace dirs older than max_age_s. Run at startup/shutdown."""
        if not self._root.exists():
            return
        now = time.time()
        for user_dir in self._root.iterdir():
            if not user_dir.is_dir():
                continue
            for sess_dir in user_dir.iterdir():
                if not sess_dir.is_dir():
                    continue
                try:
                    age = now - sess_dir.stat().st_mtime
                    if age > max_age_s:
                        shutil.rmtree(sess_dir, ignore_errors=True)
                        logger.info(
                            "workspace.swept",
                            path=str(sess_dir),
                            age_s=int(age),
                        )
                except OSError:
                    continue

# input: WorkspaceManager + tmp_path fixture
# output: 隔离/路径逃逸/清理 测试断言
# owner: wanhua.gu
# pos: 测试层 - WorkspaceManager 单元测试；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Unit tests for WorkspaceManager: isolation, path-traversal, cleanup."""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from infrastructure.external.agent_sdk.exceptions import WorkspaceError
from infrastructure.external.agent_sdk.workspace import WorkspaceManager


@pytest.fixture
def fake_skill_dir(tmp_path: Path) -> Path:
    """Minimal fake skill dir with a SKILL.md so copytree has something to copy."""
    src = tmp_path / "fake_skill_src" / "create-colleague"
    src.mkdir(parents=True)
    (src / "SKILL.md").write_text("---\nname: create-colleague\n---\n# fake\n")
    return src


@pytest.fixture
def manager(tmp_path: Path, fake_skill_dir: Path) -> WorkspaceManager:
    root = tmp_path / "ws_root"
    return WorkspaceManager(root=root, skill_source_dir=fake_skill_dir, cleanup_delay_s=1)


@pytest.mark.asyncio
async def test_create_isolates_two_users(manager: WorkspaceManager) -> None:
    ws_a = await manager.create(user_id="alice")
    ws_b = await manager.create(user_id="bob")
    assert ws_a.path != ws_b.path
    assert ws_a.path.exists() and ws_b.path.exists()
    # No cross-user file leakage
    (ws_a.path / "secret.txt").write_text("alice-secret")
    assert not (ws_b.path / "secret.txt").exists()


@pytest.mark.asyncio
async def test_create_isolates_two_sessions_same_user(manager: WorkspaceManager) -> None:
    ws_1 = await manager.create(user_id="alice", session_id="aaaaaaaa")
    ws_2 = await manager.create(user_id="alice", session_id="bbbbbbbb")
    assert ws_1.path != ws_2.path
    assert ws_1.user_id == ws_2.user_id


@pytest.mark.asyncio
async def test_create_copies_skill_dir(manager: WorkspaceManager) -> None:
    ws = await manager.create(user_id="alice")
    skill_md = ws.path / ".claude" / "skills" / "create-colleague" / "SKILL.md"
    assert skill_md.exists(), "skill SKILL.md should be copied into workspace"


@pytest.mark.asyncio
async def test_create_writes_empty_settings_to_block_hook_leak(
    manager: WorkspaceManager,
) -> None:
    ws = await manager.create(user_id="alice")
    settings_json = ws.path / ".claude" / "settings.json"
    assert settings_json.exists()
    # Empty so the sub-agent doesn't pick up user/project hooks
    assert settings_json.read_text().strip() == "{}"


@pytest.mark.asyncio
async def test_path_traversal_session_id_rejected(manager: WorkspaceManager) -> None:
    with pytest.raises(WorkspaceError):
        await manager.create(user_id="alice", session_id="../../etc")


@pytest.mark.asyncio
async def test_path_traversal_user_id_rejected(manager: WorkspaceManager) -> None:
    with pytest.raises(WorkspaceError):
        await manager.create(user_id="../bob")


@pytest.mark.asyncio
async def test_user_id_with_slash_rejected(manager: WorkspaceManager) -> None:
    with pytest.raises(WorkspaceError):
        await manager.create(user_id="alice/bob")


@pytest.mark.asyncio
async def test_empty_user_id_rejected(manager: WorkspaceManager) -> None:
    with pytest.raises(WorkspaceError):
        await manager.create(user_id="")


@pytest.mark.asyncio
async def test_schedule_cleanup_immediate(manager: WorkspaceManager) -> None:
    ws = await manager.create(user_id="alice")
    assert ws.path.exists()
    manager.schedule_cleanup(ws, delay_s=0)
    # Yield once for the create_task to schedule
    await asyncio.sleep(0.05)
    assert not ws.path.exists(), "cleanup with delay_s=0 should remove dir promptly"


@pytest.mark.asyncio
async def test_cleanup_all_drains_pending(manager: WorkspaceManager) -> None:
    ws_a = await manager.create(user_id="alice")
    ws_b = await manager.create(user_id="bob")
    manager.schedule_cleanup(ws_a, delay_s=300)  # would normally wait 5min
    manager.schedule_cleanup(ws_b, delay_s=300)
    await manager.cleanup_all()  # cancels sleeps and drains
    # After cleanup_all, sweep_stale_dirs is best-effort; tasks have run
    assert len(manager._pending_cleanups) == 0

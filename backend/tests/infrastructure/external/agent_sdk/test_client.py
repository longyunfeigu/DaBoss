# input: AgentSkillClient + 模拟的 query() 协程 + tmp_path workspace
# output: 超时/异常/隔离/semaphore 测试断言
# owner: wanhua.gu
# pos: 测试层 - AgentSkillClient 单元测试（mock 掉 SDK）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Unit tests for AgentSkillClient (with SDK query mocked)."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from core.config import AgentSDKSettings
from infrastructure.external.agent_sdk.client import AgentSkillClient
from infrastructure.external.agent_sdk.exceptions import (
    AgentRunError,
    AgentTimeoutError,
)
from infrastructure.external.agent_sdk.workspace import WorkspaceManager


@dataclass
class SystemMessage:
    subtype: str
    data: dict[str, Any]


@dataclass
class TextBlock:
    text: str


@dataclass
class AssistantMessage:
    content: list[Any]
    model: str = "claude-opus-4-6"


@dataclass
class ResultMessage:
    subtype: str = "success"
    is_error: bool = False
    duration_ms: int = 100
    duration_api_ms: int = 90
    num_turns: int = 1
    session_id: str = "s1"


@pytest.fixture
def fake_skill_dir(tmp_path: Path) -> Path:
    src = tmp_path / "fake_skill_src" / "create-colleague"
    src.mkdir(parents=True)
    (src / "SKILL.md").write_text("---\nname: create-colleague\n---\n")
    return src


@pytest.fixture
def settings(tmp_path: Path, fake_skill_dir: Path) -> AgentSDKSettings:
    return AgentSDKSettings(
        anthropic_api_key=None,  # mocked SDK won't actually call out
        anthropic_base_url=None,
        workspace_root=tmp_path / "ws_root",
        agent_timeout_s=5,
        cleanup_delay_s=0,
        max_concurrent_builds=2,
        skill_source_dir=fake_skill_dir,
        allowed_tools=["Skill", "Read"],
    )


@pytest.fixture
def manager(settings: AgentSDKSettings) -> WorkspaceManager:
    return WorkspaceManager(
        root=settings.workspace_root,
        skill_source_dir=settings.skill_source_dir,
        cleanup_delay_s=settings.cleanup_delay_s,
    )


@pytest.fixture
def client(settings: AgentSDKSettings, manager: WorkspaceManager) -> AgentSkillClient:
    return AgentSkillClient(settings=settings, workspace_mgr=manager)


def _make_query_mock(events: list[Any]):
    """Return an async-iterable fake of claude_agent_sdk.query."""

    async def fake_query(*, prompt: str, options: Any):  # noqa: ARG001
        for ev in events:
            await asyncio.sleep(0)  # yield control like a real stream would
            yield ev

    return fake_query


def _make_query_raises(exc: Exception):
    async def fake_query(*, prompt: str, options: Any):  # noqa: ARG001
        if False:  # make this an async generator
            yield  # pragma: no cover
        raise exc

    return fake_query


def _make_query_blocks_forever():
    async def fake_query(*, prompt: str, options: Any):  # noqa: ARG001
        if False:
            yield  # pragma: no cover
        await asyncio.sleep(3600)

    return fake_query


def test_build_prompt_tells_agent_to_reuse_existing_output_dir(
    client: AgentSkillClient,
) -> None:
    prompt = client._build_prompt(["meeting transcript"])

    assert "The `output/` directory already exists" in prompt
    assert "Do NOT create or overwrite the `output/` directory itself" in prompt
    assert "write exactly one file: `output/persona.md`" in prompt


@pytest.mark.asyncio
async def test_build_persona_yields_adapted_events(client: AgentSkillClient) -> None:
    fake_events = [
        SystemMessage(subtype="init", data={}),
        AssistantMessage(content=[TextBlock("done.")]),
        ResultMessage(),
    ]
    with patch("claude_agent_sdk.query", _make_query_mock(fake_events)):
        events = []
        async for ev in client.build_persona(user_id="alice", materials=["hi"]):
            events.append(ev)

    assert len(events) == 4
    assert events[0].type == "workspace_ready"
    assert events[1].type == "system"
    assert events[2].type == "assistant_text"
    assert events[3].type == "result"
    # seq monotonically increasing
    assert [e.seq for e in events] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_build_persona_writes_materials_to_workspace(
    client: AgentSkillClient, settings: AgentSDKSettings
) -> None:
    captured_cwd: list[str] = []

    async def fake_query(*, prompt: str, options: Any):
        captured_cwd.append(options.cwd)
        # Verify materials exist on disk during the agent run
        mat_path = Path(options.cwd) / "materials"
        files = sorted(p.name for p in mat_path.iterdir())
        assert files == ["0.txt", "1.txt"]
        assert (mat_path / "0.txt").read_text() == "first material"
        assert (mat_path / "1.txt").read_text() == "second"
        yield ResultMessage()

    with patch("claude_agent_sdk.query", fake_query):
        async for _ in client.build_persona(
            user_id="alice", materials=["first material", "second"]
        ):
            pass

    assert len(captured_cwd) == 1
    # cwd is under settings.workspace_root
    assert str(settings.workspace_root) in captured_cwd[0]


@pytest.mark.asyncio
async def test_build_persona_timeout_raises_and_cleans_up(
    client: AgentSkillClient, settings: AgentSDKSettings
) -> None:
    settings_short = AgentSDKSettings(**{**settings.model_dump(), "agent_timeout_s": 1})
    mgr = WorkspaceManager(
        root=settings_short.workspace_root,
        skill_source_dir=settings_short.skill_source_dir,
        cleanup_delay_s=0,
    )
    short_client = AgentSkillClient(settings=settings_short, workspace_mgr=mgr)

    with patch("claude_agent_sdk.query", _make_query_blocks_forever()):
        with pytest.raises(AgentTimeoutError):
            async for _ in short_client.build_persona(user_id="alice", materials=["x"]):
                pass

    # Wait for cleanup to fire
    await asyncio.sleep(0.1)
    # workspace_root should still exist but no children dirs
    user_dir = settings_short.workspace_root / "alice"
    if user_dir.exists():
        sessions = list(user_dir.iterdir())
        assert sessions == [], "timeout path should clean up workspace immediately"


@pytest.mark.asyncio
async def test_build_persona_sdk_error_wraps_as_agent_run_error(
    client: AgentSkillClient,
) -> None:
    with patch("claude_agent_sdk.query", _make_query_raises(RuntimeError("CLI crashed"))):
        with pytest.raises(AgentRunError) as exc_info:
            async for _ in client.build_persona(user_id="alice", materials=["x"]):
                pass
    assert exc_info.value.cause_type == "RuntimeError"
    assert "CLI crashed" in str(exc_info.value.original)


@pytest.mark.asyncio
async def test_empty_materials_rejected(client: AgentSkillClient) -> None:
    with pytest.raises(AgentRunError):
        async for _ in client.build_persona(user_id="alice", materials=[]):
            pass


@pytest.mark.asyncio
async def test_env_is_patched_during_run_and_restored_after(
    client: AgentSkillClient, settings: AgentSDKSettings
) -> None:
    # Use a real-looking key via SecretStr
    from pydantic import SecretStr

    settings_with_key = AgentSDKSettings(
        **{
            **settings.model_dump(),
            "anthropic_api_key": SecretStr("sk-test-secret"),
            "anthropic_base_url": "http://10.0.3.248:3000/api",
        }
    )
    mgr = WorkspaceManager(
        root=settings_with_key.workspace_root,
        skill_source_dir=settings_with_key.skill_source_dir,
        cleanup_delay_s=0,
    )
    keyed_client = AgentSkillClient(settings=settings_with_key, workspace_mgr=mgr)

    seen_during_run: dict[str, str] = {}

    async def fake_query(*, prompt: str, options: Any):  # noqa: ARG001
        seen_during_run["key"] = os.environ.get("ANTHROPIC_API_KEY", "")
        seen_during_run["url"] = os.environ.get("ANTHROPIC_BASE_URL", "")
        yield ResultMessage()

    # Snapshot env before
    pre_key = os.environ.get("ANTHROPIC_API_KEY")
    pre_url = os.environ.get("ANTHROPIC_BASE_URL")

    with patch("claude_agent_sdk.query", fake_query):
        async for _ in keyed_client.build_persona(user_id="alice", materials=["x"]):
            pass

    # Inside the run, env was set
    assert seen_during_run["key"] == "sk-test-secret"
    assert seen_during_run["url"] == "http://10.0.3.248:3000/api"

    # After the run, env is restored to prior values
    assert os.environ.get("ANTHROPIC_API_KEY") == pre_key
    assert os.environ.get("ANTHROPIC_BASE_URL") == pre_url


@pytest.mark.asyncio
async def test_semaphore_limits_concurrent_builds(
    settings: AgentSDKSettings, fake_skill_dir: Path
) -> None:
    # max_concurrent_builds=2, so 3rd call should wait until one releases
    settings_2 = AgentSDKSettings(**{**settings.model_dump(), "max_concurrent_builds": 2})
    mgr = WorkspaceManager(
        root=settings_2.workspace_root,
        skill_source_dir=settings_2.skill_source_dir,
        cleanup_delay_s=0,
    )
    cli = AgentSkillClient(settings=settings_2, workspace_mgr=mgr)

    in_flight = 0
    max_in_flight = 0

    async def fake_query(*, prompt: str, options: Any):  # noqa: ARG001
        nonlocal in_flight, max_in_flight
        in_flight += 1
        max_in_flight = max(max_in_flight, in_flight)
        await asyncio.sleep(0.05)
        in_flight -= 1
        yield ResultMessage()

    async def run_one(uid: str) -> None:
        async for _ in cli.build_persona(user_id=uid, materials=["x"]):
            pass

    with patch("claude_agent_sdk.query", fake_query):
        await asyncio.gather(*[run_one(f"u{i:02d}") for i in range(5)])

    assert max_in_flight <= 2, f"semaphore breached: {max_in_flight} concurrent"

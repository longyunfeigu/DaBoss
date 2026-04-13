# input: 模拟的 SDK 原始事件对象
# output: adapt_event / AgentEvent 字段断言
# owner: wanhua.gu
# pos: 测试层 - AgentEvent 适配器单元测试；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Unit tests for adapt_event: maps SDK raw types to unified AgentEvent."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from infrastructure.external.agent_sdk.events import (
    EVENT_ASSISTANT_TEXT,
    EVENT_RESULT,
    EVENT_SYSTEM,
    EVENT_TOOL_USE,
    EVENT_UNKNOWN,
    adapt_event,
)


# --- minimal stand-ins for SDK message types (duck-typed by class name) ---


@dataclass
class SystemMessage:
    subtype: str
    data: dict[str, Any]


@dataclass
class TextBlock:
    text: str


@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]


@dataclass
class AssistantMessage:
    content: list[Any]
    model: Optional[str] = None
    parent_tool_use_id: Optional[str] = None


@dataclass
class ResultMessage:
    subtype: str
    is_error: bool
    duration_ms: int
    duration_api_ms: int
    num_turns: int
    session_id: str


# --- tests ---


def test_system_message_maps_to_system_type() -> None:
    raw = SystemMessage(subtype="init", data={"cwd": "/tmp/x"})
    ev = adapt_event(raw, seq=1)
    assert ev.type == EVENT_SYSTEM
    assert ev.raw_subtype == "init"
    assert ev.payload["data"]["cwd"] == "/tmp/x"
    assert ev.seq == 1


def test_assistant_text_only_message() -> None:
    raw = AssistantMessage(content=[TextBlock("Hello world")], model="claude-opus-4-6")
    ev = adapt_event(raw, seq=2)
    assert ev.type == EVENT_ASSISTANT_TEXT
    assert ev.payload["text"] == "Hello world"
    assert ev.payload["model"] == "claude-opus-4-6"


def test_assistant_tool_use_message() -> None:
    raw = AssistantMessage(
        content=[ToolUseBlock(id="t1", name="Read", input={"path": "x.txt"})],
        model="claude-opus-4-6",
    )
    ev = adapt_event(raw, seq=3)
    assert ev.type == EVENT_TOOL_USE
    assert len(ev.payload["tool_uses"]) == 1
    assert ev.payload["tool_uses"][0]["name"] == "Read"
    assert ev.payload["tool_uses"][0]["input"] == {"path": "x.txt"}


def test_assistant_text_alongside_tool_use_classified_as_tool_use() -> None:
    """If a turn has both text and a tool call, prioritize tool_use type."""
    raw = AssistantMessage(
        content=[
            TextBlock("Let me check that file."),
            ToolUseBlock(id="t1", name="Read", input={"path": "x.txt"}),
        ]
    )
    ev = adapt_event(raw, seq=4)
    assert ev.type == EVENT_TOOL_USE
    assert "Let me check that file." in ev.payload["text_parts"]


def test_result_message_extracts_metrics() -> None:
    raw = ResultMessage(
        subtype="success",
        is_error=False,
        duration_ms=8523,
        duration_api_ms=8445,
        num_turns=1,
        session_id="abc-123",
    )
    ev = adapt_event(raw, seq=5)
    assert ev.type == EVENT_RESULT
    assert ev.payload["is_error"] is False
    assert ev.payload["duration_ms"] == 8523
    assert ev.payload["duration_api_ms"] == 8445
    assert ev.payload["num_turns"] == 1
    assert ev.payload["session_id"] == "abc-123"


def test_unknown_message_falls_through_safely() -> None:
    class WeirdNewMessageType:
        pass

    raw = WeirdNewMessageType()
    ev = adapt_event(raw, seq=99)
    assert ev.type == EVENT_UNKNOWN
    assert ev.payload["raw_class"] == "WeirdNewMessageType"
    assert "WeirdNewMessageType" in ev.payload["repr"]
    assert ev.seq == 99


def test_seq_is_preserved_across_events() -> None:
    seqs = [adapt_event(SystemMessage("init", {}), seq=i).seq for i in (1, 2, 3, 10, 100)]
    assert seqs == [1, 2, 3, 10, 100]

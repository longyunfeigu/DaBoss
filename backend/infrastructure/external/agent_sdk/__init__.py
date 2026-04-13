# input: AgentSDKSettings (from core.config)
# output: AgentSkillClient, WorkspaceManager, AgentEvent, exception types
# owner: wanhua.gu
# pos: 基础设施层 - Claude Agent SDK 集成入口（Epic 2 / Story 2.1）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Claude Agent SDK integration package.

Public surface (only Application layer should import these):

- ``AgentSkillClient`` — main entrypoint, ``async def build_persona(...)``.
- ``WorkspaceManager`` — multi-tenant cwd management.
- ``AgentEvent`` — unified event envelope for the SDK's raw event stream.
- exception types: ``AgentSDKError``, ``AgentTimeoutError``, ``AgentRunError``,
  ``WorkspaceError``.

The raw ``claude_agent_sdk`` package MUST NOT be imported outside this module.
"""

from infrastructure.external.agent_sdk.client import AgentSkillClient
from infrastructure.external.agent_sdk.events import AgentEvent
from infrastructure.external.agent_sdk.exceptions import (
    AgentRunError,
    AgentSDKError,
    AgentTimeoutError,
    WorkspaceError,
)
from infrastructure.external.agent_sdk.workspace import Workspace, WorkspaceManager

__all__ = [
    "AgentSkillClient",
    "AgentEvent",
    "AgentSDKError",
    "AgentTimeoutError",
    "AgentRunError",
    "WorkspaceError",
    "Workspace",
    "WorkspaceManager",
]

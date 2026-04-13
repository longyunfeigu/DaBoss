# input: 无
# output: AgentSDKError 及子异常（AgentTimeoutError / AgentRunError / WorkspaceError）
# owner: wanhua.gu
# pos: 基础设施层 - Agent SDK 集成的异常类层次；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Exception hierarchy for the Claude Agent SDK integration.

All exceptions raised by this module derive from ``AgentSDKError`` so callers
can catch one type to handle any agent failure.
"""

from __future__ import annotations

from typing import Optional


class AgentSDKError(Exception):
    """Base class for all Agent SDK integration errors."""


class AgentTimeoutError(AgentSDKError):
    """Raised when the sub-agent exceeds its execution time budget."""

    def __init__(self, *, timeout_s: int, elapsed_s: float) -> None:
        super().__init__(f"Agent execution timed out after {elapsed_s:.1f}s (limit={timeout_s}s)")
        self.timeout_s = timeout_s
        self.elapsed_s = elapsed_s


class AgentRunError(AgentSDKError):
    """Raised when the sub-agent fails for a non-timeout reason.

    ``cause_type`` is the original exception's class name; ``original`` is the
    exception instance for callers that need richer details. ``message`` is a
    human-readable summary.
    """

    def __init__(
        self,
        message: str,
        *,
        cause_type: Optional[str] = None,
        original: Optional[BaseException] = None,
    ) -> None:
        super().__init__(message)
        self.cause_type = cause_type
        self.original = original


class WorkspaceError(AgentSDKError):
    """Raised when workspace creation, cleanup, or path-resolution fails.

    Includes path-traversal detection (e.g., ``session_id="../../etc"``).
    """

# input: AgentSDKSettings (from settings.agent_sdk)
# output: init_agent_sdk_client / get_agent_sdk_client / shutdown_agent_sdk_client
# owner: wanhua.gu
# pos: 基础设施层 - Agent SDK 模块的应用生命周期钩子（在 main.py lifespan 中调用）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""App-lifecycle hooks for the Agent SDK module.

Constructs a singleton ``AgentSkillClient`` at startup; cleans up workspace
state at shutdown.
"""

from __future__ import annotations

from typing import Optional

from core.config import settings
from core.logging_config import get_logger
from infrastructure.external.agent_sdk.client import AgentSkillClient
from infrastructure.external.agent_sdk.workspace import WorkspaceManager

logger = get_logger(__name__)

_client: Optional[AgentSkillClient] = None
_workspace_mgr: Optional[WorkspaceManager] = None


async def init_agent_sdk_client() -> None:
    """Construct the singleton AgentSkillClient + WorkspaceManager.

    Logs warning (does not raise) if the SDK or its config is unusable, so the
    rest of the app can boot. Endpoints that depend on it should fail fast at
    request-time via ``get_agent_sdk_client``.
    """
    global _client, _workspace_mgr
    if _client is not None:
        return

    cfg = settings.agent_sdk
    try:
        # Late import so the SDK is only loaded if this module is actually used.
        # (claude_agent_sdk pulls in ~10 transitive deps.)
        import claude_agent_sdk  # noqa: F401  — proves package is installed

        _workspace_mgr = WorkspaceManager(
            root=cfg.workspace_root,
            skill_source_dir=cfg.skill_source_dir,
            cleanup_delay_s=cfg.cleanup_delay_s,
        )
        _client = AgentSkillClient(settings=cfg, workspace_mgr=_workspace_mgr)

        # Best-effort: sweep stale dirs from a previous process crash
        await _workspace_mgr._sweep_stale_dirs(max_age_s=3600)

        logger.info(
            "agent_sdk_initialized",
            workspace_root=str(cfg.workspace_root),
            skill_source=str(cfg.skill_source_dir),
            timeout_s=cfg.agent_timeout_s,
            max_concurrent=cfg.max_concurrent_builds,
        )
    except Exception as exc:  # noqa: BLE001 — log but don't block app boot
        logger.error("agent_sdk_init_failed", error=str(exc), error_type=type(exc).__name__)


def get_agent_sdk_client() -> AgentSkillClient:
    """Return the initialized client. Raises if init failed or wasn't called."""
    if _client is None:
        raise RuntimeError(
            "AgentSkillClient not initialized. Did app lifespan call init_agent_sdk_client()?"
        )
    return _client


async def shutdown_agent_sdk_client() -> None:
    """Drain pending workspace cleanups and reset module state."""
    global _client, _workspace_mgr
    if _workspace_mgr is not None:
        try:
            await _workspace_mgr.cleanup_all()
        except Exception as exc:  # noqa: BLE001
            logger.warning("agent_sdk_cleanup_warning", error=str(exc))
    _client = None
    _workspace_mgr = None
    logger.info("agent_sdk_shutdown")

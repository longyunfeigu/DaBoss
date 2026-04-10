# input: core.config.settings.voice, MiniMax SDK
# output: init_tts_client, shutdown_tts_client, get_tts_client, init_stt_client, shutdown_stt_client, get_stt_client 生命周期函数
# owner: wanhua.gu
# pos: 基础设施层 - 语音客户端(TTS/STT)生命周期管理；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Voice client (TTS / STT) lifecycle management."""

from __future__ import annotations

from typing import Optional

from application.ports.stt import STTPort
from application.ports.tts import TTSPort
from core.config import settings
from core.logging_config import get_logger

logger = get_logger(__name__)

_tts_client: Optional[TTSPort] = None
_stt_client: Optional[STTPort] = None


# ---- TTS ----


async def init_tts_client() -> None:
    """Initialize the TTS client based on configuration."""
    global _tts_client

    if _tts_client is not None:
        logger.warning("TTS client already initialized")
        return

    voice_cfg = settings.voice
    if not voice_cfg.tts_api_key:
        logger.warning(
            "tts_client_skipped",
            reason="VOICE__TTS_API_KEY not configured; TTS features will be unavailable",
        )
        return

    try:
        if voice_cfg.tts_provider == "minimax":
            from .minimax_tts import MinimaxTTSProvider

            _tts_client = MinimaxTTSProvider(
                api_key=voice_cfg.tts_api_key,
                model=voice_cfg.tts_model,
                **({"base_url": voice_cfg.tts_base_url} if voice_cfg.tts_base_url else {}),
            )
        elif voice_cfg.tts_provider == "elevenlabs":
            from .elevenlabs_tts import ElevenLabsTTSProvider

            _tts_client = ElevenLabsTTSProvider(
                api_key=voice_cfg.tts_api_key,
                model=voice_cfg.tts_model or "eleven_multilingual_v2",
                **({"base_url": voice_cfg.tts_base_url} if voice_cfg.tts_base_url else {}),
            )
        else:
            raise ValueError(f"Unknown TTS provider: {voice_cfg.tts_provider}")

        logger.info(
            "tts_client_initialized",
            provider=voice_cfg.tts_provider,
            model=voice_cfg.tts_model,
        )
    except Exception as exc:
        logger.error("tts_client_init_failed", error=str(exc))
        raise


def get_tts_client() -> Optional[TTSPort]:
    """Get the TTS client instance (may be None if not configured)."""
    return _tts_client


async def shutdown_tts_client() -> None:
    """Shutdown the TTS client."""
    global _tts_client

    if _tts_client is None:
        return

    try:
        close = getattr(_tts_client, "close", None)
        if close:
            await close()
        logger.info("tts_client_shutdown")
    except Exception as exc:
        logger.error("tts_client_shutdown_failed", error=str(exc))
    finally:
        _tts_client = None


# ---- STT ----


async def init_stt_client() -> None:
    """Initialize the STT client based on configuration."""
    global _stt_client

    if _stt_client is not None:
        logger.warning("STT client already initialized")
        return

    voice_cfg = settings.voice
    if not voice_cfg.stt_api_key:
        logger.warning(
            "stt_client_skipped",
            reason="VOICE__STT_API_KEY not configured; STT features will be unavailable",
        )
        return

    try:
        if voice_cfg.stt_provider in ("minimax", "whisper"):
            from .minimax_stt import MinimaxSTTProvider

            _stt_client = MinimaxSTTProvider(
                api_key=voice_cfg.stt_api_key,
                base_url=voice_cfg.stt_base_url or "https://api.openai.com/v1",
                model=voice_cfg.stt_model,
            )
        else:
            raise ValueError(f"Unknown STT provider: {voice_cfg.stt_provider}")

        logger.info("stt_client_initialized", provider=voice_cfg.stt_provider)
    except Exception as exc:
        logger.error("stt_client_init_failed", error=str(exc))
        raise


def get_stt_client() -> Optional[STTPort]:
    """Get the STT client instance (may be None if not configured)."""
    return _stt_client


async def shutdown_stt_client() -> None:
    """Shutdown the STT client."""
    global _stt_client

    if _stt_client is None:
        return

    try:
        close = getattr(_stt_client, "close", None)
        if close:
            await close()
        logger.info("stt_client_shutdown")
    except Exception as exc:
        logger.error("stt_client_shutdown_failed", error=str(exc))
    finally:
        _stt_client = None


__all__ = [
    "init_tts_client",
    "get_tts_client",
    "shutdown_tts_client",
    "init_stt_client",
    "get_stt_client",
    "shutdown_stt_client",
]

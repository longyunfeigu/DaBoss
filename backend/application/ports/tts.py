# input: 文本 + 语音配置
# output: TTSPort Protocol — 文字转语音抽象接口, TTSConfig 语音配置
# owner: wanhua.gu
# pos: 应用层端口 - TTS 文字转语音抽象接口；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Application-owned TTS port abstraction (hexagonal architecture).

Defines the minimal protocol needed by application use cases so that
the application layer does not depend on specific TTS provider details.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, Protocol, runtime_checkable


@dataclass
class TTSConfig:
    """Configuration for a single TTS synthesis request."""

    voice_id: str
    speed: float = 1.0
    volume: float = 1.0
    pitch: float = 0.0
    style_instruction: Optional[str] = None


@runtime_checkable
class TTSPort(Protocol):
    """Port for text-to-speech synthesis."""

    async def synthesize_stream(
        self,
        text: str,
        config: TTSConfig,
    ) -> AsyncIterator[bytes]:
        """Stream audio chunks for the given text.

        Args:
            text: Text to synthesize.
            config: Voice configuration (voice_id, speed, style, etc.).

        Yields:
            Audio bytes in mp3 format.
        """
        ...

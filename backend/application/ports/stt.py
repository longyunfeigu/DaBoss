# input: 音频字节流
# output: STTPort Protocol — 语音转文字抽象接口
# owner: wanhua.gu
# pos: 应用层端口 - STT 语音转文字抽象接口；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Application-owned STT port abstraction (hexagonal architecture).

Defines the minimal protocol needed by application use cases so that
the application layer does not depend on specific STT provider details.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable


@dataclass
class TranscriptionResult:
    """Result of a speech-to-text transcription."""

    text: str
    language: Optional[str] = None
    duration_seconds: Optional[float] = None


@runtime_checkable
class STTPort(Protocol):
    """Port for speech-to-text transcription."""

    async def transcribe(
        self,
        audio: bytes,
        *,
        language: str = "zh",
        audio_format: str = "webm",
    ) -> TranscriptionResult:
        """Transcribe audio bytes to text.

        Args:
            audio: Raw audio bytes.
            language: Language hint (BCP-47 or short code).
            audio_format: Audio format (webm, wav, mp3, opus).

        Returns:
            TranscriptionResult with transcribed text.
        """
        ...

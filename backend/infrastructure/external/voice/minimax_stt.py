# input: OpenAI Whisper-compatible API (可配置 base_url)
# output: MinimaxSTTProvider — 实现 STTPort 的语音转文字（使用 OpenAI Whisper 兼容格式）
# owner: wanhua.gu
# pos: 基础设施层 - STT 提供者实现（OpenAI Whisper 兼容）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""STT provider using OpenAI Whisper-compatible API.

Note: MiniMax does not offer a standalone STT API. This provider uses
the OpenAI Whisper API format which is supported by OpenAI, Azure,
and many compatible gateways.
"""

from __future__ import annotations

import logging

import httpx

from application.ports.stt import TranscriptionResult

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "https://api.openai.com/v1"


class MinimaxSTTProvider:
    """STT provider using OpenAI Whisper-compatible transcription API.

    Despite the name, this uses OpenAI Whisper format since MiniMax
    lacks a standalone STT endpoint. The base_url is configurable
    to support any Whisper-compatible gateway.
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = _DEFAULT_BASE_URL,
        model: str = "whisper-1",
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
        )

    async def transcribe(
        self,
        audio: bytes,
        *,
        language: str = "zh",
        audio_format: str = "webm",
    ) -> TranscriptionResult:
        """Transcribe audio using Whisper-compatible API.

        Args:
            audio: Raw audio bytes.
            language: Language hint (e.g., "zh", "en").
            audio_format: Audio format for the file extension hint.

        Returns:
            TranscriptionResult with transcribed text.
        """
        url = f"{self._base_url}/audio/transcriptions"

        # Whisper API expects multipart form data
        files = {
            "file": (f"audio.{audio_format}", audio, f"audio/{audio_format}"),
        }
        data = {
            "model": self._model,
            "language": language,
            "response_format": "json",
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
        }

        response = await self._client.post(
            url,
            files=files,
            data=data,
            headers=headers,
        )

        if response.status_code != 200:
            logger.error(
                "stt_transcribe_error",
                status=response.status_code,
                body=response.text[:500],
            )
            raise RuntimeError(
                f"STT transcription failed with status {response.status_code}: {response.text[:200]}"
            )

        result = response.json()
        text = result.get("text", "").strip()

        return TranscriptionResult(
            text=text,
            language=language,
            duration_seconds=result.get("duration"),
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

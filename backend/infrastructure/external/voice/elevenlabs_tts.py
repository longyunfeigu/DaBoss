# input: ElevenLabs TTS Streaming API (api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream)
# output: ElevenLabsTTSProvider — 实现 TTSPort 的 ElevenLabs TTS 流式合成
# owner: wanhua.gu
# pos: 基础设施层 - ElevenLabs TTS 提供者实现（HTTP 流式）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""ElevenLabs TTS provider using HTTP streaming API.

Uses POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream
to return chunked mp3 audio incrementally.
"""

from __future__ import annotations

import logging
from typing import AsyncIterator

import httpx

from application.ports.tts import TTSConfig

logger = logging.getLogger(__name__)

_DEFAULT_BASE_URL = "https://api.elevenlabs.io"


class ElevenLabsTTSProvider:
    """ElevenLabs TTS provider with HTTP streaming support."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "eleven_multilingual_v2",
        base_url: str = _DEFAULT_BASE_URL,
        output_format: str = "mp3_44100_128",
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._output_format = output_format
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
        )

    async def synthesize_stream(
        self,
        text: str,
        config: TTSConfig,
    ) -> AsyncIterator[bytes]:
        """Stream audio chunks from ElevenLabs TTS.

        Yields mp3 audio bytes as they arrive from the streaming API.
        """
        url = f"{self._base_url}/v1/text-to-speech" f"/{config.voice_id}/stream"

        payload: dict = {
            "text": text,
            "model_id": self._model,
            "output_format": self._output_format,
        }

        # Voice settings
        voice_settings: dict = {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "speed": config.speed,
        }
        payload["voice_settings"] = voice_settings

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }

        async with self._client.stream(
            "POST",
            url,
            json=payload,
            headers=headers,
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                logger.error(
                    "elevenlabs_tts_error",
                    status=response.status_code,
                    body=body.decode("utf-8", errors="replace")[:500],
                )
                raise RuntimeError(
                    f"ElevenLabs TTS request failed with status {response.status_code}"
                )

            # ElevenLabs streams raw audio bytes (chunked transfer encoding)
            async for chunk in response.aiter_bytes(chunk_size=8192):
                if chunk:
                    yield chunk

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

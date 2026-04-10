# input: MiniMax TTS HTTP Streaming API (api.minimax.io/v1/t2a_v2)
# output: MinimaxTTSProvider — 实现 TTSPort 的 MiniMax TTS 流式合成
# owner: wanhua.gu
# pos: 基础设施层 - MiniMax TTS 提供者实现（HTTP 流式）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""MiniMax TTS provider using HTTP streaming API.

Uses POST https://api.minimax.io/v1/t2a_v2 with stream=true
to return audio chunks incrementally.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx

from application.ports.tts import TTSConfig

logger = logging.getLogger(__name__)

# MiniMax TTS HTTP streaming endpoint
_DEFAULT_BASE_URL = "https://api.minimax.chat"
_T2A_PATH = "/v1/t2a_v2"


def _extract_group_id_from_jwt(api_key: str) -> str | None:
    """Extract GroupID from a MiniMax JWT token."""
    import base64

    try:
        parts = api_key.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1]
        # Add base64 padding
        payload += "=" * (4 - len(payload) % 4)
        data = json.loads(base64.b64decode(payload))
        return data.get("GroupID")
    except Exception:
        return None


class MinimaxTTSProvider:
    """MiniMax TTS provider with HTTP streaming support."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "speech-2.8-hd",
        base_url: str = _DEFAULT_BASE_URL,
        group_id: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._group_id = group_id or _extract_group_id_from_jwt(api_key)
        self._timeout = timeout
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=10.0),
        )

    async def synthesize_stream(
        self,
        text: str,
        config: TTSConfig,
    ) -> AsyncIterator[bytes]:
        """Stream audio chunks from MiniMax TTS.

        Yields mp3 audio bytes as they arrive from the streaming API.
        """
        url = f"{self._base_url}{_T2A_PATH}"
        if self._group_id:
            url = f"{url}?GroupId={self._group_id}"

        payload = {
            "model": self._model,
            "text": text,
            "stream": True,
            "voice_setting": {
                "voice_id": config.voice_id,
                "speed": config.speed,
                "vol": config.volume,
                "pitch": int(config.pitch),
            },
            "audio_setting": {
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1,
            },
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
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
                    "minimax_tts_error",
                    status=response.status_code,
                    body=body.decode("utf-8", errors="replace")[:500],
                )
                raise RuntimeError(f"MiniMax TTS request failed with status {response.status_code}")

            # MiniMax streaming returns newline-delimited JSON, each containing
            # hex-encoded audio in data.audio and status in data.status
            buffer = b""
            async for raw_chunk in response.aiter_bytes():
                buffer += raw_chunk
                # Process complete lines
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    line_str = line.decode("utf-8", errors="replace").strip()
                    if not line_str:
                        continue
                    # Handle SSE-style "data: " prefix
                    if line_str.startswith("data:"):
                        line_str = line_str[5:].strip()
                    if not line_str:
                        continue
                    try:
                        chunk_data = json.loads(line_str)
                    except json.JSONDecodeError:
                        continue

                    # Check for errors
                    base_resp = chunk_data.get("base_resp", {})
                    if base_resp.get("status_code", 0) != 0:
                        logger.error(
                            "minimax_tts_stream_error",
                            code=base_resp.get("status_code"),
                            msg=base_resp.get("status_msg"),
                        )
                        continue

                    # Extract hex-encoded audio
                    data = chunk_data.get("data", {})
                    audio_hex = data.get("audio")
                    if audio_hex:
                        try:
                            audio_bytes = bytes.fromhex(audio_hex)
                            yield audio_bytes
                        except ValueError:
                            logger.warning("minimax_tts_hex_decode_error")

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

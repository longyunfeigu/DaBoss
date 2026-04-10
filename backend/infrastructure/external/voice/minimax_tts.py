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


def _normalize_stream_audio(audio_hex: str, previous_hex: str) -> tuple[bytes | None, str]:
    """Normalize MiniMax streaming audio payloads into incremental bytes.

    MiniMax's HTTP streaming endpoint may emit either:
    1. incremental audio chunks, or
    2. repeated / cumulative snapshots of the full audio generated so far.

    To keep downstream playback stable, convert cumulative snapshots into the
    newly appended suffix and skip exact duplicates.
    """
    if not audio_hex:
        return None, previous_hex

    if previous_hex and audio_hex == previous_hex:
        return None, previous_hex

    normalized_hex = audio_hex
    if previous_hex and audio_hex.startswith(previous_hex):
        normalized_hex = audio_hex[len(previous_hex) :]

    if not normalized_hex:
        return None, audio_hex

    try:
        return bytes.fromhex(normalized_hex), audio_hex
    except ValueError:
        logger.warning("minimax_tts_hex_decode_error")
        return None, previous_hex


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

            # MiniMax streaming returns newline-delimited JSON with status codes.
            # In real responses, status=1 frames are partial stream fragments,
            # while status=2 carries the final complete audio snapshot. Because
            # the application layer only forwards a single complete mp3 per
            # sentence, prefer status=2 and only fall back to incremental parts
            # if the final snapshot is missing.
            buffer = b""
            last_audio_hex = ""
            fallback_parts: list[bytes] = []
            emitted_final = False
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
                    status = data.get("status")
                    audio_hex = data.get("audio")
                    if audio_hex:
                        if status == 2:
                            final_audio, _ = _normalize_stream_audio(audio_hex, "")
                            if final_audio:
                                emitted_final = True
                                yield final_audio
                            continue

                        audio_bytes, last_audio_hex = _normalize_stream_audio(
                            audio_hex,
                            last_audio_hex,
                        )
                        if audio_bytes:
                            fallback_parts.append(audio_bytes)

            if not emitted_final and fallback_parts:
                yield b"".join(fallback_parts)

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

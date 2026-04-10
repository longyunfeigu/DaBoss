"""Integration test for MiniMax TTS provider.

Run with: cd backend && uv run python tests/test_voice_integration.py
"""

import asyncio
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from infrastructure.external.voice.minimax_tts import MinimaxTTSProvider
from application.ports.tts import TTSConfig


async def test_tts():
    """Test MiniMax TTS streaming synthesis."""
    # Load API key from .env manually
    from dotenv import load_dotenv

    load_dotenv()

    api_key = os.getenv("VOICE__TTS_API_KEY")
    if not api_key:
        print("SKIP: VOICE__TTS_API_KEY not set")
        return

    model = os.getenv("VOICE__TTS_MODEL", "speech-2.8-hd")
    print(f"Testing MiniMax TTS with model={model}")

    provider = MinimaxTTSProvider(api_key=api_key, model=model)

    config = TTSConfig(
        voice_id="male-qn-qingse",
        speed=1.0,
    )

    text = "你好，我是技术总监。关于这个季度的预算，我需要看到更详细的数据支撑。"
    print(f"Synthesizing: {text}")

    audio_chunks = []
    chunk_count = 0
    try:
        async for chunk in provider.synthesize_stream(text, config):
            audio_chunks.append(chunk)
            chunk_count += 1
            print(f"  Received chunk #{chunk_count}: {len(chunk)} bytes")
    except Exception as e:
        print(f"ERROR: {e}")
        await provider.close()
        return

    total_bytes = sum(len(c) for c in audio_chunks)
    print(f"\nResult: {chunk_count} chunks, {total_bytes} bytes total")

    if total_bytes > 0:
        # Save to file for manual verification
        output_path = "/tmp/test_tts_output.mp3"
        with open(output_path, "wb") as f:
            for chunk in audio_chunks:
                f.write(chunk)
        print(f"Audio saved to {output_path}")
        print("SUCCESS: TTS synthesis working!")
    else:
        print("FAIL: No audio data received")

    await provider.close()


if __name__ == "__main__":
    asyncio.run(test_tts())

# input: LLM streaming tokens (逐 token 输入)
# output: SentenceBuffer — 按句子边界切分 LLM 流式输出
# owner: wanhua.gu
# pos: 应用层 - LLM 流式输出句子边界检测器（用于 TTS 管道）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""SentenceBuffer: accumulate LLM streaming tokens and emit complete sentences.

Used in the TTS pipeline to feed whole sentences to TTS synthesis,
rather than waiting for the entire reply to finish.
"""

from __future__ import annotations


# Punctuation marks that indicate a sentence boundary
_SENTENCE_ENDS = frozenset("。！？；.!?\n")

# Minimum characters before we consider emitting (avoids tiny fragments)
_MIN_SENTENCE_LEN = 4


class SentenceBuffer:
    """Accumulate LLM tokens and emit on sentence boundaries."""

    def __init__(self, *, min_length: int = _MIN_SENTENCE_LEN) -> None:
        self._buffer = ""
        self._min_length = min_length

    def feed(self, token: str) -> str | None:
        """Feed a token into the buffer.

        Returns a complete sentence if a boundary was detected,
        otherwise returns None.
        """
        self._buffer += token

        # Check for newline boundary (split on first newline)
        if "\n" in self._buffer:
            before, after = self._buffer.split("\n", 1)
            before = before.strip()
            if before and len(before) >= self._min_length:
                self._buffer = after
                return before
            # If before is too short, keep buffering
            if not before:
                self._buffer = after

        # Check if the last character is a sentence-ending punctuation
        stripped = self._buffer.strip()
        if stripped and stripped[-1] in _SENTENCE_ENDS and len(stripped) >= self._min_length:
            self._buffer = ""
            return stripped
        return None

    def flush(self) -> str | None:
        """Flush remaining content (call when LLM stream ends).

        Returns any remaining text, or None if the buffer is empty.
        """
        remaining = self._buffer.strip()
        self._buffer = ""
        if remaining:
            return remaining
        return None

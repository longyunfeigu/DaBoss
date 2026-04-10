# input: SentenceBuffer
# output: 单元测试
# owner: wanhua.gu
# pos: 测试 - SentenceBuffer 句子切分逻辑；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Unit tests for SentenceBuffer."""

import pytest

from application.services.stakeholder.sentence_buffer import SentenceBuffer


def _feed_text(buf: SentenceBuffer, text: str) -> list[str]:
    """Feed text char by char and collect emitted sentences."""
    results = []
    for ch in text:
        s = buf.feed(ch)
        if s:
            results.append(s)
    remaining = buf.flush()
    if remaining:
        results.append(remaining)
    return results


class TestSentenceBuffer:
    def test_chinese_punctuation(self):
        buf = SentenceBuffer()
        sentences = _feed_text(buf, "你好，我是技术总监。关于预算的问题，需要讨论。")
        assert sentences == ["你好，我是技术总监。", "关于预算的问题，需要讨论。"]

    def test_english_punctuation(self):
        buf = SentenceBuffer()
        sentences = _feed_text(buf, "Hello world. How are you?")
        assert sentences == ["Hello world.", "How are you?"]

    def test_mixed_punctuation(self):
        buf = SentenceBuffer()
        sentences = _feed_text(buf, "这是第一句！This is second.")
        assert sentences == ["这是第一句！", "This is second."]

    def test_flush_remaining(self):
        buf = SentenceBuffer()
        sentences = _feed_text(buf, "完整句子。这是未完成的")
        assert sentences == ["完整句子。", "这是未完成的"]

    def test_empty_input(self):
        buf = SentenceBuffer()
        assert buf.flush() is None

    def test_newline_as_boundary(self):
        buf = SentenceBuffer()
        sentences = _feed_text(buf, "这是第一段内容\n这是第二段内容")
        assert len(sentences) == 2
        assert sentences[0] == "这是第一段内容"
        assert sentences[1] == "这是第二段内容"

    def test_short_fragment_not_emitted(self):
        """Fragments shorter than min_length wait for more content."""
        buf = SentenceBuffer(min_length=6)
        result = buf.feed("好。")
        assert result is None  # Too short, buffered
        result = buf.flush()
        assert result == "好。"

    def test_multi_token_feed(self):
        """Simulates LLM tokens that are multi-char."""
        buf = SentenceBuffer()
        results = []
        tokens = ["你好", "，我是", "技术总监", "。", "关于预算"]
        for t in tokens:
            s = buf.feed(t)
            if s:
                results.append(s)
        remaining = buf.flush()
        if remaining:
            results.append(remaining)
        assert results == ["你好，我是技术总监。", "关于预算"]

    def test_emotion_tag_stripped_on_flush(self):
        """Emotion tag at end of LLM output should not be emitted."""
        buf = SentenceBuffer()
        sentences = _feed_text(buf, '好的，我理解了。<!--emotion:{"score":3,"label":"认可"}-->')
        assert sentences == ["好的，我理解了。"]

    def test_emotion_tag_only(self):
        """If the only remaining content is an emotion tag, flush returns None."""
        buf = SentenceBuffer()
        sentences = _feed_text(buf, '<!--emotion:{"score":-2,"label":"不满"}-->')
        assert sentences == []

    def test_emotion_tag_after_sentence(self):
        """Emotion tag following a sentence boundary is stripped."""
        buf = SentenceBuffer()
        text = '这个方案很好！我非常支持。<!--emotion:{"score":5,"label":"支持"}-->'
        sentences = _feed_text(buf, text)
        assert sentences == ["这个方案很好！", "我非常支持。"]

    def test_partial_emotion_tag_held(self):
        """Partial emotion tag should be held in buffer, not emitted."""
        buf = SentenceBuffer()
        # Simulate tokens arriving one-by-one including partial tag
        result = buf.feed("好的，收到了。")
        assert result == "好的，收到了。"
        result = buf.feed("<!--emot")
        assert result is None  # Held because of partial tag
        result = buf.feed('ion:{"score":1,"label":"ok"}-->')
        assert result is None  # Complete tag, but nothing meaningful left
        remaining = buf.flush()
        assert remaining is None

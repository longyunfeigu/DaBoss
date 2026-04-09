# input: AbstractUnitOfWork, LLMPort, PersonaLoader, StakeholderSettings
# output: CompressionService 后台对话历史压缩服务
# owner: wanhua.gu
# pos: 应用层服务 - 对话历史语义压缩（后台异步，不阻塞聊天）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Background service for compressing conversation history into summaries.

Uses LLM to generate concise summaries of older messages, enabling
efficient context window usage. Compression runs proactively after
each AI reply, never blocking user-facing chat flow.
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

from application.ports.llm import LLMMessage, LLMPort
from core.config import settings
from domain.common.unit_of_work import AbstractUnitOfWork
from domain.stakeholder.entity import Message

logger = logging.getLogger(__name__)

_COMPRESSION_SYSTEM_PROMPT = """\
你是一个对话历史压缩助手。你的任务是将对话历史压缩为简洁但信息保留的摘要。

## 规则
1. 保留所有关键信息：每个参与者的核心立场、态度变化、关键决策和承诺
2. 保留情绪变化轨迹：谁从反对变为支持，或从支持变为反对
3. 保留未解决的分歧和悬而未决的问题
4. 保留具体的数字、日期、人名等关键细节
5. 使用第三人称叙述，清晰标注每个发言者
6. 摘要长度应控制在原文的 20%-30%
7. 如果提供了旧摘要，将其与新消息整合为一个完整摘要，而非简单拼接

## 输出格式
直接输出摘要文本，不要加任何前缀或标题。使用以下结构：
- 先用 1-2 句话概括对话的整体主题和进展
- 然后按时间顺序列出关键事件和立场变化
- 最后总结当前状态（各方立场、未决问题）
"""


class CompressionService:
    """Generates and persists compressed conversation summaries."""

    def __init__(
        self,
        uow_factory: Callable[..., AbstractUnitOfWork],
        llm: LLMPort,
        persona_loader=None,
    ) -> None:
        self._uow_factory = uow_factory
        self._llm = llm
        self._persona_loader = persona_loader

    async def maybe_compress(self, room_id: int) -> None:
        """Check if compression is needed and run it if so.

        Called after each successful AI reply. Only executes the LLM
        compression call when total message count exceeds the threshold
        and there are unsummarized messages beyond the recent window.
        """
        window = settings.stakeholder.context_window_size
        threshold = settings.stakeholder.compression_threshold

        async with self._uow_factory(readonly=True) as uow:
            room = await uow.chat_room_repository.get_by_id(room_id)
            if room is None:
                return
            total = await uow.stakeholder_message_repository.count_by_room_id(room_id)

        if total <= threshold:
            return

        # Load all messages to determine the compression boundary
        async with self._uow_factory(readonly=True) as uow:
            all_messages = await uow.stakeholder_message_repository.list_by_room_id(
                room_id, limit=total
            )

        if len(all_messages) <= window:
            return

        # Messages older than the recent window need summarizing
        boundary_index = len(all_messages) - window
        messages_to_summarize = all_messages[:boundary_index]
        boundary_message_id = messages_to_summarize[-1].id

        # Already summarized up to this point?
        if room.summary_up_to_message_id and room.summary_up_to_message_id >= boundary_message_id:
            return

        # Determine newly unsummarized messages
        if room.summary_up_to_message_id:
            new_messages = [
                m for m in messages_to_summarize if m.id > room.summary_up_to_message_id
            ]
        else:
            new_messages = messages_to_summarize

        if not new_messages:
            return

        await self._run_compression(
            room_id=room_id,
            existing_summary=room.context_summary,
            messages_to_compress=new_messages,
            up_to_message_id=boundary_message_id,
        )

    async def _run_compression(
        self,
        room_id: int,
        existing_summary: Optional[str],
        messages_to_compress: list[Message],
        up_to_message_id: int,
    ) -> None:
        """Execute the LLM compression call and persist the result."""
        lines: list[str] = []
        for msg in messages_to_compress:
            if msg.sender_type == "system":
                continue
            label = self._get_sender_label(msg.sender_id, msg.sender_type)
            lines.append(f"[{label}]: {msg.content}")

        new_content = "\n\n".join(lines)

        if existing_summary:
            user_prompt = (
                f"## 已有摘要\n\n{existing_summary}\n\n"
                f"## 新增对话内容（需要整合到摘要中）\n\n{new_content}"
            )
        else:
            user_prompt = f"## 对话内容\n\n{new_content}"

        try:
            response = await self._llm.generate(
                [
                    LLMMessage(role="system", content=_COMPRESSION_SYSTEM_PROMPT),
                    LLMMessage(role="user", content=user_prompt),
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            summary = response.content.strip()
        except Exception:
            logger.exception("Compression LLM call failed for room %d", room_id)
            return

        async with self._uow_factory() as uow:
            await uow.chat_room_repository.update_context_summary(
                room_id, summary, up_to_message_id
            )

        logger.info(
            "Compressed history for room %d up to message %d (%d chars)",
            room_id,
            up_to_message_id,
            len(summary),
        )

    def _get_sender_label(self, sender_id: str, sender_type: str) -> str:
        if sender_type == "user":
            return "用户"
        if self._persona_loader:
            persona = self._persona_loader.get_persona(sender_id)
            if persona:
                return persona.name
        return sender_id

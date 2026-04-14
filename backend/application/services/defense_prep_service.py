# input: AbstractUnitOfWork, LLMPort, DocumentParser, ChatRoomApplicationService, PersonaLoader
# output: DefensePrepService 答辩准备编排服务
# owner: wanhua.gu
# pos: 应用层服务 - 答辩准备（文档解析→策略生成→模拟→评估）；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Defense Prep service: document-based Q&A simulation workflow."""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Callable, Optional

from application.ports.document_parser import DocumentParser
from application.ports.llm import LLMMessage, LLMPort
from application.services.stakeholder.chatroom_service import ChatRoomApplicationService
from application.services.stakeholder.dto import CreateChatRoomDTO
from application.services.stakeholder.persona_loader import PersonaLoader
from domain.common.unit_of_work import AbstractUnitOfWork
from domain.defense_prep.entity import DefenseSession
from domain.defense_prep.scenario import ScenarioType, SCENARIO_CONFIGS
from domain.defense_prep.value_objects import PlannedQuestion, QuestionStrategy

logger = logging.getLogger(__name__)

_STRATEGY_PROMPT = """\
你是一位{role}，{tone}风格。
你的典型追问：{typical_questions}

你正在参加一场{scenario_name}。

以下是被评审者提交的文档内容：
---
{document_text}
---

请基于以下维度分析文档，找出薄弱点和可追问的地方：
{dimensions}

## 提问角度参考
{question_angles}

要求：
1. 找出文档中数据薄弱、逻辑不严密、结论缺少支撑的地方
2. 生成 8-12 个问题，按优先级排序
3. 每个问题标注：目标维度(dimension)、难度(difficulty: basic/advanced/stress_test)、期望回答方向(expected_direction)
4. 问题应符合你的角色风格和关注点
"""

_STRATEGY_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "dimension": {"type": "string"},
                    "difficulty": {"type": "string", "enum": ["basic", "advanced", "stress_test"]},
                    "expected_direction": {"type": "string"},
                },
                "required": ["question", "dimension", "difficulty", "expected_direction"],
            },
        },
    },
    "required": ["questions"],
}

_REPORT_PROMPT = """\
你是一位职场沟通教练。请根据以下答辩模拟的对话记录，生成评估报告。

## 评估维度
{dimensions}

## 对话记录
{conversation}

请对每个维度打分（1-10分），并给出整体评分、逐题回顾和改进建议。
"""

_REPORT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "overall_score": {"type": "number"},
        "dimension_scores": {"type": "object", "additionalProperties": {"type": "number"}},
        "question_reviews": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "user_answer_summary": {"type": "string"},
                    "score": {"type": "number"},
                    "feedback": {"type": "string"},
                    "improvement": {"type": "string"},
                },
                "required": ["question", "user_answer_summary", "score", "feedback", "improvement"],
            },
        },
        "summary": {"type": "string"},
        "top_improvements": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["overall_score", "dimension_scores", "question_reviews", "summary", "top_improvements"],
}


class DefensePrepService:
    """Orchestrates the defense prep workflow."""

    def __init__(
        self,
        uow_factory: Callable[..., AbstractUnitOfWork],
        llm: LLMPort,
        document_parser: DocumentParser,
        chatroom_service: ChatRoomApplicationService,
        persona_loader: PersonaLoader,
    ) -> None:
        self._uow_factory = uow_factory
        self._llm = llm
        self._parser = document_parser
        self._chatroom_service = chatroom_service
        self._persona_loader = persona_loader

    async def create_session(self, file_content: bytes, filename: str, persona_id: str, scenario_type: ScenarioType) -> DefenseSession:
        """Step 1: Parse document and create a defense session."""
        summary = await self._parser.parse(file_content, filename)
        session = DefenseSession(id=None, persona_id=persona_id, scenario_type=scenario_type, document_summary=summary)
        async with self._uow_factory() as uow:
            session = await uow.defense_session_repository.create(session)
            await uow.commit()
        return session

    async def start_session(self, session_id: int) -> DefenseSession:
        """Step 2: Generate question strategy, create room, start simulation."""
        async with self._uow_factory() as uow:
            session = await uow.defense_session_repository.get_by_id(session_id)
            if session is None:
                raise ValueError(f"Defense session {session_id} not found")
            strategy = await self._generate_strategy(session)
            session.question_strategy = strategy
            persona = self._persona_loader.get_persona(session.persona_id)
            persona_name = persona.name if persona else session.persona_id
            room = await self._chatroom_service.create_room(
                CreateChatRoomDTO(name=f"答辩: {persona_name}", type="defense", persona_ids=[session.persona_id])
            )
            session.start(room_id=room.id)
            await uow.defense_session_repository.update(session)
            await uow.commit()

        # Inject document context as system message + send first question from persona
        config = SCENARIO_CONFIGS[session.scenario_type]
        context_msg = (
            f"[答辩模式] 场景: {config['name']}\n"
            f"文档: {session.document_summary.title}\n"
            f"评估维度: {', '.join(config['dimensions'])}\n\n"
            f"文档摘要:\n{session.document_summary.raw_text[:3000]}"
        )
        first_q = strategy.questions[0].question if strategy.questions else "请介绍一下这份文档的核心内容。"

        from domain.stakeholder.entity import Message
        async with self._uow_factory() as uow:
            await uow.stakeholder_message_repository.create(Message(
                id=None, room_id=room.id, sender_type="system", sender_id="system", content=context_msg,
            ))
            await uow.stakeholder_message_repository.create(Message(
                id=None, room_id=room.id, sender_type="persona", sender_id=session.persona_id, content=first_q,
            ))
            await uow.commit()

        return session

    async def _generate_strategy(self, session: DefenseSession) -> QuestionStrategy:
        persona = self._persona_loader.get_persona(session.persona_id)
        config = SCENARIO_CONFIGS[session.scenario_type]
        role = persona.role if persona else "上级领导"
        tone = ""
        typical_questions = ""
        if persona:
            if persona.expression:
                tone = persona.expression.tone
            if persona.decision:
                typical_questions = ", ".join(persona.decision.typical_questions[:5])
        prompt = _STRATEGY_PROMPT.format(
            role=role, tone=tone or "专业严谨",
            typical_questions=typical_questions or "（无特定追问）",
            scenario_name=config["name"],
            document_text=session.document_summary.raw_text[:8000],
            dimensions=", ".join(config["dimensions"]),
            question_angles="\n".join(f"- {a}" for a in config["question_angles"]),
        )
        messages = [LLMMessage(role="user", content=prompt)]
        try:
            parsed = await self._llm.generate_structured(
                messages, schema=_STRATEGY_SCHEMA,
                schema_name="defense_question_strategy",
                schema_description="生成答辩提问策略", temperature=0.4,
            )
        except Exception as exc:
            logger.error("LLM strategy generation failed: %s", exc)
            raise ValueError("提问策略生成失败，请重试") from exc
        questions = [
            PlannedQuestion(question=q.get("question", ""), dimension=q.get("dimension", ""), difficulty=q.get("difficulty", "basic"), expected_direction=q.get("expected_direction", ""))
            for q in parsed.get("questions", [])
        ]
        return QuestionStrategy(questions=questions)

    async def get_session(self, session_id: int) -> Optional[DefenseSession]:
        async with self._uow_factory(readonly=True) as uow:
            return await uow.defense_session_repository.get_by_id(session_id)

    async def generate_report(self, session_id: int) -> dict:
        async with self._uow_factory(readonly=True) as uow:
            session = await uow.defense_session_repository.get_by_id(session_id)
            if session is None:
                raise ValueError(f"Defense session {session_id} not found")
        if session.room_id is None:
            raise ValueError("Session has no room — simulation not started")
        detail = await self._chatroom_service.get_room_detail(session.room_id, message_limit=200)
        messages = detail.messages
        if not messages:
            raise ValueError("对话记录为空，无法生成报告")
        lines: list[str] = []
        for msg in messages:
            if msg.sender_type == "system":
                continue
            if msg.sender_type == "user":
                lines.append(f"[用户]: {msg.content}")
            else:
                p = self._persona_loader.get_persona(msg.sender_id)
                name = p.name if p else msg.sender_id
                lines.append(f"[{name}]: {msg.content}")
        config = SCENARIO_CONFIGS[session.scenario_type]
        prompt = _REPORT_PROMPT.format(dimensions=", ".join(config["dimensions"]), conversation="\n\n".join(lines))
        messages_llm = [LLMMessage(role="user", content=prompt)]
        try:
            report = await self._llm.generate_structured(
                messages_llm, schema=_REPORT_SCHEMA,
                schema_name="defense_report", schema_description="答辩评估报告", temperature=0.3,
            )
        except Exception as exc:
            logger.error("LLM report generation failed: %s", exc)
            raise ValueError("评估报告生成失败，请重试") from exc
        async with self._uow_factory() as uow:
            session_fresh = await uow.defense_session_repository.get_by_id(session_id)
            if session_fresh:
                session_fresh.complete()
                await uow.defense_session_repository.update(session_fresh)
                await uow.commit()
        return report

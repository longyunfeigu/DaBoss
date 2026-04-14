# Defense Prep — 文档答辩模拟 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Defense Prep" scenario where users upload a document, pick an existing Persona, choose a scenario template, then enter an AI-driven Q&A simulation with real-time feedback and a final multi-dimensional evaluation report.

**Architecture:** New `defense_prep` aggregate parallel to `battle_prep`. Backend follows DDD + hexagonal: domain entities → application service + ports → infrastructure adapters → API routes. Frontend adds `DefensePrepPage` with step-based UI, reuses chat components for the simulation phase. Document parsing via `python-pptx` / `pdfplumber` / `python-docx` behind a `DocumentParser` port.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy (async), Alembic, `python-pptx`, `pdfplumber`, `python-docx`, React 19, TypeScript, React Router v6, Recharts, CSS custom properties.

---

## File Map

### Backend — New files

| File | Responsibility |
|------|---------------|
| `backend/domain/defense_prep/__init__.py` | Package |
| `backend/domain/defense_prep/entity.py` | `DefenseSession` entity, `DefenseSessionStatus` enum |
| `backend/domain/defense_prep/value_objects.py` | `DocumentSummary`, `Section`, `QuestionStrategy`, `PlannedQuestion` |
| `backend/domain/defense_prep/scenario.py` | `ScenarioType` enum, `SCENARIO_CONFIGS` dict |
| `backend/domain/defense_prep/repository.py` | `DefenseSessionRepository` ABC |
| `backend/application/services/defense_prep_service.py` | `DefensePrepService` orchestrator |
| `backend/application/ports/document_parser.py` | `DocumentParser` protocol |
| `backend/infrastructure/external/document_parser/__init__.py` | Package |
| `backend/infrastructure/external/document_parser/parser.py` | `FileDocumentParser` impl (pptx/pdf/docx) |
| `backend/infrastructure/models/defense_session.py` | `DefenseSessionModel` ORM |
| `backend/infrastructure/repositories/defense_session_repository.py` | `SQLAlchemyDefenseSessionRepository` |
| `backend/api/routes/defense_prep.py` | REST routes |
| `backend/tests/domain/test_defense_prep_entity.py` | Domain entity tests |
| `backend/tests/application/test_defense_prep_service.py` | Service tests |
| `backend/tests/infrastructure/test_document_parser.py` | Parser tests |

### Backend — Modified files

| File | Change |
|------|--------|
| `backend/domain/stakeholder/entity.py:15` | Add `"defense"` to `_ROOM_TYPES` |
| `backend/domain/common/unit_of_work.py` | Add `defense_session_repository` attribute |
| `backend/infrastructure/unit_of_work.py` | Wire `SQLAlchemyDefenseSessionRepository` |
| `backend/api/dependencies.py` | Add `get_defense_prep_service` |
| `backend/main.py` | Register defense_prep router |
| `backend/application/services/stakeholder/dto.py` | Add defense prep DTOs |

### Frontend — New files

| File | Responsibility |
|------|---------------|
| `frontend/src/pages/DefensePrepPage.tsx` | Main page with 4 steps |
| `frontend/src/pages/DefensePrepPage.css` | Page styles |
| `frontend/src/components/defense/DefenseReport.tsx` | Radar chart + review |
| `frontend/src/components/defense/DefenseReport.css` | Report styles |

### Frontend — Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `/defense-prep` and `/defense-prep/:id` routes |
| `frontend/src/services/api.ts` | Add defense prep API functions + types |
| `frontend/src/pages/HomePage.tsx` | Add "答辩准备" entry card |

---

## Task 1: Domain — DefenseSession Entity + Value Objects

**Files:**
- Create: `backend/domain/defense_prep/__init__.py`
- Create: `backend/domain/defense_prep/entity.py`
- Create: `backend/domain/defense_prep/value_objects.py`
- Create: `backend/domain/defense_prep/scenario.py`
- Test: `backend/tests/domain/test_defense_prep_entity.py`

- [ ] **Step 1: Write failing tests for DefenseSession entity**

```python
# backend/tests/domain/test_defense_prep_entity.py
import pytest
from domain.defense_prep.entity import DefenseSession, DefenseSessionStatus
from domain.defense_prep.value_objects import (
    DocumentSummary, Section, QuestionStrategy, PlannedQuestion,
)
from domain.defense_prep.scenario import ScenarioType, SCENARIO_CONFIGS


class TestDefenseSession:
    def test_create_valid_session(self):
        summary = DocumentSummary(
            title="Q1 述职报告",
            sections=[Section(title="业绩", bullet_points=["营收增长30%"])],
            key_data=["30%", "500万"],
            raw_text="完整文本内容",
        )
        session = DefenseSession(
            id=None,
            persona_id="persona-001",
            scenario_type=ScenarioType.PERFORMANCE_REVIEW,
            document_summary=summary,
        )
        assert session.status == DefenseSessionStatus.PREPARING
        assert session.room_id is None
        assert session.question_strategy is None
        assert session.created_at is not None

    def test_invalid_status_raises(self):
        from domain.common.exceptions import DomainValidationException
        summary = DocumentSummary(
            title="test", sections=[], key_data=[], raw_text="text",
        )
        with pytest.raises(DomainValidationException):
            DefenseSession(
                id=None,
                persona_id="p1",
                scenario_type=ScenarioType.GENERAL,
                document_summary=summary,
                status="bogus",
            )

    def test_transition_to_in_progress(self):
        summary = DocumentSummary(
            title="test", sections=[], key_data=[], raw_text="text",
        )
        session = DefenseSession(
            id=1,
            persona_id="p1",
            scenario_type=ScenarioType.PROPOSAL_REVIEW,
            document_summary=summary,
        )
        session.start(room_id=42)
        assert session.status == DefenseSessionStatus.IN_PROGRESS
        assert session.room_id == 42

    def test_transition_to_completed(self):
        summary = DocumentSummary(
            title="test", sections=[], key_data=[], raw_text="text",
        )
        session = DefenseSession(
            id=1,
            persona_id="p1",
            scenario_type=ScenarioType.GENERAL,
            document_summary=summary,
            status=DefenseSessionStatus.IN_PROGRESS,
            room_id=10,
        )
        session.complete()
        assert session.status == DefenseSessionStatus.COMPLETED


class TestScenarioConfig:
    def test_performance_review_has_dimensions(self):
        config = SCENARIO_CONFIGS[ScenarioType.PERFORMANCE_REVIEW]
        assert "dimensions" in config
        assert len(config["dimensions"]) >= 5

    def test_all_types_have_config(self):
        for st in ScenarioType:
            assert st in SCENARIO_CONFIGS, f"Missing config for {st}"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/domain/test_defense_prep_entity.py -v`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the domain package and entities**

```python
# backend/domain/defense_prep/__init__.py
```

```python
# backend/domain/defense_prep/value_objects.py
# input: 无外部依赖
# output: DocumentSummary, Section, QuestionStrategy, PlannedQuestion 值对象
# owner: wanhua.gu
# pos: 领域层 - 答辩准备值对象定义；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Value objects for the defense prep aggregate."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Section:
    """A section extracted from the uploaded document."""

    title: str
    bullet_points: list[str] = field(default_factory=list)


@dataclass
class DocumentSummary:
    """Structured summary of an uploaded document."""

    title: str
    sections: list[Section] = field(default_factory=list)
    key_data: list[str] = field(default_factory=list)
    raw_text: str = ""


@dataclass
class PlannedQuestion:
    """A single question in the question strategy."""

    question: str
    dimension: str
    difficulty: str = "basic"  # basic | advanced | stress_test
    expected_direction: str = ""


@dataclass
class QuestionStrategy:
    """LLM-generated question strategy for a defense session."""

    questions: list[PlannedQuestion] = field(default_factory=list)
```

```python
# backend/domain/defense_prep/scenario.py
# input: 无外部依赖
# output: ScenarioType 枚举, SCENARIO_CONFIGS 配置字典
# owner: wanhua.gu
# pos: 领域层 - 答辩场景模板定义；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Scenario templates for defense prep sessions."""

from __future__ import annotations

from enum import Enum


class ScenarioType(str, Enum):
    PERFORMANCE_REVIEW = "performance_review"
    PROPOSAL_REVIEW = "proposal_review"
    PROJECT_REPORT = "project_report"
    GENERAL = "general"


SCENARIO_CONFIGS: dict[ScenarioType, dict] = {
    ScenarioType.PERFORMANCE_REVIEW: {
        "name": "述职答辩",
        "dimensions": [
            "数据掌握度", "逻辑严密性", "应变能力",
            "坦诚度", "表达清晰度", "格局视野",
        ],
        "question_angles": [
            "核心业绩的归因分析（个人贡献 vs 团队/环境因素）",
            "关键数据的可信度和完整性",
            "失败/不足的坦诚度",
            "未来规划的可行性和野心度",
        ],
    },
    ScenarioType.PROPOSAL_REVIEW: {
        "name": "方案评审",
        "dimensions": [
            "方案完整性", "风险意识", "数据论证",
            "替代思考", "执行可行性", "应变能力",
        ],
        "question_angles": [
            "最大的技术/业务风险是什么",
            "为什么不选其他方案",
            "如果资源砍半怎么办",
            "成功的衡量标准是什么",
        ],
    },
    ScenarioType.PROJECT_REPORT: {
        "name": "项目汇报",
        "dimensions": [
            "进度把控", "问题识别", "资源协调",
            "风险预判", "数据支撑", "下步计划",
        ],
        "question_angles": [
            "进度延迟的真实原因",
            "风险缓释措施的有效性",
            "跨部门协调的瓶颈",
            "对项目成功标准的理解",
        ],
    },
    ScenarioType.GENERAL: {
        "name": "通用文档答辩",
        "dimensions": [
            "内容掌握度", "逻辑严密性", "应变能力",
            "数据支撑", "表达清晰度", "深度思考",
        ],
        "question_angles": [
            "文档核心观点的论据强度",
            "数据和结论之间的因果关系",
            "潜在反对意见的预判",
            "后续行动的可执行性",
        ],
    },
}
```

```python
# backend/domain/defense_prep/entity.py
# input: value_objects, scenario
# output: DefenseSession 实体, DefenseSessionStatus 枚举
# owner: wanhua.gu
# pos: 领域层 - 答辩准备会话聚合根；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Domain entity for the defense prep aggregate."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from domain.common.exceptions import DomainValidationException
from domain.defense_prep.scenario import ScenarioType
from domain.defense_prep.value_objects import DocumentSummary, QuestionStrategy


class DefenseSessionStatus:
    PREPARING = "preparing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

_VALID_STATUSES = {
    DefenseSessionStatus.PREPARING,
    DefenseSessionStatus.IN_PROGRESS,
    DefenseSessionStatus.COMPLETED,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class DefenseSession:
    """A defense prep simulation session."""

    id: Optional[int]
    persona_id: str
    scenario_type: ScenarioType
    document_summary: DocumentSummary
    question_strategy: Optional[QuestionStrategy] = None
    room_id: Optional[int] = None
    status: str = DefenseSessionStatus.PREPARING
    created_at: Optional[datetime] = None

    def __post_init__(self) -> None:
        if self.status not in _VALID_STATUSES:
            raise DomainValidationException(
                f"Invalid defense session status: {self.status}",
                field="status",
                details={"allowed": sorted(_VALID_STATUSES)},
            )
        if self.created_at is None:
            self.created_at = _utcnow()

    def start(self, room_id: int) -> None:
        self.status = DefenseSessionStatus.IN_PROGRESS
        self.room_id = room_id

    def complete(self) -> None:
        self.status = DefenseSessionStatus.COMPLETED
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/domain/test_defense_prep_entity.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd backend && git add domain/defense_prep/ tests/domain/test_defense_prep_entity.py
git commit -m "feat(defense-prep): add domain entities — DefenseSession, ScenarioType, value objects"
```

---

## Task 2: Domain — Repository Interface + Room Type

**Files:**
- Create: `backend/domain/defense_prep/repository.py`
- Modify: `backend/domain/stakeholder/entity.py:15`

- [ ] **Step 1: Create repository interface**

```python
# backend/domain/defense_prep/repository.py
# input: DefenseSession 领域实体
# output: DefenseSessionRepository ABC 仓储接口
# owner: wanhua.gu
# pos: 领域层 - 答辩准备会话仓储接口；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Repository abstraction for defense prep sessions."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from .entity import DefenseSession


class DefenseSessionRepository(ABC):
    """Contract for persisting and querying defense prep sessions."""

    @abstractmethod
    async def create(self, session: DefenseSession) -> DefenseSession: ...

    @abstractmethod
    async def get_by_id(self, session_id: int) -> Optional[DefenseSession]: ...

    @abstractmethod
    async def update(self, session: DefenseSession) -> DefenseSession: ...

    @abstractmethod
    async def list_all(self, *, skip: int = 0, limit: int = 20) -> list[DefenseSession]: ...
```

- [ ] **Step 2: Add "defense" to room types**

In `backend/domain/stakeholder/entity.py`, line 15, change:

```python
_ROOM_TYPES = {"private", "group", "battle_prep"}
```
to:
```python
_ROOM_TYPES = {"private", "group", "battle_prep", "defense"}
```

- [ ] **Step 3: Commit**

```bash
git add backend/domain/defense_prep/repository.py backend/domain/stakeholder/entity.py
git commit -m "feat(defense-prep): add DefenseSessionRepository ABC + defense room type"
```

---

## Task 3: Application — DocumentParser Port

**Files:**
- Create: `backend/application/ports/document_parser.py`

- [ ] **Step 1: Create the port**

```python
# backend/application/ports/document_parser.py
# input: 上传文件 (UploadFile)
# output: DocumentParser Protocol
# owner: wanhua.gu
# pos: 应用层端口 - 文档解析抽象接口；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Application-owned document parser port."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from domain.defense_prep.value_objects import DocumentSummary


@runtime_checkable
class DocumentParser(Protocol):
    """Port for parsing uploaded documents into structured summaries."""

    async def parse(self, content: bytes, filename: str) -> DocumentSummary:
        """Parse file content into a DocumentSummary.

        Args:
            content: Raw file bytes.
            filename: Original filename (used to detect format by extension).

        Returns:
            Structured document summary.
        """
        ...
```

- [ ] **Step 2: Commit**

```bash
git add backend/application/ports/document_parser.py
git commit -m "feat(defense-prep): add DocumentParser port interface"
```

---

## Task 4: Infrastructure — Document Parser Implementation

**Files:**
- Create: `backend/infrastructure/external/document_parser/__init__.py`
- Create: `backend/infrastructure/external/document_parser/parser.py`
- Test: `backend/tests/infrastructure/test_document_parser.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/infrastructure/test_document_parser.py
import pytest
from infrastructure.external.document_parser.parser import FileDocumentParser


@pytest.fixture
def parser():
    return FileDocumentParser()


class TestFileDocumentParser:
    @pytest.mark.asyncio
    async def test_parse_txt_fallback(self, parser):
        content = b"Hello World\nThis is a test document."
        result = await parser.parse(content, "test.txt")
        assert result.raw_text == "Hello World\nThis is a test document."
        assert result.title == "test"

    @pytest.mark.asyncio
    async def test_unsupported_format_raises(self, parser):
        with pytest.raises(ValueError, match="Unsupported"):
            await parser.parse(b"data", "test.zip")

    @pytest.mark.asyncio
    async def test_extract_key_data_finds_numbers(self, parser):
        content = b"Revenue grew 30% to $5M. Team expanded from 10 to 25 people."
        result = await parser.parse(content, "report.txt")
        assert any("30%" in d for d in result.key_data)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/infrastructure/test_document_parser.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FileDocumentParser**

```python
# backend/infrastructure/external/document_parser/__init__.py
```

```python
# backend/infrastructure/external/document_parser/parser.py
# input: python-pptx, pdfplumber, python-docx 三方库
# output: FileDocumentParser 文档解析实现
# owner: wanhua.gu
# pos: 基础设施层 - 文档解析适配器 (PPT/PDF/Word → DocumentSummary)；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Concrete document parser: PPT, PDF, Word → DocumentSummary."""

from __future__ import annotations

import io
import re
from pathlib import Path

from domain.defense_prep.value_objects import DocumentSummary, Section


_NUMBER_PATTERN = re.compile(
    r"\d+(?:\.\d+)?%"          # percentages
    r"|[$¥€]\s?\d[\d,]*(?:\.\d+)?"  # currency
    r"|\d[\d,]*(?:\.\d+)?\s?[万亿kKmMbB]"  # scaled numbers
)


class FileDocumentParser:
    """Parses uploaded files into DocumentSummary."""

    async def parse(self, content: bytes, filename: str) -> DocumentSummary:
        ext = Path(filename).suffix.lower()
        if ext == ".pptx":
            return self._parse_pptx(content, filename)
        elif ext == ".pdf":
            return self._parse_pdf(content, filename)
        elif ext == ".docx":
            return self._parse_docx(content, filename)
        elif ext == ".txt" or ext == ".md":
            return self._parse_text(content, filename)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _extract_key_data(self, text: str) -> list[str]:
        return list(dict.fromkeys(_NUMBER_PATTERN.findall(text)))

    def _parse_pptx(self, content: bytes, filename: str) -> DocumentSummary:
        from pptx import Presentation

        prs = Presentation(io.BytesIO(content))
        sections: list[Section] = []
        all_text_parts: list[str] = []

        for slide in prs.slides:
            title = ""
            bullets: list[str] = []
            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                for para in shape.text_frame.paragraphs:
                    text = para.text.strip()
                    if not text:
                        continue
                    if not title and para.level == 0:
                        title = text
                    else:
                        bullets.append(text)
                    all_text_parts.append(text)
            if title or bullets:
                sections.append(Section(title=title, bullet_points=bullets))

        raw_text = "\n".join(all_text_parts)
        return DocumentSummary(
            title=Path(filename).stem,
            sections=sections,
            key_data=self._extract_key_data(raw_text),
            raw_text=raw_text,
        )

    def _parse_pdf(self, content: bytes, filename: str) -> DocumentSummary:
        import pdfplumber

        all_text_parts: list[str] = []
        sections: list[Section] = []

        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                all_text_parts.append(text)
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                if lines:
                    sections.append(Section(title=lines[0], bullet_points=lines[1:]))

        raw_text = "\n".join(all_text_parts)
        return DocumentSummary(
            title=Path(filename).stem,
            sections=sections,
            key_data=self._extract_key_data(raw_text),
            raw_text=raw_text,
        )

    def _parse_docx(self, content: bytes, filename: str) -> DocumentSummary:
        from docx import Document

        doc = Document(io.BytesIO(content))
        sections: list[Section] = []
        current_section: Section | None = None
        all_text_parts: list[str] = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            all_text_parts.append(text)
            if para.style and para.style.name.startswith("Heading"):
                if current_section:
                    sections.append(current_section)
                current_section = Section(title=text)
            elif current_section:
                current_section.bullet_points.append(text)
            else:
                current_section = Section(title=text)

        if current_section:
            sections.append(current_section)

        raw_text = "\n".join(all_text_parts)
        return DocumentSummary(
            title=Path(filename).stem,
            sections=sections,
            key_data=self._extract_key_data(raw_text),
            raw_text=raw_text,
        )

    def _parse_text(self, content: bytes, filename: str) -> DocumentSummary:
        raw_text = content.decode("utf-8", errors="replace")
        return DocumentSummary(
            title=Path(filename).stem,
            sections=[],
            key_data=self._extract_key_data(raw_text),
            raw_text=raw_text,
        )
```

- [ ] **Step 4: Install dependencies**

Run: `cd backend && uv add python-pptx pdfplumber python-docx`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/infrastructure/test_document_parser.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/infrastructure/external/document_parser/ backend/tests/infrastructure/test_document_parser.py
git commit -m "feat(defense-prep): implement FileDocumentParser for PPT/PDF/Word"
```

---

## Task 5: Infrastructure — ORM Model + Migration + Repository

**Files:**
- Create: `backend/infrastructure/models/defense_session.py`
- Create: `backend/infrastructure/repositories/defense_session_repository.py`
- Modify: `backend/domain/common/unit_of_work.py`
- Modify: `backend/infrastructure/unit_of_work.py`

- [ ] **Step 1: Create ORM model**

```python
# backend/infrastructure/models/defense_session.py
# input: SQLAlchemy Base 基类
# output: DefenseSessionModel ORM 模型
# owner: wanhua.gu
# pos: 基础设施层 - 答辩准备会话 ORM 模型；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Defense session database model."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from .base import Base


class DefenseSessionModel(Base):
    """ORM mapping for defense_sessions table."""

    __tablename__ = "defense_sessions"
    __table_args__ = {"comment": "答辩准备会话"}

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    persona_id = Column(String(100), nullable=False, comment="关联 Persona ID")
    scenario_type = Column(String(50), nullable=False, comment="场景类型")
    document_summary = Column(JSON, nullable=False, comment="文档摘要 (结构化)")
    question_strategy = Column(JSON, nullable=True, comment="提问策略 (LLM 生成)")
    room_id = Column(Integer, nullable=True, comment="关联聊天室 ID")
    status = Column(
        String(20), nullable=False, default="preparing", comment="状态: preparing/in_progress/completed"
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        comment="创建时间",
    )
```

- [ ] **Step 2: Create repository implementation**

```python
# backend/infrastructure/repositories/defense_session_repository.py
# input: AsyncSession, DefenseSessionModel
# output: SQLAlchemyDefenseSessionRepository
# owner: wanhua.gu
# pos: 基础设施层 - 答辩准备会话仓储实现；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""SQLAlchemy implementation of DefenseSessionRepository."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.defense_prep.entity import DefenseSession, DefenseSessionStatus
from domain.defense_prep.repository import DefenseSessionRepository
from domain.defense_prep.scenario import ScenarioType
from domain.defense_prep.value_objects import (
    DocumentSummary, Section, QuestionStrategy, PlannedQuestion,
)
from infrastructure.models.defense_session import DefenseSessionModel


class SQLAlchemyDefenseSessionRepository(DefenseSessionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _to_entity(self, model: DefenseSessionModel) -> DefenseSession:
        doc_data = model.document_summary or {}
        summary = DocumentSummary(
            title=doc_data.get("title", ""),
            sections=[
                Section(title=s.get("title", ""), bullet_points=s.get("bullet_points", []))
                for s in doc_data.get("sections", [])
            ],
            key_data=doc_data.get("key_data", []),
            raw_text=doc_data.get("raw_text", ""),
        )
        strategy = None
        if model.question_strategy:
            qs_data = model.question_strategy
            strategy = QuestionStrategy(
                questions=[
                    PlannedQuestion(
                        question=q.get("question", ""),
                        dimension=q.get("dimension", ""),
                        difficulty=q.get("difficulty", "basic"),
                        expected_direction=q.get("expected_direction", ""),
                    )
                    for q in qs_data.get("questions", [])
                ]
            )
        return DefenseSession(
            id=model.id,
            persona_id=model.persona_id,
            scenario_type=ScenarioType(model.scenario_type),
            document_summary=summary,
            question_strategy=strategy,
            room_id=model.room_id,
            status=model.status,
            created_at=model.created_at,
        )

    def _summary_to_dict(self, summary: DocumentSummary) -> dict:
        return {
            "title": summary.title,
            "sections": [
                {"title": s.title, "bullet_points": s.bullet_points}
                for s in summary.sections
            ],
            "key_data": summary.key_data,
            "raw_text": summary.raw_text,
        }

    def _strategy_to_dict(self, strategy: QuestionStrategy) -> dict:
        return {
            "questions": [
                {
                    "question": q.question,
                    "dimension": q.dimension,
                    "difficulty": q.difficulty,
                    "expected_direction": q.expected_direction,
                }
                for q in strategy.questions
            ]
        }

    async def create(self, session: DefenseSession) -> DefenseSession:
        model = DefenseSessionModel(
            persona_id=session.persona_id,
            scenario_type=session.scenario_type.value,
            document_summary=self._summary_to_dict(session.document_summary),
            question_strategy=(
                self._strategy_to_dict(session.question_strategy)
                if session.question_strategy else None
            ),
            room_id=session.room_id,
            status=session.status,
        )
        self.session.add(model)
        await self.session.flush()
        session.id = model.id
        session.created_at = model.created_at
        return session

    async def get_by_id(self, session_id: int) -> Optional[DefenseSession]:
        result = await self.session.execute(
            select(DefenseSessionModel).where(DefenseSessionModel.id == session_id)
        )
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def update(self, session: DefenseSession) -> DefenseSession:
        result = await self.session.execute(
            select(DefenseSessionModel).where(DefenseSessionModel.id == session.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"DefenseSession {session.id} not found")
        model.status = session.status
        model.room_id = session.room_id
        model.question_strategy = (
            self._strategy_to_dict(session.question_strategy)
            if session.question_strategy else None
        )
        await self.session.flush()
        return session

    async def list_all(self, *, skip: int = 0, limit: int = 20) -> list[DefenseSession]:
        result = await self.session.execute(
            select(DefenseSessionModel)
            .order_by(DefenseSessionModel.created_at.desc())
            .offset(skip).limit(limit)
        )
        return [self._to_entity(m) for m in result.scalars().all()]
```

- [ ] **Step 3: Wire into UnitOfWork**

In `backend/domain/common/unit_of_work.py`, add import and attribute:

After line 16 (`from domain.stakeholder.repository import ScenarioRepository`), add:
```python
from domain.defense_prep.repository import DefenseSessionRepository
```

Inside `__init__`, after line 38, add:
```python
self.defense_session_repository: DefenseSessionRepository = None  # type: ignore[assignment]
```

In `backend/infrastructure/unit_of_work.py`, add import after line 44:
```python
from infrastructure.repositories.defense_session_repository import (
    SQLAlchemyDefenseSessionRepository,
)
```

Inside `__aenter__`, after line 108, add:
```python
self.defense_session_repository = SQLAlchemyDefenseSessionRepository(self.session)
self.register_repository("defense_session_repository", self.defense_session_repository)
```

Inside `__aexit__`, after line 144, add:
```python
self.defense_session_repository = None  # type: ignore[assignment]
```

- [ ] **Step 4: Generate migration**

Run: `cd backend && uv run alembic revision --autogenerate -m "add defense_sessions table"`

- [ ] **Step 5: Apply migration**

Run: `cd backend && uv run alembic upgrade head`

- [ ] **Step 6: Commit**

```bash
git add backend/infrastructure/models/defense_session.py \
  backend/infrastructure/repositories/defense_session_repository.py \
  backend/domain/common/unit_of_work.py \
  backend/infrastructure/unit_of_work.py \
  backend/alembic/versions/
git commit -m "feat(defense-prep): add ORM model, repository impl, migration, UoW wiring"
```

---

## Task 6: Application — DTOs + DefensePrepService

**Files:**
- Modify: `backend/application/services/stakeholder/dto.py`
- Create: `backend/application/services/defense_prep_service.py`
- Test: `backend/tests/application/test_defense_prep_service.py`

- [ ] **Step 1: Add DTOs to stakeholder/dto.py**

Append to `backend/application/services/stakeholder/dto.py`:

```python
# ---------------------------------------------------------------------------
# Defense Prep DTOs
# ---------------------------------------------------------------------------


class CreateDefenseSessionDTO(BaseModel):
    """Input: upload document + choose persona + scenario."""

    persona_id: str = Field(..., min_length=1)
    scenario_type: str = Field(..., pattern=r"^(performance_review|proposal_review|project_report|general)$")


class DefenseSessionDTO(BaseModel):
    """Output: defense session summary."""

    model_config = {"from_attributes": True}

    id: int
    persona_id: str
    scenario_type: str
    document_title: str
    status: str
    room_id: Optional[int] = None
    created_at: Optional[datetime] = None


class DefenseReportDTO(BaseModel):
    """Output: final evaluation report."""

    overall_score: float
    dimension_scores: dict[str, float]
    question_reviews: list[dict]
    summary: str
    top_improvements: list[str]
```

- [ ] **Step 2: Write failing test for DefensePrepService**

```python
# backend/tests/application/test_defense_prep_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from application.services.defense_prep_service import DefensePrepService
from domain.defense_prep.value_objects import DocumentSummary
from domain.defense_prep.scenario import ScenarioType


@pytest.fixture
def mock_deps():
    uow = AsyncMock()
    uow.__aenter__ = AsyncMock(return_value=uow)
    uow.__aexit__ = AsyncMock(return_value=False)
    uow.defense_session_repository = AsyncMock()
    uow.commit = AsyncMock()

    llm = AsyncMock()
    parser = AsyncMock()
    chatroom_svc = AsyncMock()
    persona_loader = MagicMock()
    return uow, llm, parser, chatroom_svc, persona_loader


class TestDefensePrepService:
    @pytest.mark.asyncio
    async def test_create_session_parses_doc_and_persists(self, mock_deps):
        uow, llm, parser, chatroom_svc, persona_loader = mock_deps

        parser.parse.return_value = DocumentSummary(
            title="Q1报告", sections=[], key_data=["30%"], raw_text="full text",
        )
        uow.defense_session_repository.create.side_effect = lambda s: setattr(s, "id", 1) or s

        service = DefensePrepService(
            uow_factory=lambda: uow,
            llm=llm,
            document_parser=parser,
            chatroom_service=chatroom_svc,
            persona_loader=persona_loader,
        )

        session = await service.create_session(
            file_content=b"fake pptx bytes",
            filename="Q1报告.pptx",
            persona_id="persona-001",
            scenario_type=ScenarioType.PERFORMANCE_REVIEW,
        )

        parser.parse.assert_called_once_with(b"fake pptx bytes", "Q1报告.pptx")
        uow.defense_session_repository.create.assert_called_once()
        assert session.id == 1
        assert session.status == "preparing"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/application/test_defense_prep_service.py -v`
Expected: FAIL — module not found

- [ ] **Step 4: Implement DefensePrepService**

```python
# backend/application/services/defense_prep_service.py
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
                    "difficulty": {
                        "type": "string",
                        "enum": ["basic", "advanced", "stress_test"],
                    },
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
        "dimension_scores": {
            "type": "object",
            "additionalProperties": {"type": "number"},
        },
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
        "top_improvements": {
            "type": "array",
            "items": {"type": "string"},
        },
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

    async def create_session(
        self,
        file_content: bytes,
        filename: str,
        persona_id: str,
        scenario_type: ScenarioType,
    ) -> DefenseSession:
        """Step 1: Parse document and create a defense session."""
        summary = await self._parser.parse(file_content, filename)
        session = DefenseSession(
            id=None,
            persona_id=persona_id,
            scenario_type=scenario_type,
            document_summary=summary,
        )
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

            # Generate question strategy
            strategy = await self._generate_strategy(session)
            session.question_strategy = strategy

            # Create defense room
            persona = self._persona_loader.get_persona(session.persona_id)
            persona_name = persona.name if persona else session.persona_id
            room = await self._chatroom_service.create_room(
                CreateChatRoomDTO(
                    name=f"答辩: {persona_name}",
                    type="defense",
                    persona_ids=[session.persona_id],
                )
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
            # System message with document context
            await uow.stakeholder_message_repository.create(Message(
                id=None, room_id=room.id,
                sender_type="system", sender_id="system",
                content=context_msg,
            ))
            # First question from persona
            await uow.stakeholder_message_repository.create(Message(
                id=None, room_id=room.id,
                sender_type="persona", sender_id=session.persona_id,
                content=first_q,
            ))
            await uow.commit()

        return session

    async def _generate_strategy(self, session: DefenseSession) -> QuestionStrategy:
        """Use LLM to generate a question strategy from document + persona + scenario."""
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
            role=role,
            tone=tone or "专业严谨",
            typical_questions=typical_questions or "（无特定追问）",
            scenario_name=config["name"],
            document_text=session.document_summary.raw_text[:8000],
            dimensions=", ".join(config["dimensions"]),
            question_angles="\n".join(f"- {a}" for a in config["question_angles"]),
        )

        messages = [LLMMessage(role="user", content=prompt)]
        try:
            parsed = await self._llm.generate_structured(
                messages,
                schema=_STRATEGY_SCHEMA,
                schema_name="defense_question_strategy",
                schema_description="生成答辩提问策略",
                temperature=0.4,
            )
        except Exception as exc:
            logger.error("LLM strategy generation failed: %s", exc)
            raise ValueError("提问策略生成失败，请重试") from exc

        questions = [
            PlannedQuestion(
                question=q.get("question", ""),
                dimension=q.get("dimension", ""),
                difficulty=q.get("difficulty", "basic"),
                expected_direction=q.get("expected_direction", ""),
            )
            for q in parsed.get("questions", [])
        ]
        return QuestionStrategy(questions=questions)

    async def get_session(self, session_id: int) -> Optional[DefenseSession]:
        async with self._uow_factory(readonly=True) as uow:
            return await uow.defense_session_repository.get_by_id(session_id)

    async def generate_report(self, session_id: int) -> dict:
        """Generate final evaluation report from conversation history."""
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
        prompt = _REPORT_PROMPT.format(
            dimensions=", ".join(config["dimensions"]),
            conversation="\n\n".join(lines),
        )

        messages_llm = [LLMMessage(role="user", content=prompt)]
        try:
            report = await self._llm.generate_structured(
                messages_llm,
                schema=_REPORT_SCHEMA,
                schema_name="defense_report",
                schema_description="答辩评估报告",
                temperature=0.3,
            )
        except Exception as exc:
            logger.error("LLM report generation failed: %s", exc)
            raise ValueError("评估报告生成失败，请重试") from exc

        # Mark session as completed
        async with self._uow_factory() as uow:
            session_fresh = await uow.defense_session_repository.get_by_id(session_id)
            if session_fresh:
                session_fresh.complete()
                await uow.defense_session_repository.update(session_fresh)
                await uow.commit()

        return report
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/application/test_defense_prep_service.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/application/services/defense_prep_service.py \
  backend/application/services/stakeholder/dto.py \
  backend/tests/application/test_defense_prep_service.py
git commit -m "feat(defense-prep): add DefensePrepService + DTOs"
```

---

## Task 7: API — Routes + Dependencies

**Files:**
- Create: `backend/api/routes/defense_prep.py`
- Modify: `backend/api/dependencies.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add dependency factory to `backend/api/dependencies.py`**

Append after the `get_persona_v2_service` function:

```python
# ---------------------------------------------------------------------------
# Defense Prep dependencies
# ---------------------------------------------------------------------------


async def get_defense_prep_service(
    loader: PersonaLoader = Depends(get_persona_loader_with_v2),
    llm: LLMPort = Depends(get_stakeholder_llm_port),
    chatroom_svc: ChatRoomApplicationService = Depends(get_chatroom_service),
):
    from application.services.defense_prep_service import DefensePrepService
    from infrastructure.external.document_parser.parser import FileDocumentParser

    return DefensePrepService(
        uow_factory=SQLAlchemyUnitOfWork,
        llm=llm,
        document_parser=FileDocumentParser(),
        chatroom_service=chatroom_svc,
        persona_loader=loader,
    )
```

- [ ] **Step 2: Create API routes**

```python
# backend/api/routes/defense_prep.py
# input: DefensePrepService (via dependencies)
# output: defense-prep API 路由 (sessions CRUD + start + report)
# owner: wanhua.gu
# pos: 表示层 - 答辩准备 API 路由；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Defense prep API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from api.dependencies import get_defense_prep_service
from application.services.defense_prep_service import DefensePrepService
from core.response import success_response
from domain.defense_prep.scenario import ScenarioType

router = APIRouter(prefix="/defense-prep", tags=["Defense Prep"])

_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
_ALLOWED_EXTENSIONS = {".pptx", ".pdf", ".docx", ".txt", ".md"}


@router.post("/sessions")
async def create_session(
    file: UploadFile = File(...),
    persona_id: str = Form(...),
    scenario_type: str = Form(...),
    service: DefensePrepService = Depends(get_defense_prep_service),
):
    """Upload document + create a defense prep session."""
    # Validate file
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"不支持的文件格式: {ext}")

    content = await file.read()
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(400, "文件大小不能超过 20MB")

    try:
        st = ScenarioType(scenario_type)
    except ValueError:
        raise HTTPException(400, f"无效的场景类型: {scenario_type}")

    session = await service.create_session(
        file_content=content,
        filename=file.filename or "document",
        persona_id=persona_id,
        scenario_type=st,
    )

    return success_response({
        "id": session.id,
        "persona_id": session.persona_id,
        "scenario_type": session.scenario_type.value,
        "document_title": session.document_summary.title,
        "status": session.status,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    })


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: int,
    service: DefensePrepService = Depends(get_defense_prep_service),
):
    """Get a defense prep session by ID."""
    session = await service.get_session(session_id)
    if session is None:
        raise HTTPException(404, "会话不存在")

    data = {
        "id": session.id,
        "persona_id": session.persona_id,
        "scenario_type": session.scenario_type.value,
        "document_title": session.document_summary.title,
        "status": session.status,
        "room_id": session.room_id,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }
    if session.question_strategy:
        data["question_strategy"] = {
            "questions": [
                {
                    "question": q.question,
                    "dimension": q.dimension,
                    "difficulty": q.difficulty,
                }
                for q in session.question_strategy.questions
            ]
        }
    return success_response(data)


@router.post("/sessions/{session_id}/start")
async def start_session(
    session_id: int,
    service: DefensePrepService = Depends(get_defense_prep_service),
):
    """Generate question strategy, create room, start simulation."""
    try:
        session = await service.start_session(session_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return success_response({
        "id": session.id,
        "room_id": session.room_id,
        "status": session.status,
        "question_strategy": {
            "questions": [
                {
                    "question": q.question,
                    "dimension": q.dimension,
                    "difficulty": q.difficulty,
                }
                for q in (session.question_strategy.questions if session.question_strategy else [])
            ]
        },
    })


@router.get("/sessions/{session_id}/report")
async def get_report(
    session_id: int,
    service: DefensePrepService = Depends(get_defense_prep_service),
):
    """Generate and return the final evaluation report."""
    try:
        report = await service.generate_report(session_id)
    except ValueError as e:
        raise HTTPException(400, str(e))

    return success_response(report)
```

- [ ] **Step 3: Register router in main.py**

In `backend/main.py`, add the import and include the router alongside the existing stakeholder router. Find where the stakeholder router is included and add:

```python
from api.routes.defense_prep import router as defense_prep_router
```

And in the router inclusion section:
```python
app.include_router(defense_prep_router, prefix="/api/v1")
```

- [ ] **Step 4: Smoke test the API**

Run: `cd backend && uv run python main.py &`
Then: `curl -s http://localhost:8000/docs | head -20`
Verify: defense-prep endpoints appear in the OpenAPI docs.
Kill the server.

- [ ] **Step 5: Commit**

```bash
git add backend/api/routes/defense_prep.py \
  backend/api/dependencies.py \
  backend/main.py
git commit -m "feat(defense-prep): add API routes + dependency wiring"
```

---

## Task 8: Frontend — API Service + Types

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add defense prep types and API functions**

Append to `frontend/src/services/api.ts`:

```typescript
// ---------------------------------------------------------------------------
// Defense Prep
// ---------------------------------------------------------------------------

export interface DefenseSession {
  id: number
  persona_id: string
  scenario_type: string
  document_title: string
  status: 'preparing' | 'in_progress' | 'completed'
  room_id: number | null
  created_at: string | null
  question_strategy?: {
    questions: {
      question: string
      dimension: string
      difficulty: string
    }[]
  }
}

export interface DefenseReport {
  overall_score: number
  dimension_scores: Record<string, number>
  question_reviews: {
    question: string
    user_answer_summary: string
    score: number
    feedback: string
    improvement: string
  }[]
  summary: string
  top_improvements: string[]
}

export async function createDefenseSession(
  file: File,
  personaId: string,
  scenarioType: string,
): Promise<DefenseSession> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('persona_id', personaId)
  formData.append('scenario_type', scenarioType)
  const resp = await fetch(`${API_BASE}/defense-prep/sessions`, {
    method: 'POST',
    body: formData,
  })
  if (!resp.ok) {
    const json = await resp.json().catch(() => null)
    throw new Error(json?.message || `创建失败: ${resp.status}`)
  }
  const json: ApiResponse<DefenseSession> = await resp.json()
  return json.data
}

export async function getDefenseSession(sessionId: number): Promise<DefenseSession> {
  const resp = await fetch(`${API_BASE}/defense-prep/sessions/${sessionId}`)
  if (!resp.ok) throw new Error(`获取会话失败: ${resp.status}`)
  const json: ApiResponse<DefenseSession> = await resp.json()
  return json.data
}

export async function startDefenseSession(sessionId: number): Promise<DefenseSession> {
  const resp = await fetch(`${API_BASE}/defense-prep/sessions/${sessionId}/start`, {
    method: 'POST',
  })
  if (!resp.ok) {
    const json = await resp.json().catch(() => null)
    throw new Error(json?.message || `启动失败: ${resp.status}`)
  }
  const json: ApiResponse<DefenseSession> = await resp.json()
  return json.data
}

export async function getDefenseReport(sessionId: number): Promise<DefenseReport> {
  const resp = await fetch(`${API_BASE}/defense-prep/sessions/${sessionId}/report`)
  if (!resp.ok) {
    const json = await resp.json().catch(() => null)
    throw new Error(json?.message || `报告生成失败: ${resp.status}`)
  }
  const json: ApiResponse<DefenseReport> = await resp.json()
  return json.data
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(defense-prep): add frontend API types + functions"
```

---

## Task 9: Frontend — DefensePrepPage (Steps 1-2: Upload + Select)

**Files:**
- Create: `frontend/src/pages/DefensePrepPage.tsx`
- Create: `frontend/src/pages/DefensePrepPage.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create DefensePrepPage component**

```tsx
// frontend/src/pages/DefensePrepPage.tsx
import { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Upload, FileText, ArrowLeft, Play } from 'lucide-react'
import { AppContext } from '../contexts/AppContext'
import {
  createDefenseSession,
  startDefenseSession,
  type DefenseSession,
  type PersonaSummary,
} from '../services/api'
import './DefensePrepPage.css'

const SCENARIO_OPTIONS = [
  { value: 'performance_review', label: '述职答辩', desc: '业绩、成长、规划' },
  { value: 'proposal_review', label: '方案评审', desc: '可行性、风险、ROI' },
  { value: 'project_report', label: '项目汇报', desc: '进度、问题、计划' },
  { value: 'general', label: '通用', desc: '通用文档答辩' },
]

type Step = 1 | 2 | 3

function initialState() {
  return {
    step: 1 as Step,
    file: null as File | null,
    personaId: '',
    scenarioType: 'performance_review',
    loading: false,
    error: null as string | null,
    session: null as DefenseSession | null,
    starting: false,
  }
}

export default function DefensePrepPage() {
  const navigate = useNavigate()
  const { personaMap } = useContext(AppContext)
  const [state, setState] = useState(initialState)
  const { step, file, personaId, scenarioType, loading, error, session, starting } = state

  const personas = Object.values(personaMap) as PersonaSummary[]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setState((s) => ({ ...s, file: f, error: null }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0] || null
    setState((s) => ({ ...s, file: f, error: null }))
  }

  const handleUploadAndCreate = async () => {
    if (!file || !personaId) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const sess = await createDefenseSession(file, personaId, scenarioType)
      setState((s) => ({ ...s, loading: false, session: sess, step: 2 }))
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e.message || '创建失败' }))
    }
  }

  const handleStart = async () => {
    if (!session) return
    setState((s) => ({ ...s, starting: true, error: null }))
    try {
      const started = await startDefenseSession(session.id)
      if (started.room_id) {
        navigate(`/chat/${started.room_id}`)
      }
    } catch (e: any) {
      setState((s) => ({ ...s, starting: false, error: e.message || '启动失败' }))
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-header">
        <button className="dp-back" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="dp-title">答辩准备</h1>
      </div>

      {error && <div className="dp-error">{error}</div>}

      {step === 1 && (
        <div className="dp-step">
          <div className="dp-section">
            <h2 className="dp-section-label">1. 上传文档</h2>
            <div
              className="dp-drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="dp-file-info">
                  <FileText size={24} />
                  <span>{file.name}</span>
                  <button onClick={() => setState((s) => ({ ...s, file: null }))}>
                    重选
                  </button>
                </div>
              ) : (
                <label className="dp-upload-label">
                  <Upload size={32} />
                  <span>拖拽文件到这里，或点击选择</span>
                  <span className="dp-hint">支持 PPT、PDF、Word</span>
                  <input
                    type="file"
                    accept=".pptx,.pdf,.docx,.txt,.md"
                    onChange={handleFileChange}
                    hidden
                  />
                </label>
              )}
            </div>
          </div>

          <div className="dp-section">
            <h2 className="dp-section-label">2. 选择上级</h2>
            <div className="dp-persona-grid">
              {personas.map((p) => (
                <button
                  key={p.id}
                  className={`dp-persona-card ${personaId === p.id ? 'selected' : ''}`}
                  onClick={() => setState((s) => ({ ...s, personaId: p.id }))}
                >
                  <div
                    className="dp-persona-avatar"
                    style={{ backgroundColor: p.avatar_color || '#6366f1' }}
                  >
                    {p.name.charAt(0)}
                  </div>
                  <div className="dp-persona-name">{p.name}</div>
                  <div className="dp-persona-role">{p.role}</div>
                </button>
              ))}
            </div>
            {personas.length === 0 && (
              <p className="dp-empty">暂无 Persona，请先创建一个上级画像</p>
            )}
          </div>

          <div className="dp-section">
            <h2 className="dp-section-label">3. 选择场景</h2>
            <div className="dp-scenario-grid">
              {SCENARIO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`dp-scenario-card ${scenarioType === opt.value ? 'selected' : ''}`}
                  onClick={() => setState((s) => ({ ...s, scenarioType: opt.value }))}
                >
                  <div className="dp-scenario-label">{opt.label}</div>
                  <div className="dp-scenario-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            className="dp-start-btn"
            disabled={!file || !personaId || loading}
            onClick={handleUploadAndCreate}
          >
            {loading ? <Loader2 size={20} className="spin" /> : null}
            {loading ? '解析中...' : '上传并准备'}
          </button>
        </div>
      )}

      {step === 2 && session && (
        <div className="dp-step">
          <div className="dp-section">
            <h2 className="dp-section-label">文档已解析</h2>
            <div className="dp-summary-card">
              <FileText size={20} />
              <span>{session.document_title}</span>
            </div>
          </div>
          <p className="dp-confirm-text">
            点击开始后，AI 将基于文档内容和上级画像生成提问策略，然后进入模拟答辩。
          </p>
          <button
            className="dp-start-btn"
            disabled={starting}
            onClick={handleStart}
          >
            {starting ? <Loader2 size={20} className="spin" /> : <Play size={20} />}
            {starting ? '生成提问策略中...' : '开始模拟答辩'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create CSS**

```css
/* frontend/src/pages/DefensePrepPage.css */
.dp-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px;
}
.dp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.dp-back {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 8px;
}
.dp-back:hover { background: var(--surface-hover); }
.dp-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.dp-error {
  background: var(--rose-50, #fff1f2);
  color: var(--rose-700, #be123c);
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}
.dp-step { display: flex; flex-direction: column; gap: 24px; }
.dp-section-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 10px;
}
.dp-drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  transition: border-color 0.2s;
}
.dp-drop-zone:hover { border-color: var(--green-500); }
.dp-upload-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}
.dp-hint { font-size: 13px; color: var(--text-tertiary); }
.dp-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}
.dp-file-info button {
  background: none;
  border: none;
  color: var(--green-600);
  cursor: pointer;
  font-size: 13px;
}
.dp-persona-grid, .dp-scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.dp-persona-card, .dp-scenario-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.dp-persona-card.selected, .dp-scenario-card.selected {
  border-color: var(--green-500);
  box-shadow: 0 0 0 3px var(--green-100, #dcfce7);
}
.dp-persona-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 16px;
}
.dp-persona-name { font-size: 14px; font-weight: 600; }
.dp-persona-role { font-size: 12px; color: var(--text-tertiary); }
.dp-scenario-label { font-size: 14px; font-weight: 600; }
.dp-scenario-desc { font-size: 12px; color: var(--text-tertiary); }
.dp-start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--green-600);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.dp-start-btn:hover:not(:disabled) { background: var(--green-700); }
.dp-start-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.dp-summary-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--surface-hover);
  border-radius: 10px;
}
.dp-confirm-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.dp-empty {
  font-size: 14px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 20px;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Add routes to App.tsx**

In `frontend/src/App.tsx`, add import:
```tsx
import DefensePrepPage from './pages/DefensePrepPage'
```

Add routes inside the `<Route element={<Layout />}>` block, after the battle-prep route:
```tsx
<Route path="defense-prep" element={<DefensePrepPage />} />
```

- [ ] **Step 4: Run frontend dev to verify**

Run: `cd frontend && npm run dev`
Navigate to `http://localhost:5173/defense-prep` — confirm the page renders.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DefensePrepPage.tsx \
  frontend/src/pages/DefensePrepPage.css \
  frontend/src/App.tsx
git commit -m "feat(defense-prep): add DefensePrepPage with upload + persona/scenario selection"
```

---

## Task 10: Frontend — Defense Report Component

**Files:**
- Create: `frontend/src/components/defense/DefenseReport.tsx`
- Create: `frontend/src/components/defense/DefenseReport.css`

- [ ] **Step 1: Create DefenseReport component**

```tsx
// frontend/src/components/defense/DefenseReport.tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import type { DefenseReport as DefenseReportType } from '../../services/api'
import './DefenseReport.css'

interface Props {
  report: DefenseReportType
}

export default function DefenseReport({ report }: Props) {
  const radarData = Object.entries(report.dimension_scores).map(([name, score]) => ({
    dimension: name,
    score,
    fullMark: 10,
  }))

  return (
    <div className="dr-container">
      <div className="dr-header">
        <div className="dr-overall-score">{report.overall_score.toFixed(1)}</div>
        <div className="dr-overall-label">综合评分</div>
      </div>

      <div className="dr-radar-section">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
            <Radar
              name="评分"
              dataKey="score"
              stroke="var(--green-600)"
              fill="var(--green-500)"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="dr-summary">
        <h3>总结</h3>
        <p>{report.summary}</p>
      </div>

      <div className="dr-improvements">
        <h3>Top 改进建议</h3>
        <ol>
          {report.top_improvements.map((imp, i) => (
            <li key={i}>{imp}</li>
          ))}
        </ol>
      </div>

      <div className="dr-reviews">
        <h3>逐题回顾</h3>
        {report.question_reviews.map((qr, i) => (
          <div key={i} className="dr-review-card">
            <div className="dr-review-q">
              <strong>Q{i + 1}:</strong> {qr.question}
            </div>
            <div className="dr-review-a">
              <strong>回答要点:</strong> {qr.user_answer_summary}
            </div>
            <div className="dr-review-score">
              得分: <span className="dr-score-badge">{qr.score}/10</span>
            </div>
            <div className="dr-review-feedback">{qr.feedback}</div>
            {qr.improvement && (
              <div className="dr-review-improve">
                <strong>改进:</strong> {qr.improvement}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create CSS**

```css
/* frontend/src/components/defense/DefenseReport.css */
.dr-container { display: flex; flex-direction: column; gap: 24px; }
.dr-header { text-align: center; }
.dr-overall-score {
  font-size: 48px;
  font-weight: 800;
  color: var(--green-600);
}
.dr-overall-label { font-size: 14px; color: var(--text-secondary); }
.dr-summary p, .dr-improvements ol { font-size: 14px; line-height: 1.7; color: var(--text-primary); }
.dr-improvements ol { padding-left: 20px; }
.dr-improvements li { margin-bottom: 6px; }
.dr-reviews h3, .dr-summary h3, .dr-improvements h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
}
.dr-review-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}
.dr-review-q { font-weight: 500; }
.dr-review-a { color: var(--text-secondary); }
.dr-score-badge {
  display: inline-block;
  background: var(--green-100, #dcfce7);
  color: var(--green-700);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
}
.dr-review-feedback { color: var(--text-primary); }
.dr-review-improve { color: var(--amber-700, #b45309); font-size: 13px; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/defense/
git commit -m "feat(defense-prep): add DefenseReport component with radar chart"
```

---

## Task 11: Frontend — HomePage Entry + Navigation

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Add "答辩准备" entry to HomePage**

Read `frontend/src/pages/HomePage.tsx` to find the existing entry cards pattern (e.g., the battle-prep card). Add a similar card that navigates to `/defense-prep`:

Look for the pattern like:
```tsx
<div className="..." onClick={() => navigate('/battle-prep')}>
```

Add a parallel card:
```tsx
<div className="hp-card" onClick={() => navigate('/defense-prep')}>
  <FileText size={28} />
  <h3>答辩准备</h3>
  <p>上传文档，模拟上级提问</p>
</div>
```

Import `FileText` from lucide-react if not already imported.

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:5173/` — confirm "答辩准备" card appears and navigates correctly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat(defense-prep): add entry card to HomePage"
```

---

## Task 12: Integration Smoke Test

- [ ] **Step 1: Start backend**

Run: `cd backend && uv run python main.py`

- [ ] **Step 2: Start frontend**

Run: `cd frontend && npm run dev`

- [ ] **Step 3: End-to-end verification**

1. Navigate to `http://localhost:5173/`
2. Click "答辩准备"
3. Upload a test .txt or .pptx file
4. Select a Persona
5. Select a scenario (述职答辩)
6. Click "上传并准备" → verify session is created
7. Click "开始模拟答辩" → verify redirect to chat room
8. Verify the chat room loads with the persona

- [ ] **Step 4: Commit any fixes found during smoke test**

```bash
git add -A && git commit -m "fix(defense-prep): integration fixes from smoke test"
```

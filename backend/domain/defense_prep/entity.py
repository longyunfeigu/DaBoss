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
    id: Optional[int]
    persona_ids: list[str]
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
        if not self.persona_ids:
            raise DomainValidationException(
                "至少需要选择一位答辩官",
                field="persona_ids",
            )
        if len(self.persona_ids) > 5:
            raise DomainValidationException(
                "最多选择 5 位答辩官",
                field="persona_ids",
            )
        if self.created_at is None:
            self.created_at = _utcnow()

    def start(self, room_id: int) -> None:
        self.status = DefenseSessionStatus.IN_PROGRESS
        self.room_id = room_id

    def complete(self) -> None:
        self.status = DefenseSessionStatus.COMPLETED

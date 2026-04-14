# input: 无外部依赖
# output: DocumentSummary, Section, QuestionStrategy, PlannedQuestion 值对象
# owner: wanhua.gu
# pos: 领域层 - 答辩准备值对象定义；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
"""Value objects for the defense prep aggregate."""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Section:
    title: str
    bullet_points: list[str] = field(default_factory=list)


@dataclass
class DocumentSummary:
    title: str
    sections: list[Section] = field(default_factory=list)
    key_data: list[str] = field(default_factory=list)
    raw_text: str = ""


@dataclass
class PlannedQuestion:
    question: str
    dimension: str
    difficulty: str = "basic"
    expected_direction: str = ""


@dataclass
class QuestionStrategy:
    questions: list[PlannedQuestion] = field(default_factory=list)

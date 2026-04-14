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
        "dimensions": ["数据掌握度", "逻辑严密性", "应变能力", "坦诚度", "表达清晰度", "格局视野"],
        "question_angles": [
            "核心业绩的归因分析（个人贡献 vs 团队/环境因素）",
            "关键数据的可信度和完整性",
            "失败/不足的坦诚度",
            "未来规划的可行性和野心度",
        ],
    },
    ScenarioType.PROPOSAL_REVIEW: {
        "name": "方案评审",
        "dimensions": ["方案完整性", "风险意识", "数据论证", "替代思考", "执行可行性", "应变能力"],
        "question_angles": [
            "最大的技术/业务风险是什么",
            "为什么不选其他方案",
            "如果资源砍半怎么办",
            "成功的衡量标准是什么",
        ],
    },
    ScenarioType.PROJECT_REPORT: {
        "name": "项目汇报",
        "dimensions": ["进度把控", "问题识别", "资源协调", "风险预判", "数据支撑", "下步计划"],
        "question_angles": [
            "进度延迟的真实原因",
            "风险缓释措施的有效性",
            "跨部门协调的瓶颈",
            "对项目成功标准的理解",
        ],
    },
    ScenarioType.GENERAL: {
        "name": "通用文档答辩",
        "dimensions": ["内容掌握度", "逻辑严密性", "应变能力", "数据支撑", "表达清晰度", "深度思考"],
        "question_angles": [
            "文档核心观点的论据强度",
            "数据和结论之间的因果关系",
            "潜在反对意见的预判",
            "后续行动的可执行性",
        ],
    },
}

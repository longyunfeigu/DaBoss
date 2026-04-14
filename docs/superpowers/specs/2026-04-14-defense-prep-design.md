# Defense Prep — 文档答辩模拟

**日期**: 2026-04-14
**状态**: 设计完成，待实现

## 概述

新增"答辩准备"场景，用户上传文档（PPT/PDF/Word），选择已有 Persona（上级），AI 扮演该上级基于文档内容进行提问模拟。支持实时反馈和结束后多维度总评。

与 battle_prep（会议模拟）并列的独立场景，复用 Persona、Chat Room、Coaching、Analysis 已有能力。

## 核心流程

```
上传文档 → 选择 Persona + 场景模板 → 生成提问策略 → 模拟对话 → 总评报告
```

详细流程：

1. **上传文档**：用户上传 PPT/PDF/Word 文件，系统解析为结构化摘要
2. **选择上级 Persona**：从已有 Persona 列表选择，提问风格和关注点来自 Persona 5层画像
3. **选择场景模板**：述职答辩 / 方案评审 / 项目汇报 / 通用，模板定义提问维度
4. **生成提问策略**：LLM 基于(文档内容 × Persona关注点 × 场景维度)交叉分析，生成 8-12 个优先级排序的问题
5. **模拟对话**：AI 逐一提问，用户回答后给追问或点评（实时 coaching），6-10 轮
6. **总评报告**：多维度评分 + 逐题回顾 + 改进建议

## 领域模型

### 新增聚合：defense_prep

```python
# domain/defense_prep/entity.py
class DefenseSession:
    id: UUID
    persona_id: UUID              # 关联已有 Persona
    scenario_type: ScenarioType   # 场景类型
    document_summary: DocumentSummary  # 解析后的文档摘要
    question_strategy: QuestionStrategy | None  # LLM生成的提问策略
    room_id: UUID | None          # 关联的 chat room
    status: DefenseSessionStatus  # preparing → in_progress → completed

class DefenseSessionStatus(str, Enum):
    PREPARING = "preparing"       # 已上传文档，未开始
    IN_PROGRESS = "in_progress"   # 模拟进行中
    COMPLETED = "completed"       # 模拟结束
```

### 场景模板

```python
# domain/defense_prep/scenario.py
class ScenarioType(str, Enum):
    PERFORMANCE_REVIEW = "performance_review"  # 述职答辩
    PROPOSAL_REVIEW = "proposal_review"        # 方案评审
    PROJECT_REPORT = "project_report"          # 项目汇报
    GENERAL = "general"                        # 通用
```

每个场景定义：
- **提问维度**：述职(业绩成果/数据支撑/方法论/团队协作/自我反思/未来规划)，方案评审(可行性/风险评估/ROI/替代方案/执行计划/资源需求)
- **提问角度**：场景特有的追问方向
- **评分标准**：与维度对应的评分项

### 文档摘要

```python
# domain/defense_prep/value_objects.py
@dataclass
class DocumentSummary:
    title: str
    sections: list[Section]      # 章节标题 + 要点列表
    key_data: list[str]          # 关键数据/指标
    raw_text: str                # 全文文本

@dataclass
class Section:
    title: str
    bullet_points: list[str]

@dataclass
class QuestionStrategy:
    questions: list[PlannedQuestion]

@dataclass
class PlannedQuestion:
    question: str
    dimension: str               # 对应哪个评估维度
    difficulty: str              # basic / advanced / stress_test
    expected_direction: str      # 期望回答方向（评分参考）
```

## 分层设计

### 依赖方向

```
API (defense-prep routes)
  → Application (DefensePrepService)
    → Domain (DefenseSession, Scenario)
    ← Infrastructure (DocumentParserAdapter, DefenseSessionRepository)
```

### 各层新增组件

| 层 | 组件 | 职责 |
|---|---|---|
| **Domain** | `defense_prep/entity.py` | DefenseSession 实体 |
| **Domain** | `defense_prep/scenario.py` | ScenarioType + 场景配置 |
| **Domain** | `defense_prep/repository.py` | DefenseSessionRepository 接口 |
| **Application** | `services/defense_prep_service.py` | 编排：文档解析→策略生成→创建room→模拟控制 |
| **Application/Ports** | `ports/document_parser.py` | DocumentParser 接口 |
| **Infrastructure** | `external/document_parser/` | PPT/PDF/Word 解析实现 |
| **Infrastructure** | `repositories/defense_session_repository.py` | 持久化实现 |
| **Infrastructure** | `models/defense_session.py` | ORM 模型 |
| **API** | `routes/defense_prep.py` | REST 路由 |

### 复用已有能力

| 能力 | 来源 | 复用方式 |
|---|---|---|
| Persona 画像 | `domain/stakeholder/` | 直接引用，读取 5 层画像用于 prompt |
| Chat Room | `domain/chat/` | 新增 `DEFENSE` room type |
| Coaching | `CoachingService` | 实时点评，注入文档上下文 |
| Analysis | `AnalysisService` | 结束总评，使用场景维度替换默认维度 |
| LLM | `application/ports/llm.py` | 复用现有 LLM port |

## 提问策略生成

### Prompt 设计

```
System:
你是一位{Persona.identity.role}，{Persona.expression_style.tone}风格。
你的关注点：{Persona.decision_pattern.typical_questions}
你的提问倾向：{Persona.interpersonal_style}

你正在参加一场{scenario.name}会议。

以下是被评审者提交的文档：
---
{document_summary.raw_text}
---

请分析这份文档，基于以下维度生成提问策略：
{scenario.dimensions}

要求：
1. 找出文档中数据薄弱、逻辑不严密、结论缺少支撑的地方
2. 生成 8-12 个问题，按优先级排序
3. 每个问题标注：目标维度、难度(basic/advanced/stress_test)、期望回答方向
4. 问题应符合你的角色风格和关注点
```

### 动态调整

提问策略在模拟开始前生成，但对话中 AI 会根据用户回答动态调整：
- 回答充分的维度 → 跳过或简化
- 回答薄弱的维度 → 追问深挖
- 发现新的追问点 → 即时提出

## 评分体系

### 述职答辩维度

| 维度 | 说明 | 权重 |
|---|---|---|
| 数据掌握度 | 能否精确引用关键数据 | 20% |
| 逻辑严密性 | 论证是否有理有据 | 20% |
| 应变能力 | 面对追问/压力问题的反应 | 15% |
| 坦诚度 | 对不足的认知和表达 | 15% |
| 表达清晰度 | 回答是否简洁有力 | 15% |
| 格局视野 | 是否有超出本职的思考 | 15% |

### 方案评审维度

| 维度 | 说明 | 权重 |
|---|---|---|
| 方案完整性 | 是否覆盖关键要素 | 20% |
| 风险意识 | 对风险的识别和应对 | 20% |
| 数据论证 | ROI等关键数据是否可信 | 15% |
| 替代思考 | 是否考虑过其他方案 | 15% |
| 执行可行性 | 计划是否切实可行 | 15% |
| 应变能力 | 面对质疑的反应 | 15% |

### 总评报告结构

```
{
  "overall_score": 7.5,         # 综合得分 (1-10)
  "dimension_scores": {         # 各维度得分
    "数据掌握度": 8,
    "逻辑严密性": 7,
    ...
  },
  "question_reviews": [         # 逐题回顾
    {
      "question": "...",
      "user_answer_summary": "...",
      "score": 8,
      "feedback": "...",
      "improvement": "..."
    }
  ],
  "summary": "...",             # 一句话总结
  "top_improvements": [...]     # Top 3 改进建议
}
```

## API 设计

### 端点

```
POST   /api/defense-prep/sessions              # 上传文档 + 创建会话
  - multipart/form-data: file + persona_id + scenario_type
  - 返回: DefenseSession (status=preparing, 含 document_summary)

GET    /api/defense-prep/sessions/{id}          # 获取会话详情

POST   /api/defense-prep/sessions/{id}/start    # 开始模拟
  - 生成提问策略，创建 defense room
  - 返回: { room_id, question_strategy }

GET    /api/defense-prep/sessions/{id}/report   # 获取总评报告
  - 返回: DefenseReport
```

对话交互复用已有 chat API：`/api/chat/rooms/{room_id}/messages`

## 前端设计

### 新增页面：DefensePrepPage

**Step 1 - 上传文档**：
- 拖拽上传区域，支持 PPT/PDF/Word
- 上传后显示解析进度 → 摘要预览

**Step 2 - 选择上级 & 场景**：
- Persona 选择器（复用已有组件）
- 场景模板卡片选择

**Step 3 - 模拟对话**：
- 三栏布局：左(文档摘要) | 中(对话流) | 右(进度+维度指示)
- 复用 ChatPage 的 MessageList、ChatInput 组件
- 新增：进度指示器（已问/总问题、当前维度标签）

**Step 4 - 总评报告**：
- 雷达图（各维度评分，复用 GrowthPage 的 Recharts 组件）
- 逐题回顾列表（问题 + 评分 + 反馈 + 改进建议）
- 一句话总结 + Top 3 改进建议

### 路由

```
/defense-prep          # 入口：上传文档 + 选择
/defense-prep/:id      # 模拟对话
/defense-prep/:id/report  # 总评报告
```

## 文档解析实现

### 依赖库

- PPT: `python-pptx` — 提取 slide text, notes
- PDF: `PyPDF2` / `pdfplumber` — 提取文本和表格
- Word: `python-docx` — 提取段落和标题层级

### 解析策略

统一输出 `DocumentSummary`：
1. 提取所有文本内容
2. 识别标题/章节结构
3. 提取数字/数据/指标
4. 生成 raw_text（给 LLM 的完整文本）

## 技术约束

- 文件大小限制：20MB
- 支持格式：.pptx, .pdf, .docx
- 文档解析为同步操作（文件不大，不需要异步队列）
- 提问策略生成使用 streaming（显示生成进度）
- 模拟对话轮数：6-10 轮，可配置
- 总评生成使用 structured output

## 不在第一版范围

- 文档版本管理/历史
- 多人协作答辩
- 语音输入/输出
- 自定义评分维度
- 答辩录像回放

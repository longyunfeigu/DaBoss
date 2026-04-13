# domain/stakeholder

利益相关者聊天聚合 — 领域层（纯业务逻辑，无外部依赖）。

## 文件索引

| 文件 | 职责 |
|------|------|
| `entity.py` | ChatRoom / Message / AnalysisReport / CoachingSession / CoachingMessage 领域实体，含类型验证和 UTC 时间处理 |
| `persona_entity.py` | **(Story 2.2)** Persona 聚合 + 5-layer 子类型 (HardRule / IdentityProfile / ExpressionStyle / DecisionPattern / InterpersonalStyle) + Evidence 证据链；v1/v2 schema 兼容 |
| `competency_entity.py` | CompetencyEvaluation 领域实体 |
| `organization_entity.py` | Organization / Team / PersonaRelationship 领域实体 |
| `scenario_entity.py` | Scenario 领域实体 |
| `repository.py` | 全部抽象仓储接口：ChatRoom / Message / Scenario / AnalysisReport / CoachingSession / CoachingMessage / Organization / Team / PersonaRelationship / CompetencyEvaluation / **StakeholderPersona (Story 2.2)** |
| `service.py` | ChatRoomDomainService — 聊天室创建业务规则（私聊1人/群聊>=2人） |

## 领域规则

- `ChatRoom.type` 只允许 `private` / `group`
- `Message.sender_type` 只允许 `user` / `persona` / `system`
- 私聊聊天室 `persona_ids` 必须恰好 1 个
- 群聊聊天室 `persona_ids` 至少 2 个
- `Evidence.layer` 只允许 `hard_rules` / `identity` / `expression` / `decision` / `interpersonal`
- `Persona.schema_version`: 1 = legacy markdown (full_content 有值), 2 = 5-layer structured (structured_* 字段有值)

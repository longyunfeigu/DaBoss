# Data Model Delta

> 本文档按需增量维护 — 仅记录 Story/feature 引入的新表或 schema 变化，不是完整 DB schema 文档。

---

## Story 2.2 (2026-04-13): stakeholder_personas 表

### 表 `stakeholder_personas`

DDL delta: [alembic ac7fa9a4e143](../backend/alembic/versions/20260413_1625-ac7fa9a4e143_create_stakeholder_personas_table.py)

首次创建的表，同时承载 v1 (legacy markdown) 与 v2 (5-layer structured) 两种 schema。

| 列 | 类型 | Null | Default | 说明 |
|---|---|---|---|---|
| id | String(50) | NO | — | PK，与 markdown 文件名一致（如 `boss`/`cfo`） |
| name | String(255) | NO | — | 角色名 |
| role | String(255) | NO | — | 职位/角色 |
| avatar_color | String(20) | YES | NULL | UI 头像色 |
| organization_id | Integer | YES | NULL | 所属组织 |
| team_id | Integer | YES | NULL | 所属团队 |
| profile_summary | Text | NO | '' | 画像摘要 |
| full_content | Text | NO | '' | v1 markdown 全文 |
| voice_id | String(100) | YES | NULL | TTS voice id |
| voice_speed | Float | NO | 1.0 | TTS 语速 |
| voice_style | String(50) | YES | NULL | TTS 风格 |
| **structured_profile** | JSON | YES | NULL | v2 5-layer 结构化（hard_rules / identity / expression / decision / interpersonal） |
| **evidence_citations** | JSON | YES | NULL | v2 证据链（list[Evidence]） |
| **schema_version** | Integer | NO | 1 | 1 = legacy markdown, 2 = structured |
| **source_materials** | JSON | YES | NULL | v2 原始素材 id/片段列表 |
| **legacy_content** | Text | YES | NULL | 迁移前 markdown 备份（Story 2.3 使用） |
| created_at / updated_at / deleted_at | DateTime(tz) | — | now() | TimestampMixin |

### Index
- `ix_stakeholder_personas_schema_version` on `schema_version`（PersonaLoader.refresh_from_db 按 v2 过滤）

### 设计决策

1. **JSON 而不是 JSONB / TEXT[]**：跨 SQLite (测试) + Postgres (生产) 兼容，避免方言差异。
2. **Evidence 内嵌 JSON，不拆独立表**：Evidence 是 Persona 强聚合成员，KISS 原则。
3. **单表承载 v1+v2**：避免后续再做一次 ALTER；v1 记录通过 schema_version=1 标识，`full_content` 非空；v2 记录 `structured_profile` 非空。
4. **PK 用 string id 而不是 int**：保持与 markdown 文件名（`boss.md` → `id="boss"`）一致，便于迁移和人类可读。

### 消费者

- `infrastructure/models/stakeholder_persona.py` — ORM
- `infrastructure/repositories/stakeholder_persona_repository.py` — SQL 实现
- `application/services/stakeholder/persona_loader.py::PersonaLoader.refresh_from_db` — 可选加载 v2
- 后续 Story: 2.3 (迁移脚本写入), 2.4 (PersonaBuilderService 写入), 2.7 (Editor 更新)

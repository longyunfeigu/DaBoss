# backend/scripts

一次性 / 维护型脚本工具。每个脚本都可以独立运行（多数走 `uv run python scripts/<name>.py`），不参与 FastAPI 应用 lifespan。

## 文件索引

| 脚本 | 用途 |
|------|------|
| `gen_protos.sh` | 从 `grpc_app/protos/*.proto` 生成 Python gRPC stub 到 `grpc_app/generated/` |
| `validate_po.py` | 校验 `locales/**/*.po` 翻译文件（语法 + 覆盖率 + 未翻译条目） |
| `migrate_personas_to_v2.py` | Story 2.3 — 把 `data/personas/*.md` + DB 中 schema_version=1 的 persona 迁移到 v2 5-layer 结构（幂等 + 失败隔离 + `--dry-run`） |

## 常用用法

```bash
# 协议 stub 生成
bash backend/scripts/gen_protos.sh

# 翻译文件校验
cd backend && uv run python scripts/validate_po.py

# Persona v1 → v2 迁移（dry-run，不调 LLM、不写 DB）
cd backend && uv run python scripts/migrate_personas_to_v2.py --dry-run

# Persona v1 → v2 迁移（真实，需 STAKEHOLDER__ANTHROPIC_API_KEY）
cd backend && uv run python scripts/migrate_personas_to_v2.py
```

`migrate_personas_to_v2.py` 输出末行格式固定为 `Migrated: N, Failed: M, Skipped: K`，便于 CI/log 解析。

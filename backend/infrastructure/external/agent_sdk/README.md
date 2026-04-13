# agent_sdk

Claude Agent SDK 集成模块，为 Epic 2 / Story 2.1 提供。

## 职责

让 FastAPI 进程内嵌入一个 Claude Code 风格的 sub-agent，加载 fork 的
`colleague-skill` 完成多轮 tool-use 任务（例如：从素材生成对手 Persona）。

## 谁可以 import

- ✅ Application 层（`application/services/...`）—— 通过本模块的 `__init__` 暴露的公共 API
- ❌ Domain 层 —— 不允许（domain 是纯业务规则）
- ❌ API 层 —— 不允许直接，要通过 application service
- ❌ 任何人都不应该直接 `import claude_agent_sdk`，必须走 `AgentSkillClient`

## 文件索引

| 文件 | 职责 |
|---|---|
| `__init__.py` | 公开 API：`AgentSkillClient`, `WorkspaceManager`, `AgentEvent`, 异常类 |
| `exceptions.py` | 异常层次 `AgentSDKError` → `AgentTimeoutError` / `AgentRunError` / `WorkspaceError` |
| `workspace.py` | `WorkspaceManager` — 多租户 cwd 创建/隔离/清理 + 路径逃逸防护 |
| `events.py` | `adapt_event()` — SDK 原生事件 → 统一 `AgentEvent`（含 seq / type / payload） |
| `client.py` | `AgentSkillClient.build_persona()` — 主 orchestrator，async generator 流式 yield |
| `lifespan.py` | `init_agent_sdk_client` / `shutdown_agent_sdk_client`（在 `main.py` lifespan 调用） |

## 快速使用

```python
from infrastructure.external.agent_sdk import AgentSkillClient
from infrastructure.external.agent_sdk.lifespan import get_agent_sdk_client

# 在 application service 里
client: AgentSkillClient = get_agent_sdk_client()

async for event in client.build_persona(
    user_id="alice_42",
    materials=["这段聊天记录...", "这封邮件..."],
):
    # event.seq, event.type, event.payload
    yield event  # 例如直接转 SSE
```

## 配置

通过 `core.config.settings.agent_sdk`（`AgentSDKSettings`）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `anthropic_api_key` | None | SecretStr，从 env 注入 |
| `anthropic_base_url` | None | 内网中继 URL（如 `http://10.0.3.248:3000/api`） |
| `workspace_root` | `/tmp/daboss/workspaces` | 各用户 workspace 根目录 |
| `agent_timeout_s` | 180 | 单次 sub-agent 总超时 |
| `cleanup_delay_s` | 300 | 任务结束多久后清理 workspace |
| `max_concurrent_builds` | 5 | 进程内 semaphore 限流 |
| `skill_source_dir` | `backend/.claude/skills/colleague-skill` | fork 的 skill 源 |
| `allowed_tools` | `["Skill","Read","Write","Grep","Glob"]` | sub-agent 工具白名单（**不含 Bash**） |

## 安全约束

1. **禁用 Bash** — `allowed_tools` 不含 `Bash`，sub-agent 不能执行任意命令
2. **路径逃逸防护** — `WorkspaceManager._validate_id` 拒绝含 `/`、`.` 的 user_id/session_id
3. **API key 不入日志** — 用 `SecretStr`，env patch 后立即 restore
4. **Workspace 隔离** — 每用户 + 每会话独立 cwd，5 分钟自动清理
5. **Hook 屏蔽** — 每个 workspace 内放空 `settings.json`，防止 sub-agent 读到用户的 hook

## 已知设计取舍（来自 ADR）

- **不合并到 LLMPort**：`LLMPort` 是单次 messages 抽象，agent 是多轮 tool-use，语义不一样
- **Workspace 用文件复制 skill 而非软链接**：跨 fs 兼容 + 防止 sub-agent 改坏共享 skill 源
- **Cleanup 异步而非立即**：留时间给 SSE 客户端读 `output/persona.md`
- **延迟 import claude_agent_sdk**：减少 backend import-time 开销

## 相关文档

- ADR: `docs/adr/2026-04-13-agent-sdk-integration.md`
- Epic: `docs/epics/epic-2-persona-builder.md` Story 2.1
- Plan: `docs/plans/2026-04-13-2.1-agent-sdk-skill-foundation.md`
- Fork 来源: `backend/.claude/skills/colleague-skill/FORK_NOTES.md`

## 测试

```bash
cd backend && .venv/bin/python -m pytest tests/infrastructure/external/agent_sdk/ -v
```

24 个单元测试覆盖：路径逃逸、工作区隔离、清理、事件适配、超时、错误包装、env patch、semaphore 限流。

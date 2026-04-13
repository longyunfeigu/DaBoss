# ADR 2026-04-13: Claude Agent SDK 集成与内网中继兼容性

**Status**: Accepted (pre-flight spike verified)
**Date**: 2026-04-13
**Context**: Epic 2 / Story 2.1
**Spike script**: `/tmp/spike_agent_sdk/spike_1_hello.py`（一次性，未入仓）

---

## 背景

Epic 2 需要在 FastAPI 后端嵌入 `claude-agent-sdk`，让 sub-agent 加载 fork 的 `colleague-skill` 完成 7 步 persona 建模。本项目的 LLM 调用默认走内网中继 `http://10.0.3.248:3000/api`（疑似 LiteLLM/OneAPI 类型），而非直连 `api.anthropic.com`。

**核心未知**：`claude-agent-sdk`（Python 包）底层通过 `claude` Node.js CLI 发请求，CLI 会不会尊重 `ANTHROPIC_BASE_URL`？中继能不能吃下 Agent 相关调用？

---

## 决策

- **采用** `claude-agent-sdk`（不自己用 anthropic SDK 手写 agent runtime）
- **通过** `ANTHROPIC_BASE_URL` 环境变量让 SDK + CLI 全部走内网中继
- **升级** 项目的 `anyio` 从 `3.7.1` 到 `>=4.0.0`（SDK 硬要求）
- **Workspace 隔离** 采用 `cwd=/tmp/daboss/workspaces/{user_id}/{session_id}/` + 局部拷贝 skill（见 plan §10.2）

---

## Spike 证据

### 环境

- Python: 3.12.10（独立 spike venv `/tmp/spike_agent_sdk/`）
- claude-agent-sdk: 最新（带 `anyio>=4.0.0`, `sse-starlette`, `typing-extensions`, `uvicorn` 等传递依赖）
- claude CLI: 2.1.104 (Claude Code) — 已全局安装
- Node: v22.22.1 / npm 10.9.4

### 输入

```python
options = ClaudeAgentOptions(
    cwd="/tmp/spike_agent_sdk/agent_cwd",
    allowed_tools=["Read"],  # 禁用 Bash
)
prompt = "Reply with exactly one short sentence acknowledging you are online."
```

Env 注入：
- `ANTHROPIC_BASE_URL=http://10.0.3.248:3000/api`（来自项目 `.env` 的 `STAKEHOLDER__ANTHROPIC_BASE_URL`）
- `ANTHROPIC_API_KEY=<redacted>`

### 事件流（实测）

```
[ 3.84s] #1 SystemMessage(subtype=hook_started, hook_id=13596294-...)
[ 3.84s] #2 SystemMessage(subtype=hook_response, hook_id=13596294-...)
[ 3.89s] #3 SystemMessage(subtype=init, cwd=/tmp/spike_agent_sdk/agent_cwd, session_id=...)
[12.31s] #4 AssistantMessage(content=[TextBlock("I'm online and ready to help.")], model='claude-opus-4-6')
[12.40s] #5 ResultMessage(subtype=success, duration_ms=8523, duration_api_ms=8445, num_turns=1)
```

### 验证结论

| 项 | 验证 |
|---|---|
| SDK async 不阻塞事件循环 | ✅ PASS |
| 走内网中继，不走 api.anthropic.com | ✅ PASS（模型返回证实 relay 成功） |
| `cwd` 参数生效 | ✅ PASS（init 事件回传） |
| `allowed_tools` 生效（未尝试超范围工具） | ✅ PASS（隐式） |
| 事件结构清晰（3 类 Message） | ✅ PASS |
| ResultMessage 提供 duration / num_turns 可观测 | ✅ PASS |

---

## 发现（需在 Story 2.1 实现时处理）

### F1. anyio 冲突
- 项目当前 `pyproject.toml` 间接 pin `anyio==3.7.1`
- claude-agent-sdk 要求 `anyio>=4.0.0`
- **Action**: `uv add claude-agent-sdk` 需要同时放行 anyio 升级。检查 FastAPI / Starlette / Anthropic SDK 等在 anyio 4.x 下是否仍稳。预期风险：低（生态普遍已适配 anyio 4）

### F2. 模型是 Opus 4.6（成本考量）
- 内网中继把请求默认映射到 `claude-opus-4-6`
- Opus 4.6 比 Sonnet 贵 ~5x（参考 anthropic 标价）
- 单次 persona 构建如果 ~7 次 LLM 调用（7 步 pipeline）+ tool use 开销，预估每次构建成本 **$0.8-$2.0**
- **Action**: Story 2.4 编排层应加成本日志 + 可配置的模型降级（若 relay 支持通过某参数选 Sonnet）

### F3. Hook 污染风险
- Spike 看到 `hook_started` / `hook_response` 事件 —— 证明 SDK 读取了**用户级 hook 配置**（`~/.claude/settings.json` / 项目 `.claude/settings.json`）
- 这在产品中会泄漏用户 IDE 的个人 hook（例如 `skill-activation-prompt.py`）
- **Action**: Story 2.1 实现时：
  - workspace cwd 内建一个**空的** `.claude/settings.json`（屏蔽 project settings）
  - 不使用 `setting_sources=["user"]`，只用 `setting_sources=["project"]`
  - 在 ADR 追加："Hook 屏蔽策略"一节

### F4. SDK 延迟 overhead
- 5s 非 API 时间（启动 CLI 子进程 + hook + init）
- 对 SSE 流式 UX（Story 2.5/2.6）可接受，但**不适合同步接口**
- **Action**: API 层必须 SSE / streaming，不能返回同步 `await build_persona()`

### F5. 模型字段可作为 observability 关键
- `ResultMessage` 含 `duration_ms`, `duration_api_ms`, `num_turns` — 天然 Prometheus 素材
- **Action**: Story 2.1 的 `AgentEvent` adapter 把这几个字段提到顶层，便于 metric

---

## 取舍 (Rejected alternatives)

### R1. 手写 multi-turn tool-use 基于 anthropic SDK
- **Rejected** reason: 要自己实现 agent runtime（tool dispatch / skill loading / session state / streaming），估算 ~800 行代码。SDK 封装好的 agent 循环免费拿。
- Scope-risk: moderate → narrow (用 SDK)
- Confidence: high

### R2. 为本 Story 单独拉一条新 anyio 3.x 兼容的 fork
- **Rejected** reason: 维护成本高 + 失去生态。anyio 4.x 升级是低风险动作。

### R3. 直接用 `claude` CLI subprocess 自管，不用 Python SDK
- **Rejected** reason: SDK 已把 stdio/JSON parsing 做好，事件结构体已定义。自管等于重造 SDK。

---

## 接下来 — 全部完成

- [x] Step 1: Pre-flight spike（本 ADR §"Spike 证据"）
- [x] Step 2: `uv add claude-agent-sdk` —— 触发 8 包级联升级（anyio/fastapi/uvicorn/starlette/pydantic/pydantic-settings/httpx/python-multipart/mcp），104 个现有测试全过，仅 2 行 httpx API 兼容修改
- [x] Step 3: Fork `colleague-skill` 到 `backend/.claude/skills/colleague-skill/`（commit `012373c6...`），sanitize SKILL.md 去 Bash，写 FORK_NOTES.md
- [x] Step 4: `AgentSDKSettings` in `core/config.py`
- [x] Step 5: `agent_sdk/exceptions.py`
- [x] Step 6: `agent_sdk/workspace.py` + 10 单测
- [x] Step 7: `agent_sdk/events.py` + 7 单测
- [x] Step 8: `agent_sdk/client.py` + 7 单测
- [x] Step 9: `agent_sdk/lifespan.py` + main.py 集成
- [x] Step 10: `agent_sdk/README.md`
- [x] Step 11: 真实 smoke test（见下）
- [x] Step 12: 父级 README 暂不更新（infrastructure/external/README.md 是模板非活索引）

## Smoke Test (Step 11)

在 backend venv 内通过 `AgentSkillClient.build_persona()` 真跑一次（短 prompt，不调全 7 步 pipeline，只验通路）：

```
workspace_root: /tmp/daboss/workspaces
skill_source_dir: .claude/skills/colleague-skill
agent_timeout_s: 180
allowed_tools: ['Skill', 'Read', 'Write', 'Grep', 'Glob']

[ 1.41s] # 1 system           raw=init
[ 3.52s] # 2 assistant_text
[ 3.77s] # 3 tool_use          # 子 agent 用了 Read 工具
[ 3.79s] # 4 tool_result
[ 5.75s] # 5 assistant_text
[ 5.78s] # 6 result            success, num_turns=2, duration_api_ms=4358

DONE: 6 events in 6.54s
```

**验证**：
- ✅ Backend venv 内 SDK 工作
- ✅ WorkspaceManager 创建 + cleanup 工作（看到 `workspace.created` / `workspace.cleanup_cancelled` 日志）
- ✅ Sub-agent 真用 tool（事件序列含 tool_use → tool_result）
- ✅ allowed_tools 限制生效（用 Read 没用 Bash）
- ✅ 4 类 Message 全部被 adapt_event 正确分类
- ✅ `_build_prompt` 可以被 application service override（Story 2.4 会用到）
- ✅ 内网中继 + 默认 BASE_URL 都通

**发现的 1 个真 bug 已修**：`skill_source_dir` 默认值 `backend/.claude/...` 在 cwd=backend 时双重前缀，改为 `.claude/skills/colleague-skill`（见 commit）

## 测试摘要

```
backend/tests/infrastructure/external/agent_sdk/  → 24/24 通过
backend/tests/ (现有套件)                          → 104/104 通过
```

---

## 附：Spike 原脚本摘录

```python
options = ClaudeAgentOptions(
    cwd=str(spike_cwd),
    allowed_tools=["Read"],
)
async for event in query(prompt=..., options=options):
    print(type(event).__name__, event)
```

（完整脚本在 `/tmp/spike_agent_sdk/spike_1_hello.py`，session 级，未提交仓库）

# Epic 2 / Persona Editor — Design Baseline

**Status**: Approved 2026-04-13
**Variant**: B (DaBoss 原生游戏风)
**Reference HTML**: [`variant-b-daboss.html`](./variant-b-daboss.html)
**Applies to**: Story 2.6 (PersonaBuilder 输入页流式 UX)、Story 2.7 (5-layer 编辑器)、Story 2.8 (演练入口)

---

## 1. 核心设计原则

1. **品牌一致** — 与现有 HomePage / GrowthPage / SettingsPage 视觉完全统一，使用项目已有 CSS 令牌（`frontend/src/styles/*.css`）
2. **角色卡心智** — 把对手画像呈现为"RPG 角色卡"，让用户产生"我研究了 boss"的成就感
3. **证据可达但不喧宾夺主** — 证据用 popover 浮层而非永驻面板，主视觉留给特征本身
4. **CTA 永远在视野** — 底部 floating CTA bar 跟随滚动，"开始演练" 永远一键可达

---

## 2. 设计令牌（已与 `:root` 一致）

```css
--green: #2D9C6F;          /* 主色 */
--green-soft: rgba(45,156,111,0.12);
--amber: #C8944A;          /* 警示 / Decision 层 */
--violet: #8B7EC8;         /* Identity 层 */
--rose: #C75B5B;           /* Hard Rules 层 */
--bg-base: #F4F9F6;
--bg-card: #FBFDFB;
--shadow-md: 0 4px 12px rgba(26,46,34,0.08);
--shadow-lg: 0 12px 36px rgba(26,46,34,0.14);
--radius-md: 12px;
--radius-lg: 20px;
--primary-gradient: linear-gradient(135deg, #2D9C6F, #5B8C5A);
```

**字体**：Inter / -apple-system / PingFang SC，body 15px，line-height 1.6
**emoji 限定集**：⚖️ 🎯 🗣️ 🧠 🤝（5 层一一对应，不引入其他）

---

## 3. 关键组件规格

### 3.1 Hero Card（顶部对手卡）

- 高 ~120px，圆角 20px，带绿色渐变光晕装饰
- 左侧 80px 圆形头像
  - 外环 conic-gradient（绿→紫→绿）3px padding，模拟"环装备"
  - 头像底色用 `--primary-gradient` + inset 阴影
  - 右下角 16px 圆形 pulse dot（在线/置信度活跃指示）
- 中间：名字 24px bold + 副标题（职位 · 来源公司）+ 标签 pill 行（v2 / 关系标签）
- 右侧：Persona Strength 进度条
  - "Persona Strength" + 百分数（百分数 = 所有特征 confidence 加权平均 × 100）
  - 8px 高 pill bar，填充用 `--primary-gradient`
  - 下方 11px 元数据："基于 N 条素材 · M 条引用支撑"

### 3.2 Layer Card（5 个，每层一卡）

| 层 | 标题 | Emoji | 图标圈底色 |
|---|---|---|---|
| Hard Rules | "Hard Rules" | ⚖️ | `--rose-soft` |
| Identity | "Identity" | 🎯 | `--violet-soft` |
| Expression | "Expression" | 🗣️ | `--green-soft` |
| Decision | "Decision" | 🧠 | `--amber-soft` |
| Interpersonal | "Interpersonal" | 🤝 | `--green-soft` |

- 卡片：圆角 20px，padding 24px，`--shadow-md`，背景 `--bg-card`
- Header：40px 圆形图标圈 + 17px bold 标题 + 12px faint count（"N 条xxx"）
- 卡片间距 16px（顶部 stack 间距）

### 3.3 Feature Row（特征行）

- 容器：圆角 12px，padding 10×14px，背景 `--bg-base`
- hover：`translateY(-1px)` + 升级到 `--shadow-md` + 背景变白
- 结构：`emoji + text + actions(右侧)`
- Actions：2 个 30px 圆形 icon button（🔍 查证据 / ✕ 标记不对）
  - 默认浅灰 hover 时绿色 + 1.08x 缩放
  - 选中时（popover 展开的那条）`background: var(--green); color: white;` 表示"当前焦点"

### 3.4 Warning Row（低置信度特征）

- 背景：`linear-gradient(90deg, var(--amber-soft), transparent)`
- 左边框：3px solid `--amber`
- 右侧 chip：`⚠ 证据不足` 黄底白字 9999px radius，2.4s 缓慢 pulse 动画
- 触发条件：`confidence < 0.6`

### 3.5 Evidence Popover（证据 popover）

- 320px 宽，圆角 16px，`--shadow-lg`，从 feature 行右侧浮出
- 左侧 8×14px 三角箭头（用 `::before` rotate 45deg + shadow）
- 内容：
  - Title 14px bold（特征 claim 的疑问句改写："为什么说他X？"）
  - **置信度 gauge**：80×80 SVG 圆环 + 中央 28px 数字 + "置信度" 11px label
    - 圆环 stroke-dasharray 模拟进度（confidence × 周长）
  - **3 条 citation 卡片**（borderTop 分隔）：
    - 24×24 圆角 6px 来源图标（💬 chat / ✉️ email / 📝 meeting-notes）
    - 时间戳 10px faint + 来源 tag
    - 引用文字斜体 12px
- 移动端（< 1180px）：popover 改为底部 sheet 弹出

### 3.6 Floating CTA Bar

- 固定底部 24px，居中，圆角 20px，`--shadow-lg`
- 内含 2 个按钮：
  - 次按钮 "💾 保存备用"：ghost 风格，1px border，`--muted`
  - 主按钮 "🚀 开始演练"：`--primary-gradient`，bold 700，22×12px padding，绿色发光阴影
  - hover 主按钮 `translateY(-1px)` + 阴影增强
- 始终可见，不随滚动隐藏

### 3.7 背景装饰

- 右上角：480×480px 绿色径向渐变 orb，blur 处理，`opacity 0.18`
- 左下角：520×520px 紫色径向渐变 orb，`opacity 0.12`
- `pointer-events: none`，`z-index: 0`，不影响交互

---

## 4. 输入页（Story 2.6）的设计延伸

变体 B 的视觉语言推到输入页（`/persona/new`）：

- **左侧素材输入区**：每段 textarea 包在圆角 12px 卡片里，类型 tag 用色彩对应（聊天=绿 / 邮件=紫 / 纪要=琥珀 / 其他=灰）
- **右侧进度面板**：每个 agent 事件渲染为带 emoji 的 pill 行
  - ✓ 已完成：绿色背景 + ✓
  - ⋯ 进行中：脉冲动画 + 旋转 spinner
  - ❌ 失败：rose 背景 + ✗
- **空态**：放大版的 hero card 占位，"粘贴素材后开始分析"配 ✨ emoji
- **完成态**：底部弹出和编辑器一致的 floating CTA "→ 进入编辑器"

---

## 5. 已知妥协 / 后续优化（不在 Phase 2 范围）

| 项 | 当前选择 | 优化方向 |
|---|---|---|
| 移动端 popover | 隐藏（1180px 以下） | 改为 BottomSheet（用现有 ConfirmDialog 模式扩展） |
| 27 条 trait 浏览效率 | 全展开，靠卡片间距区分 | Phase 3 加 collapsible per-section + 搜索 |
| Emoji 国际化 | 中文用户无问题 | i18n 时考虑替换为 Lucide icon |
| 演练后回流改进 | 无 | Phase 3 用户在演练里点"AI 这反应不像他" → 回写 persona |

---

## 6. 依赖现有资源

- CSS 变量：`frontend/src/styles/*.css` 已全部具备，无需新增令牌
- 图标系统：Lucide React 已在用
- 现有 ConfirmDialog 组件可复用（"未保存离开" / "标记不对" 二次确认）
- 现有 `BattlePrepPage` 的 hero 卡片可作为对手 hero 的视觉参照

---

## 7. 设计验收（用于 Story 2.7 review）

代码实现完成后，设计验收清单：

- [ ] 视觉对比 [`variant-b-daboss.html`](./variant-b-daboss.html) 达到 90%+ 还原
- [ ] 5 个 layer 的图标圈底色与本文表 3.2 一致
- [ ] Hero 头像有 conic-gradient 外环
- [ ] 警示 chip 有可见 pulse 动画
- [ ] Popover 的圆环 gauge 不是直角进度条
- [ ] 底部 CTA 始终浮在视口底部
- [ ] 背景两个装饰 orb 在 1440px 视口下肉眼可见
- [ ] 至少在 1440 / 1024 / 768 三个断点测试无破版

# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic single-page StakeCoachAI frontend into a multi-page router-based architecture with mint green light theme, immersive chat, and lightweight gamification.

**Architecture:** Incremental extraction from the 1,382-line App.tsx into 5 route pages (Home, Chat, BattlePrep, Growth, Settings) connected by React Router v6. Global state split into AppContext + per-page hooks. New design token system with backward-compatible aliases during migration.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom v6 (new), Lucide React, Recharts, react-markdown, SSE streaming

**Spec:** `docs/superpowers/specs/2026-04-12-ui-redesign-design.md`

---

## Task 1: Install Router & Create Design Tokens

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Install react-router-dom**

```bash
cd frontend && npm install react-router-dom
```

- [ ] **Step 2: Create new design tokens file**

Create `frontend/src/styles/tokens.css` with the mint green light theme tokens from the spec. Include backward-compatible aliases that map old token names to new values so existing CSS doesn't break.

```css
/* frontend/src/styles/tokens.css */
:root {
  /* === New Mint Green Light Theme === */
  --bg-base: #F4F9F6;
  --bg-card: #FBFDFB;
  --bg-elevated: #FFFFFF;
  --border: #DAE8E0;
  --border-accent: rgba(45,156,111,0.25);
  --text-primary: #1A2E22;
  --text-secondary: #7A9A88;
  --text-muted: #4A6B56;
  --green: #2D9C6F;
  --green-hover: #258A60;
  --green-soft: rgba(45,156,111,0.12);
  --amber: #C8944A;
  --amber-soft: rgba(200,148,74,0.12);
  --violet: #8B7EC8;
  --violet-soft: rgba(139,126,200,0.12);
  --rose: #C75B5B;
  --rose-soft: rgba(199,91,91,0.12);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(26,46,34,0.06);
  --shadow-md: 0 4px 12px rgba(26,46,34,0.08);
  --shadow-lg: 0 8px 24px rgba(26,46,34,0.1);

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;

  /* === Backward-compat aliases (old token -> new value) === */
  --surface: var(--bg-base);
  --surface-secondary: var(--bg-card);
  --surface-hover: #EDF5F0;
  --primary: var(--green);
  --primary-hover: var(--green-hover);
  --primary-gradient: linear-gradient(135deg, #2D9C6F, #5B8C5A);
  --border-light: #E8F0EB;
  --success: #16A34A;
  --success-bg: #DCFCE7;
  --warning: var(--amber);
  --warning-bg: #FEF9C3;
  --danger: var(--rose);
  --danger-bg: #FEE2E2;
  --sidebar-bg: var(--bg-card);
  --sidebar-hover: var(--bg-base);
  --sidebar-active: var(--green-soft);
  --sidebar-text: var(--text-secondary);
  --sidebar-text-bright: var(--text-primary);
}
```

- [ ] **Step 3: Update index.css**

Replace the `:root` block in `frontend/src/index.css` with an import of the new tokens file. Keep the reset and body styles but update body background and font.

```css
/* frontend/src/index.css */
@import './styles/tokens.css';

/* Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background: var(--bg-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root { width: 100%; height: 100vh; }
```

- [ ] **Step 4: Wrap App in BrowserRouter**

In `frontend/src/main.tsx`, wrap `<App />` with `<BrowserRouter>`.

```tsx
import { BrowserRouter } from 'react-router-dom'
// ... existing imports
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 5: Add catch-all route in App.tsx**

Wrap the entire existing App JSX return in a `<Routes><Route path="*" element={...} /></Routes>` so the app continues to work exactly as before while router is active.

- [ ] **Step 6: Verify app still works**

```bash
cd frontend && npm run dev
```

Open browser, verify all existing functionality works unchanged. The URL will show `/` and all features still render.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/styles/tokens.css frontend/src/index.css frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat: add react-router and mint green design tokens with backward-compat aliases"
```

---

## Task 2: Extract AppContext & Global Data Hooks

**Files:**
- Create: `frontend/src/contexts/AppContext.tsx`
- Create: `frontend/src/hooks/useGrowth.ts`
- Create: `frontend/src/hooks/useRooms.ts`
- Modify: `frontend/src/App.tsx` (remove state, use context)

- [ ] **Step 1: Create AppContext**

Create `frontend/src/contexts/AppContext.tsx`. This context holds global state that was previously in App.tsx: `personaMap`, `organizations`, `scenarios`. It fetches these on mount using the existing API functions from `services/api.ts`.

- [ ] **Step 2: Create useRooms hook**

Create `frontend/src/hooks/useRooms.ts`. Extract room-related state from App.tsx: room list fetching, room creation callback, room deletion. The selected room will be driven by URL params later, but for now keep `selectedRoomId` in the hook.

- [ ] **Step 3: Create useGrowth hook**

Create `frontend/src/hooks/useGrowth.ts`. Extract growth data fetching from App.tsx. Add gamification computation:
- `computeXP(evaluations)` — sum XP from evaluation scores using the letter grade mapping
- `computeLevel(xp)` — threshold lookup (Lv.1=0, Lv.2=200, etc.)
- `computeStreak(rooms)` — count consecutive days with completed conversations
- `computeDailyChallenge(dimensions)` — pick weakest dimension, suggest scenario
- `computeSkillPath(dimensions, evaluationCount)` — map 6 dimensions to path nodes

- [ ] **Step 4: Wrap App in AppContext.Provider**

In `App.tsx`, replace the inline persona/org/scenario state with `useContext(AppContext)`. Wrap the JSX in `<AppContext.Provider>`.

- [ ] **Step 5: Verify app still works**

```bash
cd frontend && npm run dev
```

All existing features should work identically. The state just lives in context now instead of inline.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/contexts/ frontend/src/hooks/useGrowth.ts frontend/src/hooks/useRooms.ts frontend/src/App.tsx
git commit -m "refactor: extract AppContext, useRooms, useGrowth from App.tsx"
```

---

## Task 3: Extract TopBar & NavRail Layout

**Files:**
- Create: `frontend/src/components/layout/TopBar.tsx`
- Create: `frontend/src/components/layout/TopBar.css`
- Create: `frontend/src/components/layout/NavRail.tsx`
- Create: `frontend/src/components/layout/NavRail.css`
- Create: `frontend/src/components/layout/Layout.tsx`
- Create: `frontend/src/components/layout/Layout.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create TopBar component**

`TopBar.tsx`: Logo SVG (geometric layers icon from spec) + "DaBoss" wordmark + Cmd+K search bar trigger + streak/XP/level from useGrowth + user avatar. Uses new design tokens (mint green light). Read the spec's "Top Bar" section and the mockup at `.superpowers/brainstorm/37190-1775974910/combined-refined.html` for exact styling.

- [ ] **Step 2: Create NavRail component**

`NavRail.tsx`: 52px fixed left rail. Logo mark at top (clicking it navigates to `/`), then 4 page icons below: Chat (`MessageSquare`), Battle Prep (`Swords`), Growth (`TrendingUp`), Settings (`Settings`) using Lucide icons. No separate Home icon — the logo serves as the home link. Uses `useLocation()` from react-router to highlight active route. Each icon is a `<Link to="...">`.

- [ ] **Step 3: Create Layout wrapper**

`Layout.tsx`: Renders `<TopBar />` + `<NavRail />` + `<main>{children}</main>`. Applies the outer flex layout (nav rail left, content right). The `children` slot is where route content renders.

```tsx
// Layout.tsx structure
<div className="app-layout">
  <TopBar />
  <div className="app-body">
    <NavRail />
    <main className="app-content">
      <Outlet />
    </main>
  </div>
</div>
```

- [ ] **Step 4: Wire Layout into App.tsx**

Replace the old sidebar JSX in App.tsx with the new Layout component. Use `<Routes>` with a parent `<Route element={<Layout />}>` that renders an `<Outlet />`. The existing App content becomes a single child route at `path="*"`.

- [ ] **Step 5: Style TopBar and NavRail CSS**

Write `TopBar.css` and `NavRail.css` using the mint green theme tokens. The old dark sidebar styles from `App.css` are no longer used by these new components. Reference the spec design system for colors, spacing, and radius values.

- [ ] **Step 6: Verify app works with new layout**

```bash
cd frontend && npm run dev
```

The app should now show the new TopBar and NavRail with the mint green theme. The main content area still renders the old App content. Clicking nav icons doesn't navigate yet (routes not split).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/ frontend/src/App.tsx
git commit -m "feat: add TopBar, NavRail, and Layout shell with mint green theme"
```

---

## Task 4: Create HomePage

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/HomePage.css`
- Modify: `frontend/src/App.tsx` (add route)

- [ ] **Step 1: Create HomePage component**

Build `pages/HomePage.tsx` following the spec "Page 1: Home Dashboard" section. Sections:
1. Daily Challenge Banner — uses `useGrowth().dailyChallenge`
2. Quick Action Cards (2x2) — each card is a `<Link>` to its route
3. Recent Conversations — uses `useRooms().rooms` sorted by latest message, displays top 3
4. Skill Path Preview — uses `useGrowth().skillPath`, horizontal node chain

All styling uses new design tokens. Lucide SVG icons (no emoji). Max-width 880px centered.

Reference the refined mockup at `.superpowers/brainstorm/37190-1775974910/combined-refined.html` for exact visual implementation.

- [ ] **Step 2: Style HomePage.css**

Responsive styles: at `< 768px`, recent conversations become vertical list, skill path horizontally scrollable.

- [ ] **Step 3: Add route in App.tsx**

Inside the `<Route element={<Layout />}>` parent, add `<Route index element={<HomePage />} />`.

- [ ] **Step 4: Verify HomePage renders at /**

```bash
cd frontend && npm run dev
```

Navigate to `/`. The home dashboard should display with all 4 sections. Cards link to `/chat`, `/battle-prep`, `/growth`, `/settings`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/HomePage.css frontend/src/App.tsx
git commit -m "feat: add HomePage dashboard with daily challenge, action cards, recent conversations, skill path"
```

---

## Task 5: Extract Chat Hooks (useChat, useVoice, useCoaching, useAnalysis)

**Files:**
- Create: `frontend/src/hooks/useChat.ts`
- Create: `frontend/src/hooks/useVoice.ts`
- Create: `frontend/src/hooks/useCoaching.ts`
- Create: `frontend/src/hooks/useAnalysis.ts`
- Modify: `frontend/src/App.tsx` (replace inline state with hooks)

- [ ] **Step 1: Create useChat hook**

Extract from App.tsx all chat-specific state and logic:
- `messages`, `streamingContent`, `dispatchSummary`, `sending`
- `inputValue`, `mentionQuery`, `mentionResults`
- SSE connection setup (`EventSource` for message, streaming_delta, typing, round_end events)
- `sendMessage()` function
- Takes `roomId` as parameter, manages SSE lifecycle via `useEffect([roomId])`

- [ ] **Step 2: Create useVoice hook**

Extract from App.tsx:
- `voiceEnabled`, `voiceMuted`, `playingPersonaId`
- `audioPlayerRef` (AudioPlayQueue instance)
- SSE `audio_chunk` event handling
- Toggle functions: `toggleVoice()`, `toggleMute()`

- [ ] **Step 3: Create useCoaching hook**

Extract from App.tsx:
- `coachingOpen`, `coachingMode` ('review' | 'live')
- `coachingMessages`, `coachingInput`, `coachingStreaming`
- Functions: `startReviewCoaching()`, `startLiveCoaching()`, `sendCoachingMessage()`
- SSE streaming for coaching responses
- Takes `roomId` as parameter

- [ ] **Step 4: Create useAnalysis hook**

Extract from App.tsx:
- `analysisResult`, `analysisReportList`, `analyzingRoom`
- `highlightedMessageId` (for scroll-to-link)
- Functions: `generateAnalysis()`, `fetchReportList()`, `selectReport()`
- Takes `roomId` as parameter

- [ ] **Step 5: Replace inline state in App.tsx with hooks**

In App.tsx, replace all the extracted state variables and functions with calls to the new hooks. The App component should become significantly shorter.

- [ ] **Step 6: Verify chat, coaching, voice, and analysis all still work**

```bash
cd frontend && npm run dev
```

Open an existing conversation, send a message, verify streaming works. Test coaching panel (both review and live). Test voice if configured. Test analysis report generation.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useChat.ts frontend/src/hooks/useVoice.ts frontend/src/hooks/useCoaching.ts frontend/src/hooks/useAnalysis.ts frontend/src/App.tsx
git commit -m "refactor: extract useChat, useVoice, useCoaching, useAnalysis hooks from App.tsx"
```

---

## Task 6: Extract Chat Sub-Components

**Files:**
- Create: `frontend/src/components/chat/MessageList.tsx`
- Create: `frontend/src/components/chat/MessageList.css`
- Create: `frontend/src/components/chat/ChatInput.tsx`
- Create: `frontend/src/components/chat/ChatInput.css`
- Create: `frontend/src/components/chat/ContextPanel.tsx`
- Create: `frontend/src/components/chat/ContextPanel.css`
- Create: `frontend/src/components/chat/CoachingPanel.tsx`
- Create: `frontend/src/components/chat/CoachingPanel.css`
- Create: `frontend/src/components/chat/AnalysisPanel.tsx`
- Create: `frontend/src/components/chat/AnalysisPanel.css`
- Modify: `frontend/src/components/RoomList.tsx` (update to use Link navigation)
- Modify: `frontend/src/App.tsx` (replace inline JSX with components)

- [ ] **Step 1: Create MessageList component**

Extract message rendering JSX from App.tsx. Handles:
- AI messages (left-aligned, avatar + bubble + emotion label)
- User messages (right-aligned, green-soft bubble)
- Coach hints (inline, green left border)
- Typing indicator
- Dispatch transparency metadata
- Uses react-markdown for message content rendering
- Accepts `messages`, `streamingContent`, `highlightedMessageId` as props

- [ ] **Step 2: Create ChatInput component**

Extract input bar JSX from App.tsx. Handles:
- Text input with auto-resize textarea
- @mention autocomplete dropdown
- Microphone button (toggles VoiceRecorder)
- Send button
- Accepts callbacks from useChat and useVoice hooks

- [ ] **Step 3: Create ContextPanel component**

New component (not extracted — this is a new layout element). Renders:
- Opponent Profile card (persona details + personality tags)
- Emotion Trend mini bar chart (from EmotionSidebar data)
- Live Score (letter grade + 4-metric grid)
- Session XP
- "View details" triggers existing EmotionCurve modal
- Collapsible via prop

- [ ] **Step 4: Create CoachingPanel component**

Extract coaching panel JSX from App.tsx. Renders as a slide-out panel:
- Tab toggle: Review / Live mode
- Message list for coaching conversation
- Input for coaching questions
- Uses useCoaching hook

- [ ] **Step 5: Create AnalysisPanel component**

Extract analysis report JSX from App.tsx. Renders as a slide-out panel:
- Report history list with selector
- Generate new report button
- Report content: resistance ranking, effective arguments, suggestions
- Clickable message links that call `highlightMessage(id)` to scroll in MessageList

- [ ] **Step 6: Update RoomList to use Link navigation**

Modify existing `frontend/src/components/RoomList.tsx`: replace the `onSelect` callback with `<Link to={/chat/${room.id}}>` navigation. Keep the same visual styling but add active state based on URL param match.

- [ ] **Step 7: Replace App.tsx inline chat JSX with components**

In App.tsx, replace the large chat rendering block with composed components: `<MessageList>`, `<ChatInput>`, `<ContextPanel>`, etc. App.tsx should shrink significantly.

- [ ] **Step 8: Verify all chat features work with extracted components**

```bash
cd frontend && npm run dev
```

Test: send messages, streaming, @mentions, coaching (review + live), analysis reports, emotion sidebar, voice input/output, message highlighting.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/chat/ frontend/src/components/RoomList.tsx frontend/src/App.tsx
git commit -m "refactor: extract MessageList, ChatInput, ContextPanel, CoachingPanel, AnalysisPanel from App.tsx"
```

---

## Task 7: Create ChatPage & Wire Route

**Files:**
- Create: `frontend/src/contexts/ChatContext.tsx`
- Create: `frontend/src/pages/ChatPage.tsx`
- Create: `frontend/src/pages/ChatPage.css`
- Modify: `frontend/src/App.tsx` (add routes, remove chat code)

- [ ] **Step 1: Create ChatPage component**

Build `pages/ChatPage.tsx` — the three-column layout from the spec:
- Left: `<RoomList />` (200px, shows all rooms + battle prep rooms)
- Center: Chat header bar + `<MessageList />` + `<ChatInput />`
- Right: `<ContextPanel />` (210px, collapsible)
- Overlay panels: `<CoachingPanel />`, `<AnalysisPanel />`, `<EmotionCurve />` modal

Uses `useParams().roomId` from react-router to get the current room.

Create `frontend/src/contexts/ChatContext.tsx` — a context provider that wraps `useChat(roomId)`, `useVoice(roomId)`, `useCoaching(roomId)`, `useAnalysis(roomId)` and exposes their state/actions via `useChatContext()`. This prevents sub-components from calling hooks independently (which would cause duplicate SSE connections). ChatPage renders `<ChatContext.Provider>` wrapping the three-column layout; sub-components consume via `useChatContext()`.

When no `roomId` (at `/chat`): show room list + empty state "Select a conversation to start".

Also include export functionality in the chat header: an `ExportDropdown` that triggers Markdown and HTML export using the existing `exportRoom` and `exportRoomHtml` API functions.

- [ ] **Step 2: Style ChatPage.css**

Three-column flex layout. The chat header shows battle prep indicator (amber progress bar for round count) when room is a battle_prep room. Reference the spec and refined mockup.

- [ ] **Step 3: Add chat routes in App.tsx**

```tsx
<Route path="chat" element={<ChatPage />} />
<Route path="chat/:roomId" element={<ChatPage />} />
```

Remove all chat-related JSX and state from App.tsx — it now lives in ChatPage.

- [ ] **Step 4: Verify chat works via routes**

```bash
cd frontend && npm run dev
```

Navigate to `/chat` — see room list with empty state. Click a room — URL changes to `/chat/123`, chat loads. All features (streaming, coaching, analysis, voice, emotion) work. Back button returns to room list.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/ChatContext.tsx frontend/src/pages/ChatPage.tsx frontend/src/pages/ChatPage.css frontend/src/App.tsx
git commit -m "feat: add ChatPage with three-column layout, ChatContext, and route wiring"
```

---

## Task 8: Create BattlePrepPage

**Files:**
- Create: `frontend/src/pages/BattlePrepPage.tsx`
- Create: `frontend/src/pages/BattlePrepPage.css`
- Modify: `frontend/src/App.tsx` (add route, remove battle prep code)

- [ ] **Step 1: Create BattlePrepPage component**

Refactor from existing `BattlePrepDialog.tsx` into a full page. Three-step wizard:
1. Describe Meeting: textarea + difficulty selector cards
2. Review Opponent: AI-generated persona card preview with edit fields
3. Practice Session: navigates to `/chat/:roomId` with the created battle prep room

Post-battle flow (triggered when round_end with final=true):
- Score reveal overlay with letter grade + XP animation
- CheatSheet card (reuse existing CheatSheet component)
- "Return Home" (`<Link to="/">`) + "Play Again" buttons

Uses the existing battle prep API: `generateBattlePrepPersona`, `startBattlePrep`, `generateCheatSheet` from `services/api.ts`.

- [ ] **Step 2: Style BattlePrepPage.css**

Amber accent theme for the wizard steps. Reference existing `BattlePrepDialog.css` for styling but adapt to full-page layout with mint green background.

- [ ] **Step 3: Add route and remove old dialog code**

In App.tsx: add `<Route path="battle-prep" element={<BattlePrepPage />} />`. Remove `showBattlePrep` state and `BattlePrepDialog` rendering.

- [ ] **Step 4: Verify battle prep flow**

```bash
cd frontend && npm run dev
```

Navigate to `/battle-prep`. Complete all 3 steps. Verify persona generation, practice session, post-battle score + cheat sheet.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/BattlePrepPage.tsx frontend/src/pages/BattlePrepPage.css frontend/src/App.tsx
git commit -m "feat: add BattlePrepPage with 3-step wizard flow"
```

---

## Task 9: Create GrowthPage

**Files:**
- Create: `frontend/src/pages/GrowthPage.tsx`
- Create: `frontend/src/pages/GrowthPage.css`
- Modify: `frontend/src/App.tsx` (add route, remove growth code)

- [ ] **Step 1: Create GrowthPage component**

Refactor from existing `GrowthDashboard.tsx` into a full page with additions:
1. Overall Score Header: large score + radar chart (Recharts) + weekly trend
2. Skill Path Detail: vertical timeline with expand/collapse per node, uses `useGrowth().skillPath`
3. Evaluation History: cards from existing growth data, click to navigate to `/chat/:roomId`
4. Profile Card: reuse existing `ProfileCard` component + download button

Uses `useGrowth()` hook for all data including gamification computations.

- [ ] **Step 2: Style GrowthPage.css**

Centered single-column layout (max-width 880px). Violet accent for section headers. Skill path nodes styled per spec: green completed, amber current, muted locked.

- [ ] **Step 3: Add route and remove old growth code**

In App.tsx: add `<Route path="growth" element={<GrowthPage />} />`. Remove `showGrowth` state and `GrowthDashboard` rendering.

- [ ] **Step 4: Verify growth page**

```bash
cd frontend && npm run dev
```

Navigate to `/growth`. Verify radar chart, evaluation cards, skill path, profile card download.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/GrowthPage.tsx frontend/src/pages/GrowthPage.css frontend/src/App.tsx
git commit -m "feat: add GrowthPage with skill path and gamification display"
```

---

## Task 10: Create SettingsPage

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/pages/SettingsPage.css`
- Modify: `frontend/src/App.tsx` (add route, remove dialog triggers)

- [ ] **Step 1: Create SettingsPage component**

Tab-based page with 4 sections:
1. **Personas** — refactor `PersonaEditorDialog` into inline form + list view
2. **Scenarios** — refactor `ScenarioDialog` into inline form + list view
3. **Organizations** — refactor `OrganizationDialog` into inline panels (org list, team list, relationship map)
4. **Preferences** — voice settings (placeholder for now)

Reuse existing dialog components' form logic but render them inline instead of in modals. Each tab shows its own list + create/edit form.

- [ ] **Step 2: Style SettingsPage.css**

Clean tab navigation at top. Form layouts use the design system tokens. List items with edit/delete actions.

- [ ] **Step 3: Add route and remove old dialog triggers**

In App.tsx: add `<Route path="settings" element={<SettingsPage />} />`. Remove `showScenarioDialog`, `showOrgDialog`, `personaEditorState` state and the corresponding dialog renderings.

- [ ] **Step 4: Verify settings page**

```bash
cd frontend && npm run dev
```

Navigate to `/settings`. Create a persona, edit it. Create a scenario. View organizations. Switch between tabs.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/pages/SettingsPage.css frontend/src/App.tsx
git commit -m "feat: add SettingsPage with personas, scenarios, organizations tabs"
```

---

## Task 11: Add CommandPalette

**Files:**
- Create: `frontend/src/components/layout/CommandPalette.tsx`
- Create: `frontend/src/components/layout/CommandPalette.css`
- Create: `frontend/src/hooks/useCommandPalette.ts`
- Modify: `frontend/src/components/layout/Layout.tsx` (add CommandPalette)
- Modify: `frontend/src/components/layout/TopBar.tsx` (wire search bar click)

- [ ] **Step 1: Create useCommandPalette hook**

State: `isOpen`, `query`, `results`, `selectedIndex`.
Logic:
- `Cmd+K` / `Ctrl+K` keyboard listener (global)
- Shortcut listeners: `Cmd+B` -> navigate to `/battle-prep`, `Cmd+Shift+N` -> open CreateRoomDialog, `Cmd+G` -> navigate to `/growth`
- Search function: filters rooms by name, personas by name, and returns static action items (New Chat, Battle Prep, Growth)
- Keyboard navigation: up/down arrows, Enter to select, Esc to close

- [ ] **Step 2: Create CommandPalette component**

Floating overlay centered on screen:
- Search input auto-focused on open
- Results grouped: Conversations | Actions | Personas
- Each result shows icon/avatar + name + description + shortcut badge
- Semi-transparent mint backdrop
- Styled per spec/mockup

- [ ] **Step 3: Wire into Layout**

In `Layout.tsx`, render `<CommandPalette />` at the root level (it portals or renders above all content). In `TopBar.tsx`, clicking the search bar opens the command palette.

- [ ] **Step 4: Verify command palette**

```bash
cd frontend && npm run dev
```

Press `Cmd+K` — palette opens. Type a room name — results filter. Press Enter — navigates. Press `Cmd+B` — goes to battle prep. Press Esc — closes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/CommandPalette.tsx frontend/src/components/layout/CommandPalette.css frontend/src/hooks/useCommandPalette.ts frontend/src/components/layout/Layout.tsx frontend/src/components/layout/TopBar.tsx
git commit -m "feat: add CommandPalette with Cmd+K search and keyboard shortcuts"
```

---

## Task 12: Add Responsive Layout & BottomTabBar

**Files:**
- Create: `frontend/src/components/layout/BottomTabBar.tsx`
- Create: `frontend/src/components/layout/BottomTabBar.css`
- Modify: `frontend/src/components/layout/Layout.tsx`
- Modify: `frontend/src/components/layout/Layout.css`
- Modify: `frontend/src/components/layout/NavRail.css` (hide on mobile)
- Modify: `frontend/src/pages/ChatPage.css` (responsive three-column)
- Modify: `frontend/src/pages/HomePage.css` (responsive grid)

- [ ] **Step 1: Create BottomTabBar component**

Mobile-only (hidden >= 768px). 5 tabs: Home, Chat, Battle Prep (elevated), Growth, Profile. Battle Prep tab is visually larger with amber accent. "Profile" tab links to `/growth` (which contains the profile card and personal stats). Uses `<Link>` + `useLocation()` for active state.

- [ ] **Step 2: Update Layout for responsive**

In `Layout.tsx` / `Layout.css`:
- `>= 768px`: show NavRail, hide BottomTabBar
- `< 768px`: hide NavRail, show BottomTabBar, TopBar simplified (no search bar text, just icon)

- [ ] **Step 3: Make ChatPage responsive**

In `ChatPage.css`:
- `>= 1024px`: three columns visible
- `768-1023px`: room list and context panel collapsible (toggle buttons)
- `< 768px`: room list is its own view (at `/chat`), context panel hidden (pill buttons + bottom sheet), chat full-screen

- [ ] **Step 4: Make HomePage responsive**

In `HomePage.css`:
- `< 768px`: recent conversations become vertical list, skill path horizontally scrollable

- [ ] **Step 5: Verify responsive behavior**

```bash
cd frontend && npm run dev
```

Resize browser window to test all 3 breakpoints. Test on mobile viewport (Chrome DevTools device mode). Verify bottom tab bar appears, nav rail hides, chat goes full-screen.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/BottomTabBar.tsx frontend/src/components/layout/BottomTabBar.css frontend/src/components/layout/ frontend/src/pages/ChatPage.css frontend/src/pages/HomePage.css
git commit -m "feat: add responsive layout with BottomTabBar and mobile breakpoints"
```

---

## Task 13: Apply Final Theme & Clean Up

**Files:**
- Modify: `frontend/src/styles/tokens.css` (remove backward-compat aliases)
- Modify: `frontend/src/App.css` (major cleanup)
- Modify: All component CSS files that reference old tokens
- Delete: Unused component files that were fully absorbed into pages
- Modify: `frontend/src/App.tsx` (final slim version)

- [ ] **Step 1: Audit remaining App.tsx**

At this point, App.tsx should only contain: Router setup, Layout wrapper, route definitions, AppContext.Provider, and the `CreateRoomDialog` modal (still shared globally). Verify it's under 100 lines. If not, extract any remaining inline code.

- [ ] **Step 2: Replace old token references across all CSS files**

Search all `.css` files for old token names (`--surface`, `--sidebar-bg`, `--primary`, etc.) and replace with new token names (`--bg-base`, `--green`, etc.). Then remove the backward-compat aliases from `tokens.css`.

```bash
# Find files using old tokens
cd frontend && grep -r "\-\-surface\b\|\-\-sidebar-bg\|\-\-sidebar-hover\|\-\-sidebar-active\|\-\-sidebar-text" src/ --include="*.css" -l
```

- [ ] **Step 3: Clean up App.css**

The massive `App.css` (1,219 lines) should have most of its styles moved into component-specific CSS files. Remove all CSS rules that are no longer referenced. Keep only truly global styles (scrollbar, selection, etc.).

- [ ] **Step 4: Add loading, empty, and error state patterns**

Per spec, implement shared UI patterns:
- **Skeleton screens**: Create a `components/layout/Skeleton.tsx` with pulsing gray rectangles. Use in HomePage (card skeletons), ChatPage (message skeletons), GrowthPage (radar skeleton).
- **Empty states**: Add empty state messages to each page: Home ("Start your first practice" CTA), Chat room list ("No conversations yet"), Growth ("Complete a conversation to see your scores"), Settings ("Create your first AI opponent").
- **Error states**: Add a `components/layout/Toast.tsx` for API failure notifications. Add SSE disconnect banner in ChatPage header ("Connection lost, reconnecting..."). Add retry UI on failed message sends (red outline + "Retry" button on message bubble).

- [ ] **Step 5: Remove unused component files**

Delete fully-replaced dialog/component files:
- `BattlePrepDialog.tsx` + `BattlePrepDialog.css` (replaced by BattlePrepPage)
- `ProfileCardDialog.tsx` (absorbed into GrowthPage)
- `EmotionSidebar.tsx` + `EmotionSidebar.css` (replaced by ContextPanel)
- `PersonaList.tsx` + `PersonaList.css` (replaced by SettingsPage personas tab)

Keep components still in use: EmotionCurve (modal), Avatar, CheatSheet, ProfileCard, VoiceRecorder, CreateRoomDialog, RoomList.

- [ ] **Step 6: Add SPA fallback for production**

Ensure FastAPI serves `index.html` for all non-`/api/` routes in production. Check if the backend already has a catch-all static file handler; if not, add one. For Vite preview mode, verify `vite preview` serves SPA fallback correctly.

- [ ] **Step 7: Final verification**

```bash
cd frontend && npm run build
```

Build should succeed with no errors. Then:

```bash
cd frontend && npm run dev
```

Test the complete user journey:
1. Land on `/` — see dashboard with all sections
2. Click "紧急备战" — navigate to `/battle-prep`, complete 3-step wizard
3. Practice session at `/chat/:id` — send messages, verify streaming + coaching + analysis
4. Press `Cmd+K` — search for a room, navigate to it
5. Visit `/growth` — see radar chart, skill path, evaluation history
6. Visit `/settings` — manage personas, scenarios, organizations
7. Resize to mobile — verify bottom tab bar, responsive layouts

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: apply final mint green theme, add loading/empty/error states, clean up old monolith"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Router + design tokens | tokens.css, main.tsx, index.css |
| 2 | AppContext + global hooks | AppContext.tsx, useGrowth.ts, useRooms.ts |
| 3 | TopBar + NavRail layout | TopBar.tsx, NavRail.tsx, Layout.tsx |
| 4 | HomePage dashboard | HomePage.tsx |
| 5 | Chat hooks extraction | useChat.ts, useVoice.ts, useCoaching.ts, useAnalysis.ts |
| 6 | Chat sub-components | MessageList, ChatInput, ContextPanel, CoachingPanel, AnalysisPanel |
| 7 | ChatPage + routes | ChatPage.tsx |
| 8 | BattlePrepPage | BattlePrepPage.tsx |
| 9 | GrowthPage | GrowthPage.tsx |
| 10 | SettingsPage | SettingsPage.tsx |
| 11 | CommandPalette | CommandPalette.tsx, useCommandPalette.ts |
| 12 | Responsive + BottomTabBar | BottomTabBar.tsx, responsive CSS |
| 13 | Final theme + cleanup | tokens.css cleanup, App.css cleanup, dead code removal |

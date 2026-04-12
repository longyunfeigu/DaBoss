# StakeCoachAI UI Redesign - Design Spec

## Overview

Redesign the StakeCoachAI (DaBoss) frontend from a monolithic single-page layout into a multi-page, router-based architecture with modern navigation, immersive chat experience, and light gamification. The goal is to make new users instantly understand the product while giving power users efficient shortcuts, all with enough visual polish for demos and social sharing.

## Context

### Current State
- All UI lives in a single `App.tsx` (1,382 lines) with no router
- Sidebar + main content layout, all features accessed through one page
- Multiple modal dialogs stacked as overlays
- All state managed in one component via React hooks
- No responsive/mobile support
- Custom CSS with nature green theme, Lucide icons, Recharts

### Problems
- No deep-linking or URL-based navigation
- Overwhelming for new users (all features visible at once)
- Hard to maintain (monolithic component)
- Not mobile-friendly
- State management tangled across unrelated features

### Tech Stack (unchanged)
- React 19 + TypeScript + Vite
- Lucide React icons
- Recharts (radar charts)
- react-markdown (message rendering)
- @ricky0123/vad-react + vad-web (voice activity detection)
- html2canvas (image export)
- SSE for real-time streaming
- FastAPI backend (minimal additions for gamification data)

## Target Users

General working professionals ("anyone who needs to handle stakeholders") - from junior employees to senior managers. No specific role assumption.

## Design Decisions

### Navigation: Hybrid C+E+F+D

Four patterns combined into one cohesive experience:

| Pattern | Applied As | Purpose |
|---------|-----------|---------|
| C - Dashboard Hub | Home page with card grid | New user entry point |
| E - Gamified Journey | Level/XP/skill path on home | Lightweight retention |
| F - Immersive Chat | Three-column chat layout | Core experience |
| D - Command Palette | Global Cmd+K overlay | Power user efficiency |

### Color Theme: Mint Green Light

Chosen for brand coherence with the existing green primary color, eye comfort, and uniqueness.

### Gamification: Lightweight

Level + XP + score display only. No leaderboards, no achievement badges, no unlock gates. Gamification elements are decorative, not blocking.

## Pages

### Route Structure

```
/              -> Home Dashboard
/chat           -> Room List (mobile: full-screen, desktop: empty state + room list sidebar)
/chat/:roomId  -> Immersive Chat
/battle-prep   -> Battle Prep Wizard
/growth        -> Growth Center
/settings      -> Settings (Organization, Scenarios, Preferences)
```

React Router v6 handles navigation. All routes share the global top bar and nav rail.

**SPA Fallback**: Vite dev server handles history fallback by default. For production, the static host or FastAPI must serve `index.html` for all non-`/api/` routes. The existing Vite proxy config (`/api` -> backend) remains unchanged.

### Global Elements

#### Top Bar (all pages)
- Left: Logo mark (SVG geometric layers icon) + "DaBoss" wordmark + Cmd+K search bar
- Right: Streak counter (flame icon + number) + XP counter (star icon + number) + Level pill ("Lv.5 沟通达人") + User avatar circle (surname initial)

#### Nav Rail (desktop, all pages)
- Fixed left side, 52px wide
- Logo mark (click -> home), then 4 page icons: Chat, Battle Prep, Growth, Settings
- Bottom: no extra icons (settings is in the main nav)
- Active page highlighted with green-soft background

#### Bottom Tab Bar (mobile, all pages)
- 5 tabs: Home, Chat, Battle Prep (elevated/prominent), Growth, Profile
- Battle Prep tab visually elevated (larger, amber accent) as primary CTA

#### Cmd+K Command Palette (global overlay)
- Triggered by Cmd+K (desktop) or search bar tap
- Centered floating panel with search input
- Results grouped: Conversations | Actions | Personas
- Keyboard shortcuts: Cmd+B (Battle Prep), Cmd+Shift+N (New Chat, avoids browser Cmd+N conflict), Cmd+G (Growth)
- Footer: navigation hints (arrows, enter, esc)
- Backdrop: semi-transparent mint overlay

### Page 1: Home Dashboard (`/`)

Default landing page. Centered content, max-width 880px.

**Sections (top to bottom):**

1. **Daily Challenge Banner**
   - Card with: challenge title, progress bar (e.g., "1/3"), XP reward, "Start Challenge" button
   - Green accent border

2. **Quick Action Cards (2x2 grid)**
   - Battle Prep card (amber accent): icon + "紧急备战" label + "30 分钟快速演练" title + description
   - Free Practice card (green accent): icon + "自由练习" label + "开启新对话" title + description
   - Growth card (violet accent): icon + "我的成长" label + current score (large number) + trend indicator
   - Persona Library card (neutral): icon + "角色库" label + stacked avatar circles + count

3. **Recent Conversations**
   - Horizontal row of 3 cards
   - Each: opponent avatar + conversation name + time ago + letter grade score
   - "View all ->" link

4. **Skill Path Preview**
   - Horizontal node chain: completed (green circle + check) -> current (amber ring + dot) -> locked (border circle + lock icon)
   - Each node labeled with skill name
   - "Expand ->" link to Growth Center

**Responsive (mobile):**
- Daily challenge banner stacks vertically
- 2x2 grid stays 2x2 but smaller padding
- Recent conversations become vertical list
- Skill path horizontally scrollable

### Page 2: Immersive Chat (`/chat/:roomId`)

Three-column layout, chat as the absolute center of attention.

**Left Column - Room List (200px, collapsible on mobile):**
- Header: "对话" title + new room button (+)
- Room items: opponent avatar (colored circle with surname) + room name + status/score
- Active room: green-soft background + green border
- Divider, then "备战" section with amber-tinted battle prep rooms
- Click room to navigate to `/chat/:roomId`

**Center Column - Chat Area (flex:1):**
- **Header bar:**
  - Left: opponent avatar + conversation title + emotion status text (colored) + round count
  - Right: action buttons with icons (Coach, Analysis, Export, More)
- **Message stream:**
  - AI messages: left-aligned, avatar + bubble (light gray border), timestamp + emotion label below
  - User messages: right-aligned, green-soft bubble with green border
  - Coach hints: inline in message flow, left green vertical bar + light green background, non-intrusive
  - Typing indicator: three fading dots in a bubble
  - Dispatch transparency: subtle metadata below AI messages showing why persona responded
- **Input bar:**
  - Rounded input field + microphone icon + green Send button
  - Supports @mention autocomplete (dropdown above input)
  - Voice mode: microphone button toggles VAD-based recording (existing VoiceRecorder component), waveform visualization inline, mute toggle for TTS playback
- **Action buttons (header right, via "More" dropdown):**
  - Coach: opens coaching panel — supports two modes: **Review coaching** (post-conversation analysis with session persistence) and **Live coaching** (real-time advice, stateless). Toggle between modes via tabs in the coaching panel.
  - Analysis: opens analysis report panel/modal — shows report history list, generate new report, clickable message links that scroll-to-highlight in the message stream, resistance/argument/suggestion cards
  - Export: dropdown with two formats — Markdown export and HTML export
  - Voice: toggle TTS on/off, shows current speaking persona indicator

**Right Column - Context Panel (210px, collapsible):**
- **Opponent Profile card:** avatar + name + personality tags (colored pills like "结果导向", "高压")
- **Emotion Trend:** mini bar chart (5 bars, colored by intensity), "View details ->" link opens full EmotionCurve modal
- **Live Score:** large letter grade (e.g., "B+") + 4-metric grid (Persuasion, Emotion Mgmt, Structure, Listening)
- **Session XP:** small card showing XP earned this session

**Responsive (mobile):**
- Left column hidden; top bar shows back arrow to return to room list view
- Right column hidden; replaced by horizontal scrollable pill buttons above input (Cheat Sheet, Coach, Score, Emotion)
- Tapping a pill opens a half-screen bottom sheet with that panel's content
- Chat goes full-screen immersive

**State migration from App.tsx:**
- Chat-specific state (messages, streaming, input, mentions) moves to `useChat` hook
- Coaching state (mode, messages, streaming for both review and live modes) moves to `useCoaching` hook
- Voice state (voiceEnabled, voiceMuted, playingPersonaId, audioPlayerRef) moves to `useVoice` hook
- Analysis state (analysisResult, reportList, analyzingRoom, highlightedMessageId) moves to `useAnalysis` hook
- Room list state extracted to `useRooms` hook
- SSE connection managed per-room via useEffect in chat view (handles message, streaming_delta, typing, audio_chunk, round_end events)

### Page 3: Battle Prep (`/battle-prep`)

Full-page wizard flow with amber accent theme.

**Step 1 - Describe Meeting:**
- Large textarea for meeting context description
- Difficulty selector: three option cards (Easy / Normal / Hard)
- "Generate Opponent ->" button

**Step 2 - Review Opponent:**
- AI-generated persona card preview: avatar, name, role, personality traits, negotiation style
- Editable fields for fine-tuning
- "Start Practice ->" button

**Step 3 - Practice Session:**
- Navigates to `/chat/:roomId` with the battle prep room
- Top of chat shows amber progress bar: "Round 3/12"
- Battle prep rooms visually distinguished by amber header accent

**Post-Battle:**
- Score reveal overlay: letter grade + six-dimension scores + XP earned animation
- Generated Cheat Sheet card: key talking points, copy/download as image
- Action buttons: "Return Home" / "Play Again"

### Page 4: Growth Center (`/growth`)

Single-column centered layout, vertical scroll.

**Sections:**

1. **Overall Score Header**
   - Large score number + six-dimension radar chart (Recharts)
   - Week-over-week change indicators per dimension

2. **Skill Path Detail**
   - Vertical timeline layout
   - Each node expands to show: skill name, description, unlock condition, recommended practice scenarios
   - Completed nodes: green, Current: amber with pulse, Locked: muted with lock

3. **Evaluation History**
   - Cards in reverse chronological order
   - Each card: conversation name, date, letter grade, key feedback summary snippet
   - Click to expand full analysis or navigate to that conversation

4. **Profile Card**
   - Shareable communication style card
   - Radar chart + style label + level badge
   - "Download as Image" / "Share" buttons

### Page 5: Settings (`/settings`)

Manages organization, personas, and scenarios — features that were previously inline in the sidebar or in modal dialogs.

**Sections (tab-based or accordion):**

1. **Personas** — list all AI personas, create/edit (PersonaEditorDialog refactored inline), avatar color assignment, profile detail editing
2. **Scenarios** — list/create/edit scenarios (ScenarioDialog refactored inline), link personas to scenarios
3. **Organizations** — org CRUD, team management, persona-to-team assignment, relationship mapping (OrganizationDialog refactored inline)
4. **Preferences** — voice settings (TTS provider, voice assignment per persona), display preferences

### Feature Location Mapping

Where each current sidebar/modal feature moves in the new architecture:

| Current Location | Feature | New Location |
|-----------------|---------|-------------|
| Sidebar: brand + org badge | Organization display | TopBar (if org selected) or Settings page |
| Sidebar: persona list | Persona quick list | Home "角色库" card -> Settings/Personas |
| Sidebar: room list | Room list | ChatPage left column |
| Sidebar: battle prep button | Battle prep entry | Home card + Nav Rail + Cmd+B |
| Sidebar: growth button | Growth entry | Home card + Nav Rail + Cmd+G |
| Modal: CreateRoomDialog | New room creation | Remains modal, triggered from ChatPage "+" button or Cmd+Shift+N |
| Modal: PersonaEditorDialog | Persona CRUD | Settings/Personas page (inline form) |
| Modal: ScenarioDialog | Scenario CRUD | Settings/Scenarios page (inline form) |
| Modal: OrganizationDialog | Org/team/relationship CRUD | Settings/Organizations page (inline form) |
| Modal: EmotionCurve | Full emotion timeline | Remains modal, triggered from ContextPanel "View details" |
| Modal: ProfileCardDialog | Profile card view | GrowthPage section (inline) |
| Inline: CoachingPanel | Coaching sidebar | ChatPage: slide-out panel or modal, with review/live mode tabs |
| Inline: AnalysisReport | Analysis results | ChatPage: slide-out panel or modal |

### Gamification Data Source

Level, XP, and streak are derived from existing data:

- **XP**: Calculated client-side from evaluation history — each completed conversation earns XP based on score (A=100, B+=80, B=60, etc.)
- **Level**: Thresholds based on cumulative XP (Lv.1=0, Lv.2=200, Lv.3=500, Lv.4=1000, Lv.5=2000, etc.)
- **Streak**: Count consecutive days with at least one completed conversation, computed from room timestamps
- **Daily Challenge**: Derived from the user's weakest dimension in growth data — suggests a practice scenario targeting that skill
- **Skill Path**: Maps to the 6 existing evaluation dimensions (persuasion, emotion management, listening, structure, conflict, alignment), ordered by progression. "Unlocked" = average score >= 60 in that dimension across 3+ evaluations
- **Letter Grade Mapping**: A+=95-100, A=90-94, A-=85-89, B+=80-84, B=75-79, B-=70-74, C+=65-69, C=60-64, C-=55-59, D=below 55

All gamification is computed frontend-side from existing `/api/v1/stakeholder/growth` and room data. No new backend APIs required for MVP. A dedicated gamification API can be added later for persistence/optimization.

### Loading, Empty, and Error States

**Loading**: Skeleton screens matching the layout shape (gray pulsing rectangles for cards, message bubbles, panels). No spinners except for inline actions (send message, generate report).

**Empty States**:
- Home with no conversations: Welcome message + prominent "Start your first practice" CTA
- Chat room list empty: "No conversations yet" + new room button
- Growth with no evaluations: Radar chart at zero + "Complete a conversation to see your scores"
- Settings with no personas: "Create your first AI opponent" CTA

**Error States**:
- API failure: Toast notification at top with retry action
- SSE disconnect: Yellow banner in chat header "Connection lost, reconnecting..." with auto-retry
- Failed message send: Message shows red outline with "Retry" button

## Design System

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#F4F9F6` | Page background |
| `--bg-card` | `#FBFDFB` | Card/panel background |
| `--bg-elevated` | `#FFFFFF` | Elevated elements, modals |
| `--border` | `#DAE8E0` | Default borders |
| `--border-accent` | `rgba(45,156,111,0.25)` | Active/focused borders |
| `--text-primary` | `#1A2E22` | Headings, body text |
| `--text-secondary` | `#7A9A88` | Labels, descriptions |
| `--text-muted` | `#4A6B56` | Timestamps, hints |
| `--green` | `#2D9C6F` | Primary actions, positive |
| `--green-soft` | `rgba(45,156,111,0.12)` | Green backgrounds |
| `--amber` | `#C8944A` | Urgent, battle prep |
| `--amber-soft` | `rgba(200,148,74,0.12)` | Amber backgrounds |
| `--violet` | `#8B7EC8` | Growth, analysis |
| `--rose` | `#C75B5B` | Negative, high pressure |

### Typography

- Font stack: `-apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif`
- Headings: 15px semibold (600), letter-spacing -0.2px
- Body: 12-13px regular (400)
- Labels: 10px medium (500), uppercase, letter-spacing 0.5-1px
- Muted: 9-10px

### Icons

- Library: Lucide React (already in project)
- Style: 1.5px stroke, round line-cap/join
- Standard size: 18x18 (nav), 14x14 (inline), 12x12 (small)
- Color inherits from parent `currentColor`
- No emoji anywhere in the UI

### Spacing & Radius

- Card border-radius: 12px
- Button border-radius: 8px
- Pill/badge border-radius: 20px
- Card padding: 18px
- Grid gap: 14px (cards), 10px (list items)
- Page max-width: 880px (centered)

### Avatar System

- Circle with surname initial character
- Muted, earthy color palette per persona (not neon):
  - `#8B5226` / `#D4A574` (warm brown)
  - `#1E3A5F` / `#6BA3D6` (deep blue)
  - `#3D2E5C` / `#A88EC8` (muted purple)
- Border: 2px solid card background color for stacking effect

### Interaction Patterns

- Card hover: border color brightens to accent color, subtle transition (0.2s)
- Active nav item: green-soft background
- Buttons: solid green for primary, bordered for secondary
- Transitions: 0.2s ease for all interactive elements
- No aggressive animations; motion should feel light and natural

## Component Architecture

### New Dependencies
- `react-router-dom` v6 — client-side routing

### Key Refactoring

**From App.tsx (1,382 lines) into:**

| New File | Responsibility |
|----------|---------------|
| `App.tsx` | Router setup, global layout (top bar + nav rail), global providers |
| `pages/HomePage.tsx` | Dashboard with cards, daily challenge, recent conversations, skill path |
| `pages/ChatPage.tsx` | Three-column chat layout, room list, message stream, context panel |
| `pages/BattlePrepPage.tsx` | Three-step wizard flow |
| `pages/GrowthPage.tsx` | Growth center with radar, history, profile card |
| `components/layout/TopBar.tsx` | Global top bar (logo, search, level, avatar) |
| `components/layout/NavRail.tsx` | Desktop left nav icon rail |
| `components/layout/BottomTabBar.tsx` | Mobile bottom navigation |
| `components/layout/CommandPalette.tsx` | Cmd+K global search/action overlay |
| `components/chat/MessageList.tsx` | Message rendering (AI, user, coach hints) |
| `components/chat/ChatInput.tsx` | Input bar with voice and send |
| `components/chat/ContextPanel.tsx` | Right sidebar (opponent, emotion, score) |
| `components/chat/RoomList.tsx` | Refactored from existing, with routing |
| `components/chat/CoachingPanel.tsx` | Coaching slide-out with review/live mode tabs |
| `components/chat/AnalysisPanel.tsx` | Analysis report viewer with message linking |
| `pages/SettingsPage.tsx` | Personas, scenarios, organizations, preferences |
| `hooks/useChat.ts` | Chat state: messages, streaming, SSE connection, input, mentions |
| `hooks/useCoaching.ts` | Coaching state: review mode + live mode, messages, streaming |
| `hooks/useVoice.ts` | Voice state: VAD recording, TTS playback, mute, audio queue |
| `hooks/useAnalysis.ts` | Analysis state: reports, generation, message highlighting |
| `hooks/useRooms.ts` | Room list state: fetch, select, delete |
| `hooks/useGrowth.ts` | Growth data fetching, gamification computation (XP, level, streak) |
| `hooks/useCommandPalette.ts` | Cmd+K state, search, keyboard navigation |
| `styles/tokens.css` | Design tokens (CSS custom properties) |

### State Management

No new state library. Use React Context + custom hooks to split the monolithic state:

- `ChatContext` — per-room chat state (messages, streaming content, dispatch summary, voice, analysis)
- `AppContext` — global state (persona map, organizations, scenarios, gamification data computed from growth API)
- Room selection handled by URL params via React Router

SSE connections are managed per-room: connect on mount when entering `/chat/:roomId`, disconnect on unmount. SSE event types: `message`, `streaming_delta`, `typing`, `audio_chunk`, `round_end`.

## Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| >= 1024px | Full three-column chat, nav rail visible, dashboard 2x2 grid |
| 768-1023px | Chat: left column collapsible, right panel collapsible, nav rail visible |
| < 768px | Mobile: bottom tab bar, no nav rail, chat full-screen, half-sheet panels |

## Migration Strategy

Incremental refactoring, not a rewrite:

1. Add `react-router-dom`, create `styles/tokens.css` with new design tokens (alias old token names to new ones for backward compat), wrap existing App content as a single catch-all route
2. Extract global layout: `TopBar.tsx`, `NavRail.tsx` from App.tsx
3. Move home dashboard content into `pages/HomePage.tsx` (new page, builds on existing growth data)
4. Extract chat hooks step by step:
   - 4a. Extract `useChat` hook (messages, SSE connection, streaming state)
   - 4b. Extract `components/chat/MessageList.tsx` (message rendering with react-markdown)
   - 4c. Extract `components/chat/ChatInput.tsx` (input bar, @mentions)
   - 4d. Extract `useVoice` hook + voice controls from VoiceRecorder
   - 4e. Extract `useCoaching` hook + `CoachingPanel.tsx` (both review and live modes)
   - 4f. Extract `useAnalysis` hook + `AnalysisPanel.tsx`
   - 4g. Extract `ContextPanel.tsx` (opponent, emotion, score)
   - 4h. Wire up `pages/ChatPage.tsx` three-column layout with all extracted pieces
5. Move battle prep into `pages/BattlePrepPage.tsx` (refactor from BattlePrepDialog)
6. Move growth into `pages/GrowthPage.tsx` (refactor from GrowthDashboard, add gamification computation)
7. Create `pages/SettingsPage.tsx` (refactor OrganizationDialog, PersonaEditorDialog, ScenarioDialog into inline forms)
8. Add `CommandPalette.tsx` as global overlay with keyboard shortcuts
9. Add responsive styles: `BottomTabBar.tsx`, mobile breakpoints, half-sheet panels
10. Swap design tokens from aliased old names to new names across all CSS files, apply mint green theme fully
11. Clean up: remove old App.tsx monolith, delete unused CSS files, remove backward-compat token aliases

**CSS Token Migration**: Old token -> new token mapping applied in step 1 as aliases, swapped to final values in step 10.

| Old Token | New Token |
|-----------|-----------|
| `--surface` | `--bg-base` |
| `--surface-secondary` | `--bg-card` |
| `--primary` | `--green` |
| `--sidebar-bg` | (removed — no dark sidebar) |
| `--sidebar-text` | (removed) |
| `--text-primary` (old) | `--text-primary` (new value) |

Each step should result in a working app. No big-bang switchover.

## Out of Scope

- New backend API endpoints (gamification computed frontend-side from existing APIs)
- New features beyond what already exists (all current features are preserved and relocated)
- Deep gamification (leaderboards, achievements, unlock gates)
- Dark mode toggle (can be added later via CSS custom properties swap)
- Internationalization changes
- Authentication/login flow

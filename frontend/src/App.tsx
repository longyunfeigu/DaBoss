import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import { AppProvider, useAppContext } from './contexts/AppContext'
import { MessageCircle, Layers, Plus, BarChart3, BarChart2, GraduationCap, Download, FileText, FileDown, Activity, Zap, Flag, Loader2, Building2, TrendingUp } from 'lucide-react'
import './App.css'
import Avatar from './components/Avatar'
import RoomList from './components/RoomList'
import CreateRoomDialog from './components/CreateRoomDialog'
import PersonaEditorDialog from './components/PersonaEditorDialog'
import ScenarioDialog from './components/ScenarioDialog'
import OrganizationDialog from './components/OrganizationDialog'
import EmotionCurve from './components/EmotionCurve'
import EmotionSidebar from './components/EmotionSidebar'
import GrowthDashboard from './components/GrowthDashboard'
import BattlePrepDialog from './components/BattlePrepDialog'
import CheatSheetComponent from './components/CheatSheet'
import MessageList from './components/chat/MessageList'
import ChatInput from './components/chat/ChatInput'
import CoachingPanel from './components/chat/CoachingPanel'
import AnalysisPanel from './components/chat/AnalysisPanel'
import ContextPanel from './components/chat/ContextPanel'
import { useChat } from './hooks/useChat'
import { useVoice } from './hooks/useVoice'
import { useCoaching } from './hooks/useCoaching'
import { useAnalysis } from './hooks/useAnalysis'
import {
  exportRoom,
  exportRoomHtml,
  generateCheatSheet,
  type ChatRoom,
  type PersonaSummary,
  type CheatSheet as CheatSheetData,
} from './services/api'

function AppInner() {
  const { personaMap, currentOrg, reloadPersonas, reloadOrganizations } = useAppContext()

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showScenarioDialog, setShowScenarioDialog] = useState(false)
  const [showOrgDialog, setShowOrgDialog] = useState(false)
  const [showGrowth, setShowGrowth] = useState(false)
  const [showEmotionSidebar, setShowEmotionSidebar] = useState(false)
  const [showEmotionCurve, setShowEmotionCurve] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [personaEditorState, setPersonaEditorState] = useState<{
    open: boolean
    persona: PersonaSummary | null
  }>({ open: false, persona: null })
  const [refreshKey, setRefreshKey] = useState(0)
  // Battle prep state
  const [showBattlePrep, setShowBattlePrep] = useState(false)
  const [cheatSheetData, setCheatSheetData] = useState<CheatSheetData | null>(null)
  const [cheatSheetPersona, setCheatSheetPersona] = useState('')
  const [battlePrepRoundCount, setBattlePrepRoundCount] = useState(0)
  const [battlePrepEnding, setBattlePrepEnding] = useState(false)

  // --- Hooks ---
  const voice = useVoice()

  const chat = useChat(selectedRoomId, {
    audioPlayerRef: voice.audioPlayerRef,
  })

  const coaching = useCoaching(selectedRoomId)
  const analysis = useAnalysis(selectedRoomId)

  // Aliases for backward compat within this file
  const loadPersonas = reloadPersonas
  const loadOrg = reloadOrganizations

  const handleSelectRoom = async (room: ChatRoom) => {
    setShowGrowth(false)
    setSelectedRoomId(room.id)
    setBattlePrepRoundCount(0)
    chat.loadRoomDetail(room.id)
  }

  const handleRoomCreated = async (roomId: number) => {
    setRefreshKey((k) => k + 1)
    setSelectedRoomId(roomId)
    chat.loadRoomDetail(roomId)
  }

  const handleBattlePrepStarted = async (roomId: number) => {
    setShowBattlePrep(false)
    setBattlePrepRoundCount(0)
    setRefreshKey((k) => k + 1)
    setSelectedRoomId(roomId)
    setShowGrowth(false)
    chat.loadRoomDetail(roomId)
  }

  const handleEndBattle = async () => {
    if (!selectedRoomId || !chat.selectedRoom || battlePrepEnding) return
    const personaId = chat.selectedRoom.room.persona_ids[0] || ''
    const persona = personaMap[personaId]
    setCheatSheetPersona(persona?.name || '对方')
    setBattlePrepEnding(true)
    try {
      const sheet = await generateCheatSheet(selectedRoomId)
      setCheatSheetData(sheet)
    } catch (e: any) {
      alert(e?.message || '话术纸条生成失败')
    } finally {
      setBattlePrepEnding(false)
    }
  }

  const handleSend = async () => {
    const success = await chat.handleSend()
    if (!success) return
    // Track battle prep rounds
    if (chat.selectedRoom?.room.type === 'battle_prep') {
      const newCount = battlePrepRoundCount + 1
      setBattlePrepRoundCount(newCount)
      if (newCount >= 12) {
        // Auto-trigger cheat sheet after a short delay for the last reply
        setTimeout(() => handleEndBattle(), 3000)
      }
    }
    // SSE will push the messages -- just refresh room list for ordering
    setRefreshKey((k) => k + 1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If mention dropdown is visible, don't send -- let user pick
      if (chat.mentionQuery !== null && chat.mentionResults.length > 0) {
        e.preventDefault()
        chat.insertMention(chat.mentionResults[0])
        return
      }
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    chat.handleInputChange(
      e,
      personaMap,
      chat.selectedRoom?.room.type,
      chat.selectedRoom?.room.persona_ids,
    )
  }

  /** Personas for the currently selected room */
  const roomPersonas = chat.selectedRoom
    ? chat.selectedRoom.room.persona_ids
        .map((id) => personaMap[id])
        .filter(Boolean)
    : []

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon"><MessageCircle size={20} /></div>
          <div>
            <div className="sidebar-brand-name">StakeCoach AI</div>
            <div className="sidebar-brand-sub">利益相关者沟通教练</div>
          </div>
        </div>

        {/* Organization section */}
        <div className="org-section">
          <div className="org-section-header">
            <span className="sidebar-section-title">组织</span>
          </div>
          <div className="org-badge" onClick={() => setShowOrgDialog(true)}>
            <Building2 size={14} />
            {currentOrg ? (
              <span className="org-badge-name">{currentOrg.name}</span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>点击创建组织</span>
            )}
          </div>
        </div>

        {/* Persona panel */}
        <div className="persona-panel">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">角色</span>
            <div className="sidebar-section-actions">
              <button
                className="sidebar-icon-btn"
                onClick={() => setShowScenarioDialog(true)}
                title="场景管理"
              >
                <Layers size={14} />
              </button>
              <button
                className="sidebar-icon-btn"
                onClick={() => setPersonaEditorState({ open: true, persona: null })}
                title="新建角色"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {Object.values(personaMap).map((p) => (
            <div
              key={p.id}
              className="persona-item"
              onClick={() =>
                setPersonaEditorState({ open: true, persona: p })
              }
            >
              <Avatar name={p.name} color={p.avatar_color || '#2D9C6F'} size={28} />
              <div className="persona-item-info">
                <span className="persona-item-name">{p.name}</span>
                <span className="persona-item-role">{p.role}</span>
              </div>
            </div>
          ))}
        </div>

        <RoomList
          selectedRoomId={selectedRoomId}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={() => setShowCreateDialog(true)}
          onRoomDeleted={(id) => {
            if (selectedRoomId === id) {
              setSelectedRoomId(null)
              chat.setSelectedRoom(null)
            }
          }}
          refreshKey={refreshKey}
        />

        <button
          className="battle-prep-btn"
          onClick={() => setShowBattlePrep(true)}
        >
          <Zap size={16} />
          <span>紧急备战</span>
        </button>

        {/* Growth tab button */}
        <button
          className={`growth-btn ${showGrowth ? 'active' : ''}`}
          onClick={() => {
            setShowGrowth(true)
            setSelectedRoomId(null)
            chat.setSelectedRoom(null)
          }}
        >
          <TrendingUp size={16} />
          <span>成长轨迹</span>
        </button>
      </aside>
      <main className="main-content">
        {showGrowth ? (
          <GrowthDashboard onCreateRoom={() => setShowCreateDialog(true)} />
        ) : chat.selectedRoom ? (
          <div className="chat-with-emotion">
          <div className="chat-view">
            <div className="chat-header">
              <div className="chat-header-left">
                <h3>{chat.selectedRoom.room.name}</h3>
                <span className={`room-type-badge ${chat.selectedRoom.room.type}`}>
                  {chat.selectedRoom.room.type === 'private' ? '私聊' : chat.selectedRoom.room.type === 'group' ? '群聊' : '备战'}
                </span>
              </div>
              <div className="chat-header-actions">
                <button
                  className={`header-action-btn ${showEmotionSidebar ? 'active' : ''}`}
                  onClick={() => setShowEmotionSidebar((v) => !v)}
                  title="实时情绪面板"
                >
                  <Activity size={16} />
                </button>
                <button
                  className="header-action-btn"
                  onClick={() => setShowEmotionCurve(true)}
                  title="情绪详细分析"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  className="header-action-btn"
                  onClick={analysis.handleAnalyze}
                  title="分析"
                  disabled={analysis.analyzingRoom}
                >
                  <BarChart2 size={16} />
                </button>
                <button
                  className="header-action-btn coaching"
                  onClick={() => coaching.handleStartCoaching()}
                  title="AI 复盘"
                  disabled={coaching.coachingSending}
                >
                  <GraduationCap size={16} />
                </button>
                <div className="export-dropdown-wrapper">
                  <button
                    className="header-action-btn"
                    onClick={() => setShowExportMenu((v) => !v)}
                    title="导出"
                  >
                    <Download size={16} />
                  </button>
                  {showExportMenu && (
                    <div className="export-menu">
                      <div
                        className="export-menu-item"
                        onClick={() => {
                          setShowExportMenu(false)
                          exportRoomHtml(chat.selectedRoom!.room.id).catch(console.error)
                        }}
                      >
                        <FileText size={15} />
                        <div>
                          <div>HTML 格式</div>
                          <span className="export-menu-desc">保留聊天样式</span>
                        </div>
                      </div>
                      <div
                        className="export-menu-item"
                        onClick={() => {
                          setShowExportMenu(false)
                          exportRoom(chat.selectedRoom!.room.id).catch(console.error)
                        }}
                      >
                        <FileDown size={15} />
                        <div>
                          <div>Markdown 格式</div>
                          <span className="export-menu-desc">纯文本，便于编辑</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {chat.selectedRoom.room.type === 'battle_prep' && (
              <div className="battle-prep-bar">
                <Zap size={14} />
                <span>备战模式 · 已练 {battlePrepRoundCount}/12 轮</span>
                <button className="end-battle-btn" onClick={handleEndBattle} disabled={battlePrepEnding}>
                  {battlePrepEnding ? <Loader2 size={14} className="spin" /> : <Flag size={14} />}
                  {battlePrepEnding ? '生成话术纸条...' : '结束备战'}
                </button>
              </div>
            )}

            <MessageList
              messages={chat.selectedRoom.messages}
              streamingEntries={chat.streamingEntries}
              highlightedMessageId={analysis.highlightedMessageId}
              personaMap={personaMap}
              listRef={chat.messageListRef}
              dispatchSummary={chat.dispatchSummary}
              dispatchExpanded={chat.dispatchExpanded}
              onToggleDispatch={() => chat.setDispatchExpanded((v) => !v)}
              typingPersona={chat.typingPersona}
              playingPersonaId={voice.playingPersonaId}
              onClick={() => showExportMenu && setShowExportMenu(false)}
            />

            <ChatInput
              value={chat.inputValue}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onSend={handleSend}
              sending={chat.sending}
              placeholder={
                chat.selectedRoom.room.type === 'group'
                  ? '输入消息... 使用 @ 提及角色'
                  : '输入消息...'
              }
              mentionQuery={chat.mentionQuery}
              mentionResults={chat.mentionResults}
              onInsertMention={chat.insertMention}
              voiceEnabled={voice.voiceEnabled}
              voiceMuted={voice.voiceMuted}
              onToggleVoice={voice.toggleVoice}
              roomId={selectedRoomId}
              onVoiceTranscription={(text) => {
                if (!text.trim()) return
                chat.setInputValue('')
                chat.setDispatchSummary(null)
                voice.audioPlayerRef.current?.stop()
                setRefreshKey((k) => k + 1)
                setTimeout(chat.scrollToBottom, 100)
              }}
              onLiveCoachClick={coaching.handleStartLiveCoaching}
              coachingSending={coaching.coachingSending}
            />
          </div>

          {showEmotionSidebar && (
            <EmotionSidebar
              messages={chat.selectedRoom?.messages || []}
              personaMap={personaMap}
              onClose={() => setShowEmotionSidebar(false)}
              onExpand={() => setShowEmotionCurve(true)}
            />
          )}

          <ContextPanel
            personas={roomPersonas}
            collapsed={!showContextPanel}
            onToggle={() => setShowContextPanel((v) => !v)}
            onExpandEmotion={() => setShowEmotionCurve(true)}
          />
          </div>
        ) : (
          <div className="welcome-page">
            <div className="welcome-icon">
              <MessageCircle size={48} strokeWidth={1.5} />
            </div>
            <h2 className="welcome-title">开始一场对话</h2>
            <p className="welcome-desc">
              创建聊天室，与 AI 角色进行利益相关者沟通模拟，<br />
              提升你的沟通策略与应变能力。
            </p>
            <button className="welcome-cta" onClick={() => setShowCreateDialog(true)}>
              <Plus size={18} />
              新建聊天室
            </button>
          </div>
        )}
      </main>

      <CoachingPanel
        open={coaching.coachingOpen}
        mode={coaching.coachingMode}
        messages={coaching.coachingMessages}
        streamingContent={coaching.coachingStreaming}
        sending={coaching.coachingSending}
        inputValue={coaching.coachingInput}
        onInputChange={coaching.setCoachingInput}
        onSend={coaching.handleSendCoaching}
        onClose={() => coaching.setCoachingOpen(false)}
        sessionId={coaching.coachingSessionId}
        listRef={coaching.coachingListRef}
      />

      <CreateRoomDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleRoomCreated}
      />

      <PersonaEditorDialog
        open={personaEditorState.open}
        onClose={() => setPersonaEditorState({ open: false, persona: null })}
        onSaved={loadPersonas}
        editingPersona={personaEditorState.persona}
        currentOrg={currentOrg}
      />

      <ScenarioDialog
        open={showScenarioDialog}
        onClose={() => setShowScenarioDialog(false)}
      />

      <OrganizationDialog
        open={showOrgDialog}
        onClose={() => setShowOrgDialog(false)}
        onOrgChanged={() => { loadOrg(); loadPersonas() }}
        personas={Object.values(personaMap)}
      />

      <EmotionCurve
        open={showEmotionCurve}
        onClose={() => setShowEmotionCurve(false)}
        messages={chat.selectedRoom?.messages || []}
        personaMap={personaMap}
      />

      {/* Analysis result dialog */}
      {analysis.analysisResult && (
        <AnalysisPanel
          result={analysis.analysisResult}
          reportList={analysis.analysisReportList}
          analyzingRoom={analysis.analyzingRoom}
          onClose={() => analysis.setAnalysisResult(null)}
          onSelectReport={analysis.handleSelectReport}
          onGenerateNewReport={analysis.handleGenerateNewReport}
          onScrollToMessage={analysis.handleScrollToMessage}
        />
      )}

      <BattlePrepDialog
        open={showBattlePrep}
        onClose={() => setShowBattlePrep(false)}
        onStarted={handleBattlePrepStarted}
      />

      <CheatSheetComponent
        open={cheatSheetData !== null}
        onClose={() => setCheatSheetData(null)}
        data={cheatSheetData}
        personaName={cheatSheetPersona}
      />
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="*" element={<AppInner />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}

export default App

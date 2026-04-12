import React, { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import { AppProvider, useAppContext } from './contexts/AppContext'
import Markdown from 'react-markdown'
import { MessageCircle, Layers, Plus, BarChart3, BarChart2, GraduationCap, Download, FileText, FileDown, Send, ClipboardList, X, Building2, TrendingUp, Activity, Lightbulb, Volume2, VolumeX, Zap, Flag, Loader2 } from 'lucide-react'
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
import VoiceRecorder from './components/VoiceRecorder'
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

function formatTime(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Highlight @mentions inside a plain text string */
function highlightMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[\w\u4e00-\u9fff]+)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="mention-highlight">{part}</span>
    ) : (
      part
    ),
  )
}

/** Recursively walk React children, applying @mention highlights to string nodes */
function withMentions(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return highlightMentions(children)
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === 'string'
        ? <React.Fragment key={i}>{highlightMentions(child)}</React.Fragment>
        : child,
    )
  }
  return children
}

/** Render message content as Markdown with @mention highlights */
function renderContent(text: string) {
  return (
    <Markdown
      components={{
        p: ({ children }) => <p>{withMentions(children)}</p>,
        li: ({ children }) => <li>{withMentions(children)}</li>,
      }}
    >
      {text}
    </Markdown>
  )
}

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
            <div className="message-list" ref={chat.messageListRef} onClick={() => showExportMenu && setShowExportMenu(false)}>
              {chat.selectedRoom.messages.length === 0 && chat.streamingEntries.length === 0 ? (
                <div className="empty-messages">
                  <MessageCircle size={36} strokeWidth={1.2} />
                  <p>发送第一条消息，开始模拟对话</p>
                </div>
              ) : (
                <>
                  {chat.selectedRoom.messages.map((msg) => {
                    const persona = msg.sender_type === 'persona' ? personaMap[msg.sender_id] : null
                    const borderColor = persona?.avatar_color || undefined
                    return (
                      <div key={msg.id} id={`msg-${msg.id}`} className={`message ${msg.sender_type}${analysis.highlightedMessageId === msg.id ? ' highlighted' : ''}`} data-sender={msg.sender_type}>
                        {msg.sender_type === 'persona' && (
                          <div className="message-row">
                            <Avatar name={persona?.name || msg.sender_id} color={borderColor || '#2D9C6F'} size={28} />
                            <div className="message-content">
                              <div className="sender-name" style={borderColor ? { color: borderColor } : undefined}>
                                {persona?.name || msg.sender_id}
                                {msg.emotion_label && (
                                  <span className={`emotion-tag ${(msg.emotion_score ?? 0) > 0 ? 'positive' : (msg.emotion_score ?? 0) < 0 ? 'negative' : 'neutral'}`}>
                                    {msg.emotion_label}
                                  </span>
                                )}
                              </div>
                              <div
                                className="message-bubble"
                                style={borderColor ? { borderLeft: `2px solid ${borderColor}` } : undefined}
                              >
                                {renderContent(msg.content)}
                              </div>
                              <div className="message-time">{formatTime(msg.timestamp)}</div>
                            </div>
                          </div>
                        )}
                        {msg.sender_type === 'user' && (
                          <>
                            <div className="message-bubble">
                              {renderContent(msg.content)}
                            </div>
                            <div className="message-time">{formatTime(msg.timestamp)}</div>
                          </>
                        )}
                        {msg.sender_type === 'system' && (
                          <div className="message-bubble">
                            {renderContent(msg.content)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {/* Streaming messages -- in-progress persona replies */}
                  {chat.streamingEntries.map(([personaId, text]) => {
                    const persona = personaMap[personaId]
                    const borderColor = persona?.avatar_color || undefined
                    return (
                      <div key={`streaming-${personaId}`} className="message persona streaming" data-sender="persona">
                        <div className="message-row">
                          <Avatar name={persona?.name || personaId} color={borderColor || '#2D9C6F'} size={28} />
                          <div className="message-content">
                            <div className="sender-name" style={borderColor ? { color: borderColor } : undefined}>
                              {persona?.name || personaId}
                            </div>
                            <div
                              className="message-bubble"
                              style={borderColor ? { borderLeft: `2px solid ${borderColor}` } : undefined}
                            >
                              {renderContent(text)}
                              <span className="streaming-cursor" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
              {/* Dispatcher transparency: collapsible dispatch summary */}
              {chat.dispatchSummary && chat.dispatchSummary.length > 0 && (
                <div className="dispatch-summary" onClick={() => chat.setDispatchExpanded((v) => !v)}>
                  <div className="dispatch-summary-header">
                    <ClipboardList size={15} className="dispatch-summary-icon" />
                    <span>
                      本轮{' '}
                      {chat.dispatchSummary.reduce((n, p) => n + p.responders.length, 0)}{' '}
                      位角色参与讨论
                    </span>
                    <span className={`dispatch-expand-arrow ${chat.dispatchExpanded ? 'expanded' : ''}`}>&#9662;</span>
                  </div>
                  {chat.dispatchExpanded && (
                    <div className="dispatch-summary-body">
                      {chat.dispatchSummary.map((phase, i) => (
                        <div key={i} className="dispatch-phase">
                          <div className="dispatch-phase-label">
                            {phase.phase === 'initial'
                              ? '初始响应'
                              : `跟进讨论${phase.trigger_persona_id ? `（由 ${personaMap[phase.trigger_persona_id]?.name || phase.trigger_persona_id} 触发）` : ''}`}
                          </div>
                          <ul className="dispatch-responders">
                            {phase.responders.map((r) => (
                              <li key={r.persona_id}>
                                <strong style={{ color: personaMap[r.persona_id]?.avatar_color || undefined }}>
                                  {personaMap[r.persona_id]?.name || r.persona_id}
                                </strong>
                                {' — '}
                                {r.reason || '参与讨论'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {chat.typingPersona && chat.streamingEntries.length === 0 && (
                <div className="typing-indicator">
                  <div className="typing-dots"><span /><span /><span /></div>
                  {personaMap[chat.typingPersona]?.name || chat.typingPersona} 正在回复
                </div>
              )}
              {voice.playingPersonaId && !chat.typingPersona && (
                <div className="typing-indicator">
                  <Volume2 size={14} />
                  &nbsp;{personaMap[voice.playingPersonaId]?.name || voice.playingPersonaId} 正在播放语音
                </div>
              )}
            </div>
            <div className="message-input-bar">
              {chat.mentionQuery !== null && chat.mentionResults.length > 0 && (
                <div className="mention-dropdown">
                  {chat.mentionResults.map((p) => (
                    <div
                      key={p.id}
                      className="mention-item"
                      onClick={() => chat.insertMention(p)}
                    >
                      <Avatar name={p.name} color={p.avatar_color || '#2D9C6F'} size={24} />
                      <span className="mention-name">{p.name}</span>
                      <span className="mention-role">{p.role}</span>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={chat.inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  chat.selectedRoom.room.type === 'group'
                    ? '输入消息... 使用 @ 提及角色'
                    : '输入消息...'
                }
                disabled={chat.sending}
              />
              {voice.voiceEnabled && selectedRoomId && (
                <VoiceRecorder
                  roomId={selectedRoomId}
                  disabled={chat.sending}
                  onTranscription={(text) => {
                    if (!text.trim()) return
                    chat.setInputValue('')
                    chat.setDispatchSummary(null)
                    voice.audioPlayerRef.current?.stop()
                    setRefreshKey((k) => k + 1)
                    setTimeout(chat.scrollToBottom, 100)
                  }}
                />
              )}
              <button
                className={`voice-toggle-btn ${voice.voiceMuted ? 'muted' : ''}`}
                onClick={voice.toggleVoice}
                title={!voice.voiceEnabled ? '开启语音' : voice.voiceMuted ? '关闭语音模式' : '静音'}
              >
                {voice.voiceEnabled && !voice.voiceMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button
                className="live-coach-btn"
                onClick={coaching.handleStartLiveCoaching}
                title="求助教练"
                disabled={coaching.coachingSending}
              >
                <Lightbulb size={18} />
              </button>
              <button className="send-btn" onClick={handleSend} disabled={!chat.inputValue.trim() || chat.sending}>
                <Send size={18} />
              </button>
            </div>
          </div>
          {showEmotionSidebar && (
            <EmotionSidebar
              messages={chat.selectedRoom?.messages || []}
              personaMap={personaMap}
              onClose={() => setShowEmotionSidebar(false)}
              onExpand={() => setShowEmotionCurve(true)}
            />
          )}
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

      {/* Coaching side panel */}
      {coaching.coachingOpen && (
        <aside className="coaching-panel">
          <div className="coaching-header">
            {coaching.coachingMode === 'live' ? <Lightbulb size={18} /> : <GraduationCap size={18} />}
            <h3>{coaching.coachingMode === 'live' ? '实时教练' : 'AI Coach 复盘'}</h3>
            <button className="coaching-close" onClick={() => coaching.setCoachingOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="coaching-messages" ref={coaching.coachingListRef}>
            {coaching.coachingMessages.map((msg) => (
              <div key={msg.id} className={`coaching-msg ${msg.role}`}>
                <div className="coaching-msg-role">{msg.role === 'coach' ? 'Coach' : '你'}</div>
                <div className="coaching-msg-bubble">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            ))}
            {coaching.coachingStreaming && (
              <div className="coaching-msg coach streaming">
                <div className="coaching-msg-role">Coach</div>
                <div className="coaching-msg-bubble">
                  <Markdown>{coaching.coachingStreaming}</Markdown>
                  <span className="streaming-cursor" />
                </div>
              </div>
            )}
            {coaching.coachingSending && !coaching.coachingStreaming && coaching.coachingMessages.length === 0 && (
              <div className="coaching-loading">
                <div className="typing-dots"><span /><span /><span /></div>
                Coach 正在思考
              </div>
            )}
          </div>
          <div className="coaching-input-bar">
            <input
              type="text"
              value={coaching.coachingInput}
              onChange={(e) => coaching.setCoachingInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); coaching.handleSendCoaching() } }}
              placeholder="回复 Coach..."
              disabled={coaching.coachingSending || (coaching.coachingMode === 'review' && !coaching.coachingSessionId)}
            />
            <button className="send-btn coaching-send" onClick={coaching.handleSendCoaching} disabled={!coaching.coachingInput.trim() || coaching.coachingSending || (coaching.coachingMode === 'review' && !coaching.coachingSessionId)}>
              <Send size={16} />
            </button>
          </div>
        </aside>
      )}

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
        <div className="dialog-overlay" onClick={() => analysis.setAnalysisResult(null)}>
          <div className="dialog analysis-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="analysis-header">
              <h3>对话分析报告</h3>
              <button className="analysis-close" onClick={() => analysis.setAnalysisResult(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Historical report selector */}
            {analysis.analysisReportList.length > 1 && (
              <div className="analysis-report-selector">
                <select
                  value={analysis.analysisResult.id}
                  onChange={(e) => analysis.handleSelectReport(Number(e.target.value))}
                >
                  {analysis.analysisReportList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : `报告 #${r.id}`}
                    </option>
                  ))}
                </select>
                <button
                  className="analysis-new-btn"
                  onClick={analysis.handleGenerateNewReport}
                  disabled={analysis.analyzingRoom}
                >
                  {analysis.analyzingRoom ? '生成中...' : '+ 新报告'}
                </button>
              </div>
            )}
            {analysis.analysisReportList.length <= 1 && (
              <div className="analysis-report-selector">
                <span className="analysis-report-date">
                  {analysis.analysisResult.created_at ? new Date(analysis.analysisResult.created_at).toLocaleString() : ''}
                </span>
                <button
                  className="analysis-new-btn"
                  onClick={analysis.handleGenerateNewReport}
                  disabled={analysis.analyzingRoom}
                >
                  {analysis.analyzingRoom ? '生成中...' : '重新分析'}
                </button>
              </div>
            )}

            <p className="analysis-summary">{analysis.analysisResult.summary}</p>

            {/* Resistance ranking cards */}
            {analysis.analysisResult.content.resistance_ranking.length > 0 && (
              <div className="analysis-section">
                <h4>阻力排名</h4>
                <div className="analysis-cards">
                  {analysis.analysisResult.content.resistance_ranking.map((item, i) => {
                    const hasLinks = item.message_indices && item.message_indices.length > 0 && analysis.analysisResult!.content.message_id_map
                    return (
                      <div key={i} className={`analysis-card${hasLinks ? ' clickable' : ''}`}
                        onClick={() => hasLinks && analysis.handleScrollToMessage(item.message_indices, analysis.analysisResult!.content.message_id_map)}
                      >
                        <div className="analysis-card-header">
                          <span className="analysis-card-name">{item.persona_name}</span>
                          <span className={`analysis-card-score ${item.score >= 0 ? 'positive' : 'negative'}`}>
                            {item.score > 0 ? '+' : ''}{item.score}
                          </span>
                        </div>
                        <div className="analysis-card-body">{item.reason}</div>
                        {hasLinks && (
                          <div className="analysis-card-link">点击查看对话原文 →</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Effective arguments cards */}
            {analysis.analysisResult.content.effective_arguments.length > 0 && (
              <div className="analysis-section">
                <h4>有效论点</h4>
                <div className="analysis-cards">
                  {analysis.analysisResult.content.effective_arguments.map((item, i) => {
                    const hasLinks = item.message_indices && item.message_indices.length > 0 && analysis.analysisResult!.content.message_id_map
                    return (
                      <div key={i} className={`analysis-card argument${hasLinks ? ' clickable' : ''}`}
                        onClick={() => hasLinks && analysis.handleScrollToMessage(item.message_indices, analysis.analysisResult!.content.message_id_map)}
                      >
                        <div className="analysis-card-header">
                          <span className="analysis-card-argument">{item.argument}</span>
                          <span className="analysis-card-target">→ {item.target_persona}</span>
                        </div>
                        <div className="analysis-card-body">{item.effectiveness}</div>
                        {hasLinks && (
                          <div className="analysis-card-link">点击查看对话原文 →</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Communication suggestions */}
            {analysis.analysisResult.content.communication_suggestions.length > 0 && (
              <div className="analysis-section">
                <h4>沟通建议</h4>
                <div className="analysis-cards">
                  {analysis.analysisResult.content.communication_suggestions.map((item, i) => (
                    <div key={i} className="analysis-card suggestion">
                      <div className="analysis-card-header">
                        <span className="analysis-card-name">{item.persona_name}</span>
                        <span className={`suggestion-priority ${item.priority}`}>{item.priority}</span>
                      </div>
                      <div className="analysis-card-body">{item.suggestion}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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

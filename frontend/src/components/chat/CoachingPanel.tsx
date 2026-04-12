import React from 'react'
import Markdown from 'react-markdown'
import { GraduationCap, Lightbulb, X, Send } from 'lucide-react'
import type { CoachingMessageItem } from '../../services/api'
import './CoachingPanel.css'

export interface CoachingPanelProps {
  open: boolean
  mode: 'review' | 'live'
  messages: CoachingMessageItem[]
  streamingContent: string
  sending: boolean
  inputValue: string
  onInputChange: (value: string) => void
  onSend: () => void
  onClose: () => void
  sessionId: number | null
  listRef: React.RefObject<HTMLDivElement | null>
}

export default function CoachingPanel({
  open,
  mode,
  messages,
  streamingContent,
  sending,
  inputValue,
  onInputChange,
  onSend,
  onClose,
  sessionId,
  listRef,
}: CoachingPanelProps) {
  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const inputDisabled = sending || (mode === 'review' && !sessionId)
  const sendDisabled = !inputValue.trim() || sending || (mode === 'review' && !sessionId)

  return (
    <aside className="coaching-panel">
      <div className="coaching-header">
        {mode === 'live' ? <Lightbulb size={18} /> : <GraduationCap size={18} />}
        <h3>{mode === 'live' ? '实时教练' : 'AI Coach 复盘'}</h3>
        <button className="coaching-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="coaching-messages" ref={listRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`coaching-msg ${msg.role}`}>
            <div className="coaching-msg-role">{msg.role === 'coach' ? 'Coach' : '你'}</div>
            <div className="coaching-msg-bubble">
              <Markdown>{msg.content}</Markdown>
            </div>
          </div>
        ))}
        {streamingContent && (
          <div className="coaching-msg coach streaming">
            <div className="coaching-msg-role">Coach</div>
            <div className="coaching-msg-bubble">
              <Markdown>{streamingContent}</Markdown>
              <span className="streaming-cursor" />
            </div>
          </div>
        )}
        {sending && !streamingContent && messages.length === 0 && (
          <div className="coaching-loading">
            <div className="typing-dots"><span /><span /><span /></div>
            Coach 正在思考
          </div>
        )}
      </div>
      <div className="coaching-input-bar">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="回复 Coach..."
          disabled={inputDisabled}
        />
        <button
          className="send-btn coaching-send"
          onClick={onSend}
          disabled={sendDisabled}
        >
          <Send size={16} />
        </button>
      </div>
    </aside>
  )
}

import React from 'react'
import Markdown from 'react-markdown'
import { MessageCircle, ClipboardList, Volume2 } from 'lucide-react'
import Avatar from '../Avatar'
import type { Message, DispatchPhase, PersonaSummary } from '../../services/api'
import './MessageList.css'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface MessageListProps {
  messages: Message[]
  streamingEntries: [string, string][]
  highlightedMessageId: number | null
  personaMap: Record<string, PersonaSummary>
  /** ref forwarded to the scrollable container */
  listRef: React.RefObject<HTMLDivElement | null>
  /** Dispatch transparency metadata */
  dispatchSummary: DispatchPhase[] | null
  dispatchExpanded: boolean
  onToggleDispatch: () => void
  /** Typing / voice indicators */
  typingPersona: string | null
  playingPersonaId: string | null
  /** Close export menu on click inside message list */
  onClick?: () => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MessageList({
  messages,
  streamingEntries,
  highlightedMessageId,
  personaMap,
  listRef,
  dispatchSummary,
  dispatchExpanded,
  onToggleDispatch,
  typingPersona,
  playingPersonaId,
  onClick,
}: MessageListProps) {
  const isEmpty = messages.length === 0 && streamingEntries.length === 0

  return (
    <div className="message-list" ref={listRef} onClick={onClick}>
      {isEmpty ? (
        <div className="empty-messages">
          <MessageCircle size={36} strokeWidth={1.2} />
          <p>发送第一条消息，开始模拟对话</p>
        </div>
      ) : (
        <>
          {messages.map((msg) => {
            const persona = msg.sender_type === 'persona' ? personaMap[msg.sender_id] : null
            const borderColor = persona?.avatar_color || undefined
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`message ${msg.sender_type}${highlightedMessageId === msg.id ? ' highlighted' : ''}`}
                data-sender={msg.sender_type}
              >
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
          {streamingEntries.map(([personaId, text]) => {
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
      {dispatchSummary && dispatchSummary.length > 0 && (
        <div className="dispatch-summary" onClick={onToggleDispatch}>
          <div className="dispatch-summary-header">
            <ClipboardList size={15} className="dispatch-summary-icon" />
            <span>
              本轮{' '}
              {dispatchSummary.reduce((n, p) => n + p.responders.length, 0)}{' '}
              位角色参与讨论
            </span>
            <span className={`dispatch-expand-arrow ${dispatchExpanded ? 'expanded' : ''}`}>&#9662;</span>
          </div>
          {dispatchExpanded && (
            <div className="dispatch-summary-body">
              {dispatchSummary.map((phase, i) => (
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

      {typingPersona && streamingEntries.length === 0 && (
        <div className="typing-indicator">
          <div className="typing-dots"><span /><span /><span /></div>
          {personaMap[typingPersona]?.name || typingPersona} 正在回复
        </div>
      )}

      {playingPersonaId && !typingPersona && (
        <div className="typing-indicator">
          <Volume2 size={14} />
          &nbsp;{personaMap[playingPersonaId]?.name || playingPersonaId} 正在播放语音
        </div>
      )}
    </div>
  )
}

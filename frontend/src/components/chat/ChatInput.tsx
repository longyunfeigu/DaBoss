import React from 'react'
import { Send, Lightbulb, Volume2, VolumeX } from 'lucide-react'
import Avatar from '../Avatar'
import VoiceRecorder from '../VoiceRecorder'
import type { PersonaSummary } from '../../services/api'
import './ChatInput.css'

export interface ChatInputProps {
  value: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  sending: boolean
  placeholder?: string
  /** @mention autocomplete */
  mentionQuery: string | null
  mentionResults: PersonaSummary[]
  onInsertMention: (persona: PersonaSummary) => void
  /** Voice */
  voiceEnabled: boolean
  voiceMuted: boolean
  onToggleVoice: () => void
  roomId: number | null
  onVoiceTranscription?: (text: string) => void
  /** Live coaching button */
  onLiveCoachClick: () => void
  coachingSending: boolean
}

export default function ChatInput({
  value,
  onInputChange,
  onKeyDown,
  onSend,
  sending,
  placeholder = '输入消息...',
  mentionQuery,
  mentionResults,
  onInsertMention,
  voiceEnabled,
  voiceMuted,
  onToggleVoice,
  roomId,
  onVoiceTranscription,
  onLiveCoachClick,
  coachingSending,
}: ChatInputProps) {
  return (
    <div className="message-input-bar">
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="mention-dropdown">
          {mentionResults.map((p) => (
            <div
              key={p.id}
              className="mention-item"
              onClick={() => onInsertMention(p)}
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
        value={value}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={sending}
      />
      {voiceEnabled && roomId && (
        <VoiceRecorder
          roomId={roomId}
          disabled={sending}
          onTranscription={onVoiceTranscription}
        />
      )}
      <button
        className={`voice-toggle-btn ${voiceMuted ? 'muted' : ''}`}
        onClick={onToggleVoice}
        title={!voiceEnabled ? '开启语音' : voiceMuted ? '关闭语音模式' : '静音'}
      >
        {voiceEnabled && !voiceMuted ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <button
        className="live-coach-btn"
        onClick={onLiveCoachClick}
        title="求助教练"
        disabled={coachingSending}
      >
        <Lightbulb size={18} />
      </button>
      <button className="send-btn" onClick={onSend} disabled={!value.trim() || sending}>
        <Send size={18} />
      </button>
    </div>
  )
}

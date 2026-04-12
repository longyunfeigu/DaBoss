import { useEffect, useRef, useState, useCallback } from 'react'
import {
  fetchRoomDetail,
  sendMessage as apiSendMessage,
  type ChatRoomDetail,
  type DispatchPhase,
  type Message,
  type PersonaSummary,
  type RoundEndData,
} from '../services/api'

const API_BASE = '/api/v1/stakeholder'

export interface UseChatReturn {
  selectedRoom: ChatRoomDetail | null
  setSelectedRoom: React.Dispatch<React.SetStateAction<ChatRoomDetail | null>>
  streamingContent: Record<string, string>
  dispatchSummary: DispatchPhase[] | null
  setDispatchSummary: React.Dispatch<React.SetStateAction<DispatchPhase[] | null>>
  dispatchExpanded: boolean
  setDispatchExpanded: React.Dispatch<React.SetStateAction<boolean>>
  sending: boolean
  inputValue: string
  setInputValue: React.Dispatch<React.SetStateAction<string>>
  mentionQuery: string | null
  mentionResults: PersonaSummary[]
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>
  setMentionResults: React.Dispatch<React.SetStateAction<PersonaSummary[]>>
  typingPersona: string | null
  streamingEntries: [string, string][]
  messageListRef: React.RefObject<HTMLDivElement | null>
  handleSend: () => Promise<boolean>
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    personaMap: Record<string, PersonaSummary>,
    roomType?: string,
    roomPersonaIds?: string[],
  ) => void
  insertMention: (persona: PersonaSummary) => void
  scrollToBottom: () => void
  loadRoomDetail: (roomId: number) => Promise<ChatRoomDetail | null>
}

export function useChat(
  roomId: number | null,
  options?: {
    onRoundEnd?: () => void
    audioPlayerRef?: React.RefObject<{ stop: () => void; isMuted: () => boolean; enqueue: (personaId: string, data: string, replyId?: string, sentenceIndex?: number) => void } | null>
  },
): UseChatReturn {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomDetail | null>(null)
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({})
  const [dispatchSummary, setDispatchSummary] = useState<DispatchPhase[] | null>(null)
  const [dispatchExpanded, setDispatchExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [typingPersona, setTypingPersona] = useState<string | null>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<PersonaSummary[]>([])

  const messageListRef = useRef<HTMLDivElement | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const eventSourceVersionRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [])

  // SSE connection management
  useEffect(() => {
    if (!roomId) return

    // Close previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    const streamVersion = eventSourceVersionRef.current + 1
    eventSourceVersionRef.current = streamVersion
    const es = new EventSource(`${API_BASE}/rooms/${roomId}/stream`)
    eventSourceRef.current = es
    const isCurrentStream = () =>
      eventSourceRef.current === es && eventSourceVersionRef.current === streamVersion

    es.addEventListener('message', (e) => {
      if (!isCurrentStream()) return
      const msg: Message = JSON.parse(e.data)
      // Clear streaming content for this persona -- the final message replaces it
      if (msg.sender_type === 'persona') {
        setStreamingContent((prev) => {
          const next = { ...prev }
          delete next[msg.sender_id]
          return next
        })
      }
      setSelectedRoom((prev) => {
        if (!prev || prev.room.id !== msg.room_id) return prev
        // Avoid duplicates
        const exists = prev.messages.some((m) => m.id === msg.id)
        if (exists) return prev
        return { ...prev, messages: [...prev.messages, msg] }
      })
      setTimeout(scrollToBottom, 50)
    })

    es.addEventListener('streaming_delta', (e) => {
      if (!isCurrentStream()) return
      const data: { persona_id: string; delta: string } = JSON.parse(e.data)
      setStreamingContent((prev) => ({
        ...prev,
        [data.persona_id]: (prev[data.persona_id] || '') + data.delta,
      }))
      setTimeout(scrollToBottom, 30)
    })

    es.addEventListener('typing', (e) => {
      if (!isCurrentStream()) return
      const data = JSON.parse(e.data)
      if (data.status === 'start') {
        setTypingPersona(data.persona_id)
      } else {
        setTypingPersona(null)
        // Fallback cleanup of streaming content
        setStreamingContent((prev) => {
          const next = { ...prev }
          delete next[data.persona_id]
          return next
        })
      }
    })

    es.addEventListener('audio_chunk', (e) => {
      if (!isCurrentStream()) return
      const player = options?.audioPlayerRef?.current
      if (player && !player.isMuted()) {
        const data = JSON.parse(e.data)
        if (data.data) {
          player.enqueue(
            data.persona_id, data.data, data.reply_id, data.sentence_index,
          )
        }
      }
    })

    es.addEventListener('round_end', (e) => {
      if (!isCurrentStream()) return
      setTypingPersona(null)
      setStreamingContent({})
      try {
        const data: RoundEndData = JSON.parse(e.data)
        if (data.dispatch_log && data.dispatch_log.length > 0) {
          setDispatchSummary(data.dispatch_log)
          setDispatchExpanded(false)
        }
      } catch {
        // Backward compat: old backend may send empty payload
      }
    })

    es.onerror = () => {
      if (!isCurrentStream()) return
      setTypingPersona(null)
    }

    return () => {
      eventSourceVersionRef.current += 1
      es.close()
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null
      }
      setTypingPersona(null)
      setStreamingContent({})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const loadRoomDetail = useCallback(async (id: number): Promise<ChatRoomDetail | null> => {
    try {
      const detail = await fetchRoomDetail(id)
      setSelectedRoom(detail)
      setTimeout(scrollToBottom, 50)
      return detail
    } catch {
      setSelectedRoom(null)
      return null
    }
  }, [scrollToBottom])

  const handleSend = useCallback(async (): Promise<boolean> => {
    const content = inputValue.trim()
    if (!content || !roomId || sending) return false

    // Stop any playing audio when user sends a new message
    options?.audioPlayerRef?.current?.stop()

    setSending(true)
    setInputValue('')
    setMentionQuery(null)
    setMentionResults([])
    setDispatchSummary(null)

    try {
      await apiSendMessage(roomId, content)
      setTimeout(scrollToBottom, 100)
      return true
    } catch (e: any) {
      console.error('Send failed:', e)
      // Fallback: refresh room detail
      if (roomId) {
        const detail = await fetchRoomDetail(roomId)
        setSelectedRoom(detail)
        setTimeout(scrollToBottom, 50)
      }
      return false
    } finally {
      setSending(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, roomId, sending, scrollToBottom])

  const insertMention = useCallback((persona: PersonaSummary) => {
    setInputValue((prev) =>
      prev.replace(/@[\w\u4e00-\u9fff]*$/, `@${persona.name} `),
    )
    setMentionQuery(null)
    setMentionResults([])
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // If mention dropdown is visible, don't send -- let user pick
      if (mentionQuery !== null && mentionResults.length > 0) {
        e.preventDefault()
        insertMention(mentionResults[0])
        return
      }
      e.preventDefault()
      handleSend()
    }
  }, [mentionQuery, mentionResults, insertMention, handleSend])

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    personaMap: Record<string, PersonaSummary>,
    roomType?: string,
    roomPersonaIds?: string[],
  ) => {
    const val = e.target.value
    setInputValue(val)

    const atMatch = val.match(/@([\w\u4e00-\u9fff]*)$/)
    if (atMatch && roomType === 'group') {
      const query = atMatch[1].toLowerCase()
      const roomPids = new Set(roomPersonaIds || [])
      const matches = Object.values(personaMap).filter(
        (p) =>
          roomPids.has(p.id) &&
          (p.name.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)),
      )
      setMentionQuery(atMatch[1])
      setMentionResults(matches)
    } else {
      setMentionQuery(null)
      setMentionResults([])
    }
  }, [])

  const streamingEntries = Object.entries(streamingContent) as [string, string][]

  return {
    selectedRoom,
    setSelectedRoom,
    streamingContent,
    dispatchSummary,
    setDispatchSummary,
    dispatchExpanded,
    setDispatchExpanded,
    sending,
    inputValue,
    setInputValue,
    mentionQuery,
    mentionResults,
    setMentionQuery,
    setMentionResults,
    typingPersona,
    streamingEntries,
    messageListRef,
    handleSend,
    handleKeyDown,
    handleInputChange,
    insertMention,
    scrollToBottom,
    loadRoomDetail,
  }
}

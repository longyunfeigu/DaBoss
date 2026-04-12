import { useRef, useState, useCallback } from 'react'
import {
  listAnalysisReports,
  createAnalysisReport,
  startCoachingStream,
  sendCoachingMessageStream,
  startLiveCoaching as apiStartLiveCoaching,
  sendLiveCoachingMessage,
  type CoachingMessageItem,
} from '../services/api'

export interface UseCoachingReturn {
  coachingOpen: boolean
  setCoachingOpen: React.Dispatch<React.SetStateAction<boolean>>
  coachingMode: 'review' | 'live'
  coachingMessages: CoachingMessageItem[]
  coachingStreaming: string
  coachingSending: boolean
  coachingInput: string
  setCoachingInput: React.Dispatch<React.SetStateAction<string>>
  coachingSessionId: number | null
  coachingListRef: React.RefObject<HTMLDivElement | null>
  handleStartCoaching: () => Promise<void>
  handleStartLiveCoaching: () => Promise<void>
  handleSendCoaching: () => Promise<void>
}

export function useCoaching(roomId: number | null): UseCoachingReturn {
  const [coachingOpen, setCoachingOpen] = useState(false)
  const [coachingMode, setCoachingMode] = useState<'review' | 'live'>('review')
  const [coachingSessionId, setCoachingSessionId] = useState<number | null>(null)
  const [coachingMessages, setCoachingMessages] = useState<CoachingMessageItem[]>([])
  const [coachingStreaming, setCoachingStreaming] = useState('')
  const [coachingSending, setCoachingSending] = useState(false)
  const [coachingInput, setCoachingInput] = useState('')
  const coachingListRef = useRef<HTMLDivElement | null>(null)

  // We need a ref to track the latest coachingSessionId inside SSE processors
  const coachingSessionIdRef = useRef<number | null>(null)
  // Similarly track coachingMessages for live mode history
  const coachingMessagesRef = useRef<CoachingMessageItem[]>([])

  // Keep refs in sync
  coachingSessionIdRef.current = coachingSessionId
  coachingMessagesRef.current = coachingMessages

  const scrollCoachingToBottom = useCallback(() => {
    if (coachingListRef.current) {
      coachingListRef.current.scrollTop = coachingListRef.current.scrollHeight
    }
  }, [])

  const processCoachingSSE = useCallback(async (resp: globalThis.Response) => {
    const reader = resp.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    let buffer = ''
    let streamedText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          continue
        }
        if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const data = JSON.parse(raw)
            if (data.session_id !== undefined) {
              // session_created
              setCoachingSessionId(data.session_id)
            } else if (data.content !== undefined && data.message_id === undefined) {
              // message_delta
              streamedText += data.content
              setCoachingStreaming(streamedText)
              setTimeout(scrollCoachingToBottom, 30)
            } else if (data.message_id !== undefined) {
              // message_complete
              const msg: CoachingMessageItem = {
                id: data.message_id,
                session_id: coachingSessionIdRef.current || 0,
                role: data.role,
                content: data.content,
                created_at: null,
              }
              setCoachingMessages((prev) => [...prev, msg])
              setCoachingStreaming('')
              streamedText = ''
              setTimeout(scrollCoachingToBottom, 50)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }, [scrollCoachingToBottom])

  const processLiveCoachingSSE = useCallback(async (resp: globalThis.Response) => {
    const reader = resp.body?.getReader()
    if (!reader) return
    const decoder = new TextDecoder()
    let buffer = ''
    let streamedText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) continue
        if (line.startsWith('data: ')) {
          const raw = line.slice(6)
          try {
            const data = JSON.parse(raw)
            if (data.content !== undefined && data.role === undefined) {
              // message_delta
              streamedText += data.content
              setCoachingStreaming(streamedText)
              setTimeout(scrollCoachingToBottom, 30)
            } else if (data.role !== undefined && data.content !== undefined) {
              // message_complete -- add to messages with a temp id
              const msg: CoachingMessageItem = {
                id: Date.now(),
                session_id: 0,
                role: data.role === 'assistant' ? 'coach' : data.role,
                content: data.content,
                created_at: null,
              }
              setCoachingMessages((prev) => [...prev, msg])
              setCoachingStreaming('')
              streamedText = ''
              setTimeout(scrollCoachingToBottom, 50)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }, [scrollCoachingToBottom])

  const handleStartCoaching = useCallback(async () => {
    if (!roomId) return
    setCoachingMode('review')
    setCoachingOpen(true)
    setCoachingMessages([])
    setCoachingStreaming('')
    setCoachingSessionId(null)
    setCoachingSending(true)

    try {
      // Get latest analysis report, or create one if none exists
      let reports = await listAnalysisReports(roomId)
      let reportId: number
      if (reports.length > 0) {
        reportId = reports[0].id
      } else {
        const created = await createAnalysisReport(roomId)
        reportId = created.id
      }

      const resp = await startCoachingStream(roomId, reportId)
      if (resp instanceof Response) {
        await processCoachingSSE(resp)
      }
    } catch (e) {
      console.error('Start coaching failed:', e)
    } finally {
      setCoachingSending(false)
    }
  }, [roomId, processCoachingSSE])

  const handleStartLiveCoaching = useCallback(async () => {
    if (!roomId) return
    setCoachingMode('live')
    setCoachingOpen(true)
    setCoachingMessages([])
    setCoachingStreaming('')
    setCoachingSessionId(null)
    setCoachingSending(true)

    try {
      const resp = await apiStartLiveCoaching(roomId)
      await processLiveCoachingSSE(resp)
    } catch (e) {
      console.error('Start live coaching failed:', e)
    } finally {
      setCoachingSending(false)
    }
  }, [roomId, processLiveCoachingSSE])

  const handleSendCoaching = useCallback(async () => {
    const content = coachingInput.trim()
    if (!content || !roomId || coachingSending) return
    // Review mode requires a session; live mode does not
    if (coachingMode === 'review' && !coachingSessionIdRef.current) return
    setCoachingInput('')
    setCoachingSending(true)

    // Add user message optimistically
    const tempMsg: CoachingMessageItem = {
      id: Date.now(),
      session_id: coachingSessionIdRef.current || 0,
      role: 'user',
      content,
      created_at: null,
    }
    setCoachingMessages((prev) => [...prev, tempMsg])
    setTimeout(scrollCoachingToBottom, 50)

    try {
      if (coachingMode === 'live') {
        // Build history from existing coaching messages for context
        const history = coachingMessagesRef.current
          .filter((m) => m.role === 'user' || m.role === 'coach')
          .map((m) => ({
            role: m.role === 'coach' ? 'assistant' : 'user',
            content: m.content,
          }))
        const resp = await sendLiveCoachingMessage(roomId, history, content)
        await processLiveCoachingSSE(resp)
      } else {
        const resp = await sendCoachingMessageStream(roomId, coachingSessionIdRef.current!, content)
        if (resp instanceof Response) {
          await processCoachingSSE(resp)
        }
      }
    } catch (e) {
      console.error('Send coaching message failed:', e)
    } finally {
      setCoachingSending(false)
    }
  }, [coachingInput, roomId, coachingSending, coachingMode, scrollCoachingToBottom, processCoachingSSE, processLiveCoachingSSE])

  return {
    coachingOpen,
    setCoachingOpen,
    coachingMode,
    coachingMessages,
    coachingStreaming,
    coachingSending,
    coachingInput,
    setCoachingInput,
    coachingSessionId,
    coachingListRef,
    handleStartCoaching,
    handleStartLiveCoaching,
    handleSendCoaching,
  }
}

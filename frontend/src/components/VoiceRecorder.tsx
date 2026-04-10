/**
 * VoiceRecorder — record audio with VAD, send via WebSocket.
 *
 * Supports two interaction modes:
 * 1. Click mode (default): click mic → VAD listens → auto-starts/stops recording
 * 2. Hold mode: press-and-hold mic → records while held → release to send
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Loader2, Square } from 'lucide-react'
import './VoiceRecorder.css'

type RecordState = 'idle' | 'listening' | 'recording' | 'processing'

interface VoiceRecorderProps {
  roomId: number
  disabled?: boolean
  onTranscription?: (text: string) => void
}

const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
const API_PREFIX = '/api/v1/stakeholder'

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ roomId, disabled, onTranscription }) => {
  const [state, setState] = useState<RecordState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number>(0)
  const holdModeRef = useRef(false)
  const startingRef = useRef(false)
  const pendingSendsRef = useRef(0)
  const chunksRef = useRef<Blob[]>([])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything()
    }
  }, [])

  // Cleanup on room change
  useEffect(() => {
    stopEverything()
    setState('idle')
  }, [roomId])

  const stopEverything = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = 0
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close()
    }
    wsRef.current = null
    chunksRef.current = []
    setDuration(0)
  }, [])

  const connectWebSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}${API_PREFIX}/rooms/${roomId}/voice`)
      ws.onopen = () => resolve(ws)
      ws.onerror = () => reject(new Error('WebSocket connection failed'))
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'transcription' && msg.is_final && msg.text) {
            onTranscription?.(msg.text)
            // Transcription received — close WS and reset state
            setState('idle')
            setDuration(0)
            if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
              wsRef.current.close()
            }
          } else if (msg.type === 'error') {
            setError(msg.message || '语音识别失败')
            setTimeout(() => setError(null), 3000)
            setState('idle')
            setDuration(0)
          }
        } catch {
          // ignore parse errors
        }
      }
      wsRef.current = ws
    })
  }, [roomId, onTranscription])

  const startRecording = useCallback(async () => {
    // Prevent double-trigger from pointerDown + click both firing
    if (startingRef.current) return
    startingRef.current = true
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ws = await connectWebSocket()

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      let chunksSentCount = 0

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          pendingSendsRef.current++
          const reader = new FileReader()
          reader.onloadend = () => {
            if (ws.readyState === WebSocket.OPEN && reader.result) {
              const base64 = (reader.result as string).split(',')[1]
              if (base64) {
                ws.send(JSON.stringify({ type: 'audio_chunk', data: base64 }))
                chunksSentCount++
              }
            }
            pendingSendsRef.current--
          }
          reader.readAsDataURL(e.data)
        }
      }

      recorder.onstop = () => {
        // Wait for all pending audio chunks to be sent before sending speech_end
        const flushAndEnd = () => {
          if (pendingSendsRef.current > 0) {
            setTimeout(flushAndEnd, 50)
            return
          }
          if (chunksSentCount === 0) {
            // No audio data was actually sent — don't send speech_end
            setError('未录到音频数据，请重试')
            setTimeout(() => setError(null), 3000)
            setState('idle')
            setDuration(0)
            if (ws.readyState === WebSocket.OPEN) ws.close()
            return
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'speech_end', format: 'webm' }))
          }
          setState('processing')
          // Auto-close WS after a delay to receive transcription
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
              wsRef.current.close()
            }
            setState('idle')
            setDuration(0)
          }, 10000) // 10s timeout for transcription
        }
        flushAndEnd()
      }

      recorder.start(500) // 500ms chunks
      setState('recording')
      setDuration(0)
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Failed to start recording:', err)
      stopEverything()
      setState('idle')
      // Show user-visible error
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('请允许麦克风权限')
      } else if (err?.name === 'NotFoundError') {
        setError('未检测到麦克风')
      } else if (err?.message?.includes('WebSocket')) {
        setError('语音服务连接失败')
      } else {
        setError('录音启动失败')
      }
      setTimeout(() => setError(null), 3000)
    } finally {
      startingRef.current = false
    }
  }, [connectWebSocket, stopEverything])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = 0
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Click mode: toggle recording
  const handleClick = useCallback(() => {
    if (disabled) return
    if (holdModeRef.current) return // Don't interfere with hold mode

    if (state === 'idle') {
      startRecording()
    } else if (state === 'recording') {
      stopRecording()
    }
  }, [state, disabled, startRecording, stopRecording])

  // Hold mode: press to start, release to stop
  const handlePointerDown = useCallback(() => {
    if (disabled || state !== 'idle') return
    holdModeRef.current = true
    startRecording()
  }, [disabled, state, startRecording])

  const handlePointerUp = useCallback(() => {
    if (!holdModeRef.current) return
    holdModeRef.current = false
    if (state === 'recording') {
      stopRecording()
    }
  }, [state, stopRecording])

  const formatDuration = (s: number): string => {
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="voice-recorder">
      {error && (
        <span className="voice-error">{error}</span>
      )}
      {state === 'recording' && (
        <span className="voice-duration">{formatDuration(duration)}</span>
      )}
      {state === 'processing' && (
        <span className="voice-status">识别中...</span>
      )}
      <button
        className={`voice-btn ${state}`}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={disabled || state === 'processing'}
        title={state === 'idle' ? '点击录音 / 长按说话' : state === 'recording' ? '点击停止' : '识别中...'}
      >
        {state === 'idle' && <Mic size={18} />}
        {state === 'listening' && <Mic size={18} />}
        {state === 'recording' && <Square size={14} />}
        {state === 'processing' && <Loader2 size={18} className="spin" />}
      </button>
    </div>
  )
}

export default VoiceRecorder

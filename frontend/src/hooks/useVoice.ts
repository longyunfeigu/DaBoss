import { useEffect, useRef, useState, useCallback } from 'react'
import { AudioPlayQueue } from '../services/audioPlayer'

export interface UseVoiceReturn {
  voiceEnabled: boolean
  voiceMuted: boolean
  playingPersonaId: string | null
  audioPlayerRef: React.RefObject<AudioPlayQueue | null>
  toggleVoice: () => void
}

export function useVoice(): UseVoiceReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [playingPersonaId, setPlayingPersonaId] = useState<string | null>(null)
  const audioPlayerRef = useRef<AudioPlayQueue | null>(null)

  // Initialize audio player
  useEffect(() => {
    const player = new AudioPlayQueue({
      onPlayingChange: (_playing, personaId) => {
        setPlayingPersonaId(personaId)
      },
    })
    audioPlayerRef.current = player
    return () => {
      player.destroy()
      audioPlayerRef.current = null
    }
  }, [])

  const toggleVoice = useCallback(() => {
    if (!voiceEnabled) {
      setVoiceEnabled(true)
      setVoiceMuted(false)
      audioPlayerRef.current?.setMuted(false)
    } else if (!voiceMuted) {
      setVoiceMuted(true)
      audioPlayerRef.current?.setMuted(true)
    } else {
      setVoiceEnabled(false)
      setVoiceMuted(false)
      audioPlayerRef.current?.setMuted(true)
    }
  }, [voiceEnabled, voiceMuted])

  return {
    voiceEnabled,
    voiceMuted,
    playingPersonaId,
    audioPlayerRef,
    toggleVoice,
  }
}

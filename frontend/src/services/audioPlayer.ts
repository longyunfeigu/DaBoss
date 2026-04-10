/**
 * AudioPlayQueue — plays audio chunks sequentially.
 *
 * Receives base64-encoded mp3 chunks from SSE audio_chunk events,
 * decodes them, and plays one after another using Web Audio API.
 * Deduplicates by (reply_id, sentence_index) to prevent double playback.
 */

type QueueItem = {
  personaId: string
  data: ArrayBuffer
}

export class AudioPlayQueue {
  private queue: QueueItem[] = []
  private playing = false
  private muted = false
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private onPlayingChange?: (playing: boolean, personaId: string | null) => void
  /** Track seen (reply_id:sentence_index) keys to prevent duplicate playback. */
  private seenChunks = new Set<string>()

  constructor(opts?: { onPlayingChange?: (playing: boolean, personaId: string | null) => void }) {
    this.onPlayingChange = opts?.onPlayingChange
  }

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (muted) {
      this.stop()
    }
  }

  isMuted(): boolean {
    return this.muted
  }

  enqueue(personaId: string, base64Data: string, replyId?: string, sentenceIndex?: number): void {
    if (this.muted || !base64Data) return

    // Deduplicate: skip if we've already enqueued this exact chunk
    if (replyId) {
      const key = `${replyId}:${sentenceIndex ?? 0}`
      if (this.seenChunks.has(key)) return
      this.seenChunks.add(key)
    }

    try {
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      this.queue.push({ personaId, data: bytes.buffer })
      if (!this.playing) {
        this.playNext()
      }
    } catch {
      // Silently ignore decode errors
    }
  }

  stop(): void {
    this.queue = []
    this.seenChunks.clear()
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // Already stopped
      }
      this.currentSource = null
    }
    this.playing = false
    this.onPlayingChange?.(false, null)
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.playing = false
      this.onPlayingChange?.(false, null)
      return
    }

    this.playing = true
    const item = this.queue.shift()!
    this.onPlayingChange?.(true, item.personaId)

    try {
      const ctx = this.getContext()
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      const audioBuffer = await ctx.decodeAudioData(item.data.slice(0))
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      this.currentSource = source

      await new Promise<void>((resolve) => {
        source.onended = () => {
          this.currentSource = null
          resolve()
        }
        source.start(0)
      })
    } catch {
      // Skip unplayable chunks
      this.currentSource = null
    }

    this.playNext()
  }

  destroy(): void {
    this.stop()
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
  }
}

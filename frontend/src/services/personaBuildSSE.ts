// input: PersonaBuildRequest, AbortSignal (from caller)
// output: streams BuildEvent via onEvent callback; resolves when stream ends, rejects on HTTP error
// owner: wanhua.gu
// pos: 表示层 - SSE 客户端封装 (POST /api/v1/stakeholder/persona/build → ReadableStream → BuildEvent)；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
import type { BuildEvent, PersonaBuildRequest } from './api'

const ENDPOINT = '/api/v1/stakeholder/persona/build'

interface HttpError extends Error {
  status: number
  code?: string
}

/**
 * Open a POST SSE connection and stream BuildEvent objects via onEvent callback.
 *
 * Uses fetch + ReadableStream because EventSource only supports GET. The endpoint
 * needs a JSON body (materials array + optional name/role).
 *
 * @throws HttpError on non-2xx HTTP status (with .code from `detail.code` if present)
 * @throws AbortError when signal is aborted
 */
export async function startPersonaBuild(
  req: PersonaBuildRequest,
  onEvent: (ev: BuildEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(req),
    signal,
  })

  if (!resp.ok) {
    let code: string | undefined
    let message = `HTTP ${resp.status}`
    try {
      const body = await resp.json()
      code = body?.detail?.code || body?.error?.code
      message =
        body?.detail?.message ||
        body?.error?.details ||
        body?.message ||
        message
    } catch {
      /* ignore parse errors */
    }
    const err = new Error(message) as HttpError
    err.status = resp.status
    err.code = code
    throw err
  }

  if (!resp.body) {
    throw new Error('Response has no body')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    // Read until stream ends (server closes after persist_done) or AbortError
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE frames separated by blank line (\n\n); each frame may contain
      // multiple data: lines that should be concatenated with newline.
      let sepIdx: number
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)
        const dataLines = frame
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
        if (dataLines.length === 0) continue
        const payload = dataLines.join('\n')
        try {
          const ev = JSON.parse(payload) as BuildEvent
          onEvent(ev)
        } catch (e) {
          console.warn('Failed to parse SSE frame', payload, e)
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* noop */
    }
  }
}

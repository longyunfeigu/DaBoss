import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { type CheatSheet } from '../services/api'
import './CheatSheet.css'

interface Props {
  open: boolean
  onClose: () => void
  data: CheatSheet | null
  personaName: string
}

export default function CheatSheetDialog({ open, onClose, data, personaName }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  if (!open || !data) return null

  const handleCopy = () => {
    const lines: string[] = []
    lines.push(`话术纸条 — 与${personaName}的对话`)
    lines.push('')
    lines.push('【开场白】')
    lines.push(data.opening)
    lines.push('')
    lines.push('【关键话术】')
    data.key_tactics.forEach((t) => {
      lines.push(`当对方：${t.situation}`)
      lines.push(`→ 你应该：${t.response}`)
    })
    lines.push('')
    lines.push('【避坑提醒】')
    data.pitfalls.forEach((p) => {
      lines.push(`✗ ${p}`)
    })
    lines.push('')
    lines.push('【底线策略】')
    lines.push(data.bottom_line)

    navigator.clipboard.writeText(lines.join('\n')).catch(() => {
      // silently ignore clipboard errors
    })
  }

  const handleDownload = async () => {
    const el = cardRef.current
    if (!el) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' })
      const link = document.createElement('a')
      link.download = '话术纸条.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="cs-overlay" onClick={onClose}>
      <div className="cs-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Card area captured by html2canvas */}
        <div className="cs-card" ref={cardRef}>
          {/* Header */}
          <div className="cs-header">
            <div className="cs-header-left">
              <h2 className="cs-title">话术纸条</h2>
              {personaName && (
                <span className="cs-persona-badge">{personaName}</span>
              )}
            </div>
            <button className="cs-close-btn" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>

          {/* Opening */}
          <div className="cs-section-opening">
            <p className="cs-section-title">💬 开场白</p>
            <div className="cs-opening-box">{data.opening}</div>
          </div>

          {/* Key tactics */}
          <div className="cs-section-tactics">
            <p className="cs-section-title">⚡ 关键话术</p>
            <div className="cs-tactic-list">
              {data.key_tactics.map((tactic, i) => (
                <div key={i} className="cs-tactic-item">
                  <span className="cs-tactic-situation">当对方：{tactic.situation}</span>
                  <span className="cs-tactic-response">
                    <span className="cs-tactic-arrow">→</span> {tactic.response}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pitfalls */}
          <div className="cs-section-pitfalls">
            <p className="cs-section-title">⚠️ 避坑提醒</p>
            <div className="cs-pitfall-list">
              {data.pitfalls.map((pitfall, i) => (
                <div key={i} className="cs-pitfall-item">✗ {pitfall}</div>
              ))}
            </div>
          </div>

          {/* Bottom line */}
          <div className="cs-section-bottomline">
            <p className="cs-section-title">🛡️ 底线策略</p>
            <div className="cs-bottomline-box">{data.bottom_line}</div>
          </div>
        </div>

        {/* Footer buttons — outside cardRef, not captured in PNG */}
        <div className="cs-footer">
          <button className="cs-btn-copy" onClick={handleCopy}>
            复制全文
          </button>
          <button className="cs-btn-download" onClick={handleDownload} disabled={downloading}>
            {downloading ? '生成中...' : '下载图片'}
          </button>
        </div>
      </div>
    </div>
  )
}

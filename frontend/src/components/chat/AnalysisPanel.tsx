import { X } from 'lucide-react'
import type { AnalysisReport, AnalysisReportSummary } from '../../services/api'
import './AnalysisPanel.css'

export interface AnalysisPanelProps {
  result: AnalysisReport
  reportList: AnalysisReportSummary[]
  analyzingRoom: boolean
  onClose: () => void
  onSelectReport: (reportId: number) => void
  onGenerateNewReport: () => void
  onScrollToMessage: (
    messageIndices: number[] | undefined,
    messageIdMap: Record<string, number> | undefined,
  ) => void
}

export default function AnalysisPanel({
  result,
  reportList,
  analyzingRoom,
  onClose,
  onSelectReport,
  onGenerateNewReport,
  onScrollToMessage,
}: AnalysisPanelProps) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog analysis-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="analysis-header">
          <h3>对话分析报告</h3>
          <button className="analysis-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Historical report selector */}
        {reportList.length > 1 && (
          <div className="analysis-report-selector">
            <select
              value={result.id}
              onChange={(e) => onSelectReport(Number(e.target.value))}
            >
              {reportList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : `报告 #${r.id}`}
                </option>
              ))}
            </select>
            <button
              className="analysis-new-btn"
              onClick={onGenerateNewReport}
              disabled={analyzingRoom}
            >
              {analyzingRoom ? '生成中...' : '+ 新报告'}
            </button>
          </div>
        )}
        {reportList.length <= 1 && (
          <div className="analysis-report-selector">
            <span className="analysis-report-date">
              {result.created_at ? new Date(result.created_at).toLocaleString() : ''}
            </span>
            <button
              className="analysis-new-btn"
              onClick={onGenerateNewReport}
              disabled={analyzingRoom}
            >
              {analyzingRoom ? '生成中...' : '重新分析'}
            </button>
          </div>
        )}

        <p className="analysis-summary">{result.summary}</p>

        {/* Resistance ranking cards */}
        {result.content.resistance_ranking.length > 0 && (
          <div className="analysis-section">
            <h4>阻力排名</h4>
            <div className="analysis-cards">
              {result.content.resistance_ranking.map((item, i) => {
                const hasLinks = item.message_indices && item.message_indices.length > 0 && result.content.message_id_map
                return (
                  <div
                    key={i}
                    className={`analysis-card${hasLinks ? ' clickable' : ''}`}
                    onClick={() => hasLinks && onScrollToMessage(item.message_indices, result.content.message_id_map)}
                  >
                    <div className="analysis-card-header">
                      <span className="analysis-card-name">{item.persona_name}</span>
                      <span className={`analysis-card-score ${item.score >= 0 ? 'positive' : 'negative'}`}>
                        {item.score > 0 ? '+' : ''}{item.score}
                      </span>
                    </div>
                    <div className="analysis-card-body">{item.reason}</div>
                    {hasLinks && (
                      <div className="analysis-card-link">点击查看对话原文 →</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Effective arguments cards */}
        {result.content.effective_arguments.length > 0 && (
          <div className="analysis-section">
            <h4>有效论点</h4>
            <div className="analysis-cards">
              {result.content.effective_arguments.map((item, i) => {
                const hasLinks = item.message_indices && item.message_indices.length > 0 && result.content.message_id_map
                return (
                  <div
                    key={i}
                    className={`analysis-card argument${hasLinks ? ' clickable' : ''}`}
                    onClick={() => hasLinks && onScrollToMessage(item.message_indices, result.content.message_id_map)}
                  >
                    <div className="analysis-card-header">
                      <span className="analysis-card-argument">{item.argument}</span>
                      <span className="analysis-card-target">→ {item.target_persona}</span>
                    </div>
                    <div className="analysis-card-body">{item.effectiveness}</div>
                    {hasLinks && (
                      <div className="analysis-card-link">点击查看对话原文 →</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Communication suggestions */}
        {result.content.communication_suggestions.length > 0 && (
          <div className="analysis-section">
            <h4>沟通建议</h4>
            <div className="analysis-cards">
              {result.content.communication_suggestions.map((item, i) => (
                <div key={i} className="analysis-card suggestion">
                  <div className="analysis-card-header">
                    <span className="analysis-card-name">{item.persona_name}</span>
                    <span className={`suggestion-priority ${item.priority}`}>{item.priority}</span>
                  </div>
                  <div className="analysis-card-body">{item.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

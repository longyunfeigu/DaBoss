import { useState, useCallback } from 'react'
import {
  listAnalysisReports,
  createAnalysisReport,
  fetchAnalysisReport,
  type AnalysisReport,
  type AnalysisReportSummary,
} from '../services/api'

export interface UseAnalysisReturn {
  analysisResult: AnalysisReport | null
  setAnalysisResult: React.Dispatch<React.SetStateAction<AnalysisReport | null>>
  analysisReportList: AnalysisReportSummary[]
  analyzingRoom: boolean
  highlightedMessageId: number | null
  setHighlightedMessageId: React.Dispatch<React.SetStateAction<number | null>>
  handleAnalyze: () => Promise<void>
  handleGenerateNewReport: () => Promise<void>
  handleSelectReport: (reportId: number) => Promise<void>
  handleScrollToMessage: (messageIndices: number[] | undefined, messageIdMap: Record<string, number> | undefined) => void
}

export function useAnalysis(roomId: number | null): UseAnalysisReturn {
  const [analysisResult, setAnalysisResult] = useState<AnalysisReport | null>(null)
  const [analyzingRoom, setAnalyzingRoom] = useState(false)
  const [analysisReportList, setAnalysisReportList] = useState<AnalysisReportSummary[]>([])
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!roomId || analyzingRoom) return
    setAnalyzingRoom(true)
    setAnalysisResult(null)
    try {
      // Load existing reports list
      const reports = await listAnalysisReports(roomId)
      setAnalysisReportList(reports)

      if (reports.length > 0) {
        // Show latest existing report (API returns newest first)
        const latest = reports[0]
        const full = await fetchAnalysisReport(roomId, latest.id)
        setAnalysisResult(full)
      } else {
        // No reports yet, generate a new one
        const report = await createAnalysisReport(roomId)
        setAnalysisResult(report)
        setAnalysisReportList([{ id: report.id, room_id: report.room_id, summary: report.summary, created_at: report.created_at }])
      }
    } catch (e: any) {
      const msg = e?.message || '分析失败'
      if (msg.includes('No messages') || msg.includes('NoMessages')) {
        alert('暂无消息可分析，请先发送消息后再试')
      } else {
        alert(msg)
      }
    } finally {
      setAnalyzingRoom(false)
    }
  }, [roomId, analyzingRoom])

  const handleGenerateNewReport = useCallback(async () => {
    if (!roomId || analyzingRoom) return
    setAnalyzingRoom(true)
    try {
      const report = await createAnalysisReport(roomId)
      setAnalysisResult(report)
      // Refresh list
      const reports = await listAnalysisReports(roomId)
      setAnalysisReportList(reports)
    } catch (e: any) {
      alert(e?.message || '生成失败')
    } finally {
      setAnalyzingRoom(false)
    }
  }, [roomId, analyzingRoom])

  const handleSelectReport = useCallback(async (reportId: number) => {
    if (!roomId) return
    try {
      const full = await fetchAnalysisReport(roomId, reportId)
      setAnalysisResult(full)
    } catch {
      alert('加载报告失败')
    }
  }, [roomId])

  const handleScrollToMessage = useCallback((messageIndices: number[] | undefined, messageIdMap: Record<string, number> | undefined) => {
    if (!messageIndices?.length || !messageIdMap) return
    // Find the first valid message ID
    for (const idx of messageIndices) {
      const msgId = messageIdMap[String(idx)]
      if (msgId == null) continue
      // Close dialog
      setAnalysisResult(null)
      // Scroll to message after dialog closes
      setTimeout(() => {
        const el = document.getElementById(`msg-${msgId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setHighlightedMessageId(msgId)
          setTimeout(() => setHighlightedMessageId(null), 2500)
        }
      }, 100)
      return
    }
  }, [])

  return {
    analysisResult,
    setAnalysisResult,
    analysisReportList,
    analyzingRoom,
    highlightedMessageId,
    setHighlightedMessageId,
    handleAnalyze,
    handleGenerateNewReport,
    handleSelectReport,
    handleScrollToMessage,
  }
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Zap, ArrowLeft } from 'lucide-react'
import { generateBattlePrep, startBattle, type BattlePrepResult } from '../services/api'
import './BattlePrepPage.css'

type Difficulty = 'easy' | 'normal' | 'hard'

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: '轻松', desc: '温和沟通' },
  { value: 'normal', label: '普通', desc: '正常压力' },
  { value: 'hard', label: '困难', desc: '强硬对抗' },
]

function initialState() {
  return {
    step: 1 as 1 | 2 | 3,
    description: '',
    loading: false,
    error: null as string | null,
    prepResult: null as BattlePrepResult | null,
    personaName: '',
    personaRole: '',
    personaStyle: '',
    difficulty: 'normal' as Difficulty,
    selectedPoints: [] as string[],
    submitting: false,
  }
}

export default function BattlePrepPage() {
  const navigate = useNavigate()
  const [state, setState] = useState(initialState)

  const {
    step,
    description,
    loading,
    error,
    prepResult,
    personaName,
    personaRole,
    personaStyle,
    difficulty,
    selectedPoints,
    submitting,
  } = state

  // ---- Step 1: generate persona ----
  const handleGenerate = async () => {
    if (description.trim().length < 10) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const result = await generateBattlePrep(description.trim())
      setState((s) => ({
        ...s,
        loading: false,
        prepResult: result,
        personaName: result.persona_name,
        personaRole: result.persona_role,
        personaStyle: result.persona_style,
        selectedPoints: [...result.training_points],
        step: 2,
      }))
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e.message || '生成失败，请重试' }))
    }
  }

  // ---- Step 2 -> Step 3: start battle and navigate ----
  const handleStartBattle = async () => {
    if (selectedPoints.length === 0 || !prepResult) return
    setState((s) => ({ ...s, submitting: true, error: null }))
    try {
      const room = await startBattle({
        persona_name: personaName,
        persona_role: personaRole,
        persona_style: personaStyle,
        scenario_context: prepResult.scenario_context,
        selected_training_points: selectedPoints,
        difficulty,
      })
      navigate(`/chat/${room.id}`)
    } catch (e: any) {
      setState((s) => ({ ...s, submitting: false, error: e.message || '启动失败，请重试' }))
    }
  }

  const togglePoint = (point: string) => {
    setState((s) => ({
      ...s,
      selectedPoints: s.selectedPoints.includes(point)
        ? s.selectedPoints.filter((p) => p !== point)
        : [...s.selectedPoints, point],
    }))
  }

  const personaInitial = personaName ? personaName.charAt(0).toUpperCase() : '?'

  return (
    <div className="bpp-page">
      <div className="bpp-container">
        {/* Back link */}
        <button className="bpp-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
          <span>返回首页</span>
        </button>

        {/* Title */}
        <div className="bpp-title-row">
          <Zap size={22} className="bpp-title-icon" />
          <h1 className="bpp-title">紧急备战</h1>
        </div>

        {/* Step indicator */}
        <div className="bpp-steps">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bpp-step-item">
              <div className={`bpp-step-dot ${step === n ? 'active' : step > n ? 'done' : ''}`}>
                {n}
              </div>
              <span className={`bpp-step-label ${step === n ? 'active' : ''}`}>
                {n === 1 ? '描述会议' : n === 2 ? '预览对手' : '开始练习'}
              </span>
              {n < 3 && <div className={`bpp-step-line ${step > n ? 'done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* ---- Step 1: Describe Meeting ---- */}
        {step === 1 && (
          <div className="bpp-card">
            <p className="bpp-hint">
              详细描述你即将参加的会议，AI 将为你生成专属对手角色并制定训练计划。
            </p>

            <textarea
              className="bpp-textarea"
              value={description}
              onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
              placeholder="描述你即将参加的会议：跟谁谈、谈什么、你的目标是什么、对方可能的态度..."
              rows={6}
              disabled={loading}
            />

            {/* Difficulty selector */}
            <div className="bpp-difficulty-section">
              <div className="bpp-section-label">对手难度</div>
              <div className="bpp-difficulty-cards">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`bpp-difficulty-card ${difficulty === opt.value ? 'selected' : ''}`}
                    onClick={() => setState((s) => ({ ...s, difficulty: opt.value }))}
                    type="button"
                  >
                    <span className="bpp-diff-label">{opt.label}</span>
                    <span className="bpp-diff-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="bpp-error">{error}</div>}

            <div className="bpp-actions">
              <button
                className="bpp-btn-primary"
                onClick={handleGenerate}
                disabled={description.trim().length < 10 || loading}
              >
                {loading ? (
                  <span className="bpp-loading-inline">
                    <Loader2 size={16} className="bpp-spinner" />
                    AI 正在分析...
                  </span>
                ) : (
                  '生成对手 \u2192'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---- Step 2: Review Opponent ---- */}
        {step === 2 && prepResult && (
          <div className="bpp-card">
            <p className="bpp-hint">AI 已生成对手角色，你可以在此微调，然后选择训练点。</p>

            {/* Persona preview */}
            <div className="bpp-persona-preview">
              <div className="bpp-persona-avatar">{personaInitial}</div>
              <div className="bpp-persona-meta">
                <span className="bpp-persona-name-display">{personaName || '未命名'}</span>
                <span className="bpp-persona-role-display">{personaRole || '未知角色'}</span>
              </div>
            </div>

            {/* Editable fields */}
            <div className="bpp-fields">
              <label className="bpp-field">
                <span className="bpp-field-label">角色名称</span>
                <input
                  type="text"
                  className="bpp-input"
                  value={personaName}
                  onChange={(e) => setState((s) => ({ ...s, personaName: e.target.value }))}
                />
              </label>
              <label className="bpp-field">
                <span className="bpp-field-label">职位 / 角色</span>
                <input
                  type="text"
                  className="bpp-input"
                  value={personaRole}
                  onChange={(e) => setState((s) => ({ ...s, personaRole: e.target.value }))}
                />
              </label>
              <label className="bpp-field">
                <span className="bpp-field-label">谈判风格</span>
                <textarea
                  className="bpp-textarea bpp-textarea--sm"
                  value={personaStyle}
                  onChange={(e) => setState((s) => ({ ...s, personaStyle: e.target.value }))}
                  rows={3}
                />
              </label>
            </div>

            {/* Training points */}
            <div className="bpp-section-label">训练点（至少选 1 个）</div>
            <div className="bpp-training-list">
              {prepResult.training_points.map((point) => (
                <label key={point} className={`bpp-training-item ${selectedPoints.includes(point) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedPoints.includes(point)}
                    onChange={() => togglePoint(point)}
                  />
                  <span>{point}</span>
                </label>
              ))}
            </div>

            {error && <div className="bpp-error">{error}</div>}

            <div className="bpp-actions bpp-actions--split">
              <button
                className="bpp-btn-secondary"
                onClick={() => setState((s) => ({ ...s, step: 1, error: null }))}
              >
                <ArrowLeft size={14} />
                上一步
              </button>
              <button
                className="bpp-btn-primary"
                onClick={handleStartBattle}
                disabled={
                  !personaName.trim() ||
                  !personaRole.trim() ||
                  selectedPoints.length === 0 ||
                  submitting
                }
              >
                {submitting ? (
                  <span className="bpp-loading-inline">
                    <Loader2 size={16} className="bpp-spinner" />
                    启动中...
                  </span>
                ) : (
                  '开始练习 \u2192'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

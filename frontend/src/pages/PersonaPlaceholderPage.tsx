// input: route param :id
// output: 极简占位页 — Story 2.7 替换为真编辑器
// owner: wanhua.gu
// pos: 表示层 - persona 编辑器占位页 (Story 2.6 跳转目标 / Story 2.7 接管)；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, Settings as SettingsIcon } from 'lucide-react'

export default function PersonaPlaceholderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <CheckCircle2 size={56} color="var(--green)" />
      <h1 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>
        画像 <code>{id}</code> 已生成
      </h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14, maxWidth: 420 }}>
        编辑器（5-layer 结构 + 证据链）正在 Story 2.7 中开发。当前可去 Settings 查看。
      </p>
      <button
        onClick={() => navigate('/settings')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 18px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: 'var(--primary-gradient)',
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <SettingsIcon size={14} />
        去 Settings 查看
      </button>
    </div>
  )
}

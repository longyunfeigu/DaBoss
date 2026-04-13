// input: title, emoji, color, count, children
// output: 5-layer 卡片容器 (header emoji 圈 + 标题 + count + 子特征行)
// owner: wanhua.gu
// pos: 表示层 - persona editor layer card 容器；一旦我被更新，务必更新我的开头注释以及所属文件夹的md
import type { ReactNode } from 'react'

export type LayerColor = 'rose' | 'violet' | 'green' | 'amber'

interface Props {
  title: string
  emoji: string
  color: LayerColor
  count: number
  countLabel?: string
  children: ReactNode
}

export default function LayerCard({
  title,
  emoji,
  color,
  count,
  countLabel,
  children,
}: Props) {
  return (
    <section className="layer layer-card">
      <header className="layer-head">
        <div className={`layer-icon ${color}`}>{emoji}</div>
        <h2 className="layer-title">{title}</h2>
        <span className="layer-count">
          {count} {countLabel || '条'}
        </span>
      </header>
      <div className="layer-body">{children}</div>
    </section>
  )
}

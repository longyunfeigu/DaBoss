import React, { useRef, useEffect, useMemo } from 'react'
import {
  Search,
  Swords,
  Plus,
  TrendingUp,
  MessageSquare,
  User,
} from 'lucide-react'
import type { CommandResult } from '../../hooks/useCommandPalette'
import './CommandPalette.css'

interface CommandPaletteProps {
  isOpen: boolean
  query: string
  results: CommandResult[]
  selectedIndex: number
  onClose: () => void
  onQueryChange: (q: string) => void
}

const iconMap: Record<string, React.ReactNode> = {
  Swords: <Swords size={16} />,
  Plus: <Plus size={16} />,
  TrendingUp: <TrendingUp size={16} />,
  MessageSquare: <MessageSquare size={16} />,
  User: <User size={16} />,
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  query,
  results,
  selectedIndex,
  onClose,
  onQueryChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the element is in the DOM
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('.cmd-palette-item.selected')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Group results by type
  const grouped = useMemo(() => {
    const rooms = results.filter((r) => r.type === 'room')
    const actions = results.filter((r) => r.type === 'action')
    const personas = results.filter((r) => r.type === 'persona')
    return { rooms, actions, personas }
  }, [results])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Track global index for selectedIndex highlighting
  let globalIdx = 0

  const renderItem = (item: CommandResult) => {
    const idx = globalIdx++
    return (
      <div
        key={item.id}
        className={`cmd-palette-item${idx === selectedIndex ? ' selected' : ''}`}
        onClick={() => item.onSelect()}
        onMouseEnter={() => {
          // We don't set selectedIndex on hover to keep keyboard nav consistent,
          // but clicking still works.
        }}
      >
        <div className="cmd-palette-item-icon">
          {item.icon ? iconMap[item.icon] || <Search size={16} /> : <Search size={16} />}
        </div>
        <div className="cmd-palette-item-text">
          <div className="cmd-palette-item-name">{item.label}</div>
          {item.description && (
            <div className="cmd-palette-item-desc">{item.description}</div>
          )}
        </div>
        {item.shortcut && (
          <span className="cmd-palette-shortcut">{item.shortcut}</span>
        )}
      </div>
    )
  }

  const hasResults = results.length > 0

  return (
    <div className="cmd-palette-backdrop" onClick={handleBackdropClick}>
      <div className="cmd-palette-panel">
        {/* Search input */}
        <div className="cmd-palette-search">
          <div className="cmd-palette-search-icon">
            <Search size={18} />
          </div>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            type="text"
            placeholder="搜索或输入命令..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className="cmd-palette-results" ref={listRef}>
          {hasResults ? (
            <>
              {grouped.rooms.length > 0 && (
                <>
                  <div className="cmd-palette-section-label">对话</div>
                  {grouped.rooms.map(renderItem)}
                </>
              )}
              {grouped.actions.length > 0 && (
                <>
                  <div className="cmd-palette-section-label">操作</div>
                  {grouped.actions.map(renderItem)}
                </>
              )}
              {grouped.personas.length > 0 && (
                <>
                  <div className="cmd-palette-section-label">角色</div>
                  {grouped.personas.map(renderItem)}
                </>
              )}
            </>
          ) : (
            <div className="cmd-palette-empty">没有找到匹配结果</div>
          )}
        </div>

        {/* Footer */}
        <div className="cmd-palette-footer">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>↵</kbd> 打开</span>
          <span><kbd>esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette

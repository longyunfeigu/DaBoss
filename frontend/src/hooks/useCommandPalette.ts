import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatRoom, PersonaSummary } from '../services/api'

export interface CommandResult {
  id: string
  type: 'room' | 'action' | 'persona'
  label: string
  description?: string
  icon?: string
  shortcut?: string
  onSelect: () => void
}

export interface UseCommandPaletteReturn {
  isOpen: boolean
  query: string
  results: CommandResult[]
  selectedIndex: number
  open: () => void
  close: () => void
  setQuery: (q: string) => void
}

export function useCommandPalette(
  rooms: ChatRoom[],
  personaMap: Record<string, PersonaSummary>,
): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()

  const open = useCallback(() => {
    setIsOpen(true)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  // Static action items
  const actions: CommandResult[] = useMemo(
    () => [
      {
        id: 'action-battle-prep',
        type: 'action' as const,
        label: '紧急备战',
        icon: 'Swords',
        shortcut: '\u2318B',
        onSelect: () => {
          close()
          navigate('/battle-prep')
        },
      },
      {
        id: 'action-new-chat',
        type: 'action' as const,
        label: '新建对话',
        icon: 'Plus',
        shortcut: '\u2318\u21E7N',
        onSelect: () => {
          close()
          navigate('/chat')
        },
      },
      {
        id: 'action-growth',
        type: 'action' as const,
        label: '成长报告',
        icon: 'TrendingUp',
        shortcut: '\u2318G',
        onSelect: () => {
          close()
          navigate('/growth')
        },
      },
    ],
    [close, navigate],
  )

  // Build search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items: CommandResult[] = []

    // Filter rooms
    const matchingRooms = q
      ? rooms.filter((r) => r.name.toLowerCase().includes(q))
      : rooms

    for (const room of matchingRooms.slice(0, 5)) {
      items.push({
        id: `room-${room.id}`,
        type: 'room',
        label: room.name,
        description: room.type === 'battle_prep' ? '备战' : room.type === 'group' ? '群组' : '私聊',
        icon: 'MessageSquare',
        onSelect: () => {
          close()
          navigate(`/chat/${room.id}`)
        },
      })
    }

    // Filter actions
    const matchingActions = q
      ? actions.filter((a) => a.label.toLowerCase().includes(q))
      : actions

    items.push(...matchingActions)

    // Filter personas
    const personas = Object.values(personaMap)
    const matchingPersonas = q
      ? personas.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
      : personas

    for (const p of matchingPersonas.slice(0, 5)) {
      items.push({
        id: `persona-${p.id}`,
        type: 'persona',
        label: p.name,
        description: p.role,
        icon: 'User',
        onSelect: () => {
          close()
          navigate('/settings')
        },
      })
    }

    return items
  }, [query, rooms, personaMap, actions, close, navigate])

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length, query])

  // Global keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+K / Ctrl+K -> toggle
      if (meta && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => {
          if (prev) {
            setQuery('')
            setSelectedIndex(0)
            return false
          }
          setQuery('')
          setSelectedIndex(0)
          return true
        })
        return
      }

      // Global shortcuts (only when palette is NOT open)
      if (!isOpen) {
        // Cmd+B -> battle prep
        if (meta && e.key === 'b') {
          e.preventDefault()
          navigate('/battle-prep')
          return
        }
        // Cmd+Shift+N -> new chat
        if (meta && e.shiftKey && e.key === 'N') {
          e.preventDefault()
          navigate('/chat')
          return
        }
        // Cmd+G -> growth
        if (meta && e.key === 'g') {
          e.preventDefault()
          navigate('/growth')
          return
        }
      }

      // Palette-specific keys (only when open)
      if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % (results.length || 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1))
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          const item = results[selectedIndex]
          if (item) item.onSelect()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, navigate, close])

  return {
    isOpen,
    query,
    results,
    selectedIndex,
    open,
    close,
    setQuery,
  }
}

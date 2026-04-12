import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, MessageSquare, Swords, TrendingUp, User } from 'lucide-react'
import './BottomTabBar.css'

interface TabItem {
  to: string
  icon: React.ReactNode
  label: string
  elevated?: boolean
  matchPrefix?: string
}

const tabs: TabItem[] = [
  { to: '/', icon: <Home size={20} />, label: '首页' },
  { to: '/chat', icon: <MessageSquare size={20} />, label: '对话', matchPrefix: '/chat' },
  { to: '/battle-prep', icon: <Swords size={20} />, label: '备战', elevated: true, matchPrefix: '/battle-prep' },
  { to: '/growth', icon: <TrendingUp size={20} />, label: '成长', matchPrefix: '/growth' },
  { to: '/growth', icon: <User size={20} />, label: '我的', matchPrefix: '__profile__' },
]

const BottomTabBar: React.FC = () => {
  const location = useLocation()

  const isActive = (tab: TabItem) => {
    if (tab.to === '/') return location.pathname === '/'
    if (tab.matchPrefix) return location.pathname.startsWith(tab.matchPrefix)
    return false
  }

  return (
    <nav className="bottom-tab-bar">
      {tabs.map((tab, idx) => {
        const active = isActive(tab)
        return (
          <Link
            key={idx}
            to={tab.to}
            className={`bottom-tab-item${active ? ' active' : ''}${tab.elevated ? ' elevated' : ''}`}
          >
            {tab.elevated ? (
              <span className="bottom-tab-elevated-icon">{tab.icon}</span>
            ) : (
              <span className="bottom-tab-icon">{tab.icon}</span>
            )}
            <span className="bottom-tab-label">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomTabBar

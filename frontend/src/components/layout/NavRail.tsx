import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquare, Swords, TrendingUp, Settings } from 'lucide-react'
import './NavRail.css'

const LogoMark: React.FC = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#2D9C6F" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M2 17l10 5 10-5" stroke="#2D9C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12l10 5 10-5" stroke="#2D9C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  { to: '/chat', icon: <MessageSquare size={18} />, label: 'Chat' },
  { to: '/battle-prep', icon: <Swords size={18} />, label: 'Battle Prep' },
  { to: '/growth', icon: <TrendingUp size={18} />, label: 'Growth' },
  { to: '/settings', icon: <Settings size={18} />, label: 'Settings' },
]

const NavRail: React.FC = () => {
  const location = useLocation()

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <nav className="navrail">
      <Link to="/" className="navrail-logo" aria-label="Home">
        <LogoMark />
      </Link>
      <div className="navrail-items">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`navrail-icon${isActive(item.to) ? ' active' : ''}`}
            title={item.label}
          >
            {item.icon}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default NavRail

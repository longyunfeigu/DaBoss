import React from 'react'
import { Flame, Star } from 'lucide-react'
import './TopBar.css'

const LogoSvg: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#2D9C6F" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M2 17l10 5 10-5" stroke="#2D9C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12l10 5 10-5" stroke="#2D9C6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const TopBar: React.FC = () => {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <LogoSvg size={22} />
          <span className="topbar-wordmark">DaBoss</span>
        </div>
        <div className="topbar-search" role="button" tabIndex={0}>
          <span className="topbar-search-text">搜索或输入命令...</span>
          <kbd className="topbar-search-kbd">&#8984;K</kbd>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-stat">
          <Flame size={16} />
          <span>7</span>
        </div>
        <div className="topbar-stat">
          <Star size={16} />
          <span>1280</span>
        </div>
        <div className="topbar-level-pill">Lv.5 沟通达人</div>
        <div className="topbar-avatar">顾</div>
      </div>
    </header>
  )
}

export default TopBar

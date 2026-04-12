import React from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import NavRail from './NavRail'
import './Layout.css'

const Layout: React.FC = () => {
  return (
    <div className="app-layout-shell">
      <TopBar />
      <div className="app-body">
        <NavRail />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import NavRail from './NavRail'
import CommandPalette from './CommandPalette'
import { useCommandPalette } from '../../hooks/useCommandPalette'
import { useAppContext } from '../../contexts/AppContext'
import { fetchRooms, type ChatRoom } from '../../services/api'
import './Layout.css'

const Layout: React.FC = () => {
  const { personaMap } = useAppContext()
  const [rooms, setRooms] = useState<ChatRoom[]>([])

  useEffect(() => {
    fetchRooms()
      .then(setRooms)
      .catch(() => {})
  }, [])

  const palette = useCommandPalette(rooms, personaMap)

  return (
    <div className="app-layout-shell">
      <TopBar onSearchClick={palette.open} />
      <div className="app-body">
        <NavRail />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <CommandPalette
        isOpen={palette.isOpen}
        query={palette.query}
        results={palette.results}
        selectedIndex={palette.selectedIndex}
        onClose={palette.close}
        onQueryChange={palette.setQuery}
      />
    </div>
  )
}

export default Layout

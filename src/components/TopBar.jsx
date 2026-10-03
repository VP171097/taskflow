import { useEffect, useRef, useState } from 'react'
import { LogoSvg } from './Login'
import { useStore } from '../lib/store'

export default function TopBar({ user, view, setView, onAI, onPdf, onProfile, onLogout, theme, toggleTheme }) {
  const { pending } = useStore()
  const [menu, setMenu] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const initial = (user.name || user.email || '?')[0].toUpperCase()
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo">
          <LogoSvg />
        </div>
        <span>TaskFlow</span>
      </div>
      <nav className="tabs">
        {[
          ['tasks', 'Tasks'],
          ['timetable', 'Timetable'],
        ].map(([k, label]) => (
          <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="top-actions">
        <button className="btn ai small" onClick={() => onAI('chat')} title="AI assistant">
          ✨ <span>AI</span>
        </button>
        <span className={`badge ${!pending ? 'ok' : ''}`} title="Sync status">
          {pending ? 'Syncing…' : '✓ Synced'}
        </span>
        <button className="icon-btn" onClick={onPdf} title="Download PDF" aria-label="Download PDF">
          ⬇
        </button>
        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <div className="user" ref={ref}>
          <button
            className="avatar"
            style={user.photo ? { backgroundImage: `url(${user.photo})` } : undefined}
            onClick={() => setMenu((m) => !m)}
            aria-label="Account"
          >
            {!user.photo && initial}
          </button>
          {menu && (
            <div className="menu">
              <div className="menu-name">{user.name || 'You'}</div>
              <div className="menu-mail muted">{user.email}</div>
              <button
                className="btn small ghost"
                onClick={() => {
                  setMenu(false)
                  onProfile()
                }}
              >
                Profile & hours
              </button>
              <button
                className="btn small ghost"
                onClick={() => {
                  setMenu(false)
                  onPdf()
                }}
              >
                Download PDF
              </button>
              <button className="btn small ghost danger" onClick={onLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

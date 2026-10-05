import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Circulars from './pages/Circulars.jsx'
import Documents from './pages/Documents.jsx'
import Notification from './pages/Notification.jsx'
import Letters from './pages/Letters.jsx'
import Training from './pages/Training.jsx'
import Download from './pages/Download.jsx'
import ContactOfficers from './pages/ContactOfficers.jsx'
import AdminUnits from './pages/AdminUnits.jsx'
import './App.css'

const CORRESPONDENCE_LINKS = [
  { to: '/correspondence/circular-orig', label: 'Circular (Original)' },
  { to: '/correspondence/circular-dco', label: 'Circular (DCO)' },
  { to: '/correspondence/notification', label: 'Notification' },
  { to: '/correspondence/letters', label: 'Letters' },
]

function NavBar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const dropdownRef = useRef(null)
  const location = useLocation()

  const correspondenceActive = location.pathname.startsWith('/correspondence')

  useEffect(() => {
    setDropdownOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <NavLink to="/" className="brand">
          <span className="brand-logo" aria-hidden="true">
            🏛️
          </span>
          <span className="brand-text">Nodal's Web Portal</span>
        </NavLink>

        <button
          type="button"
          className="nav-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className={`nav-links${mobileOpen ? ' open' : ''}`}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Home
          </NavLink>

          <NavLink to="/admin-units" className={({ isActive }) => (isActive ? 'active' : '')}>
            Administrative Units
          </NavLink>

          <div className={`nav-dropdown${dropdownOpen ? ' open' : ''}`} ref={dropdownRef}>
            <button
              type="button"
              className={`nav-dropdown-toggle${correspondenceActive ? ' active' : ''}`}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              Correspondence <span className="caret">▾</span>
            </button>

            <div className="nav-dropdown-menu">
              {CORRESPONDENCE_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <NavLink to="/training" className={({ isActive }) => (isActive ? 'active' : '')}>
            Training
          </NavLink>

          <NavLink to="/download" className={({ isActive }) => (isActive ? 'active' : '')}>
            Download
          </NavLink>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <NavBar />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin-units" element={<AdminUnits />} />
            <Route path="/correspondence/circular-orig" element={<Circulars />} />
            <Route path="/correspondence/circular-dco" element={<Documents />} />
            <Route path="/correspondence/notification" element={<Notification />} />
            <Route path="/correspondence/letters" element={<Letters />} />
            <Route path="/training" element={<Training />} />
            <Route path="/download" element={<Download />} />
            <Route path="/contacts" element={<ContactOfficers />} />
            {/* Old links kept working */}
            <Route path="/circulars" element={<Navigate to="/correspondence/circular-orig" replace />} />
            <Route path="/documents" element={<Navigate to="/correspondence/circular-dco" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

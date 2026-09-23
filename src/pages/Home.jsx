import { Link } from 'react-router-dom'
import './Placeholder.css'

const LINKS = [
  { to: '/admin-units', icon: '🗺️', label: 'Administrative Units' },
  { to: '/correspondence/circular-orig', icon: '📜', label: 'Circular (Orig)' },
  { to: '/correspondence/circular-dco', icon: '📄', label: 'Circular (DCO)' },
  { to: '/correspondence/notification', icon: '📢', label: 'Notification' },
  { to: '/correspondence/letters', icon: '✉️', label: 'Letters' },
  { to: '/training', icon: '🎓', label: 'Training' },
  { to: '/download', icon: '⬇️', label: 'Download' },
  { to: '/contacts', icon: '🏛️', label: 'Contact Officers' },
]

export default function Home() {
  return (
    <div className="placeholder-page home-page">
      <div className="inner">
        <div className="hero">
          <h1>Nodal's Web Portal</h1>
          <p>
            Census 2027 - Nodal's Web Portal. Use the quick links below or the navigation bar above to reach
            Administrative Units, Correspondence (Circulars, Notifications, Letters), Training material and
            Downloads.
          </p>
        </div>

        <div className="quick-links">
          {LINKS.map((link) => (
            <Link className="quick-link-card" to={link.to} key={link.to}>
              <span className="icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Contact', href: '/contact' },
  ]

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #E2EAF4',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1140,
        margin: '0 auto',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/app-icon.png" alt="LottoMeter" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(to right, #0077CC, #2DAE1A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            LottoMeter
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="pub-nav-links">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: 500,
                color: '#46627F',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.target.style.color = '#0077CC'}
              onMouseLeave={(e) => e.target.style.color = '#46627F'}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} className="pub-nav-cta">
          {/* Portal links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to="/login"
              style={{ textDecoration: 'none', fontSize: 13, color: '#46627F', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0A1128'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#46627F'}
            >
              🏪 Store Portal
            </Link>
            <span style={{ color: '#D1DBE8', fontSize: 13 }}>|</span>
            <Link
              to="/staff-portal"
              style={{ textDecoration: 'none', fontSize: 13, color: '#46627F', whiteSpace: 'nowrap', transition: 'color 0.15s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0A1128'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#46627F'}
            >
              🔐 Staff Portal
            </Link>
          </div>

          <Link
            to="/get-started"
            style={{
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              padding: '8px 18px',
              borderRadius: 8,
              background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
              whiteSpace: 'nowrap',
            }}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#0A1128' }}
          className="pub-hamburger"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background: '#fff',
          borderTop: '1px solid #E2EAF4',
          padding: '16px 24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }} className="pub-mobile-menu">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{ textDecoration: 'none', fontSize: 15, fontWeight: 500, color: '#0A1128' }}
            >
              {link.label}
            </a>
          ))}
          <div style={{ borderTop: '1px solid #E2EAF4', paddingTop: 14, display: 'flex', gap: 10 }}>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#0A1128', flex: 1, textAlign: 'center', padding: '10px', border: '1.5px solid #E2EAF4', borderRadius: 8 }}>Login</Link>
            <Link to="/get-started" onClick={() => setMenuOpen(false)} style={{ textDecoration: 'none', fontSize: 14, fontWeight: 600, color: '#fff', flex: 1, textAlign: 'center', padding: '10px', background: 'linear-gradient(to right, #0077CC, #2DAE1A)', borderRadius: 8 }}>Get Started</Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .pub-nav-links { display: none !important; }
          .pub-nav-cta { display: none !important; }
          .pub-hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  )
}

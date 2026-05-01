import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  const cols = [
    {
      heading: 'Product',
      links: [
        { label: 'Features', href: '/#features' },
        { label: 'How It Works', href: '/#how-it-works' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'Request Demo', href: '/apply' },
      ],
    },
    {
      heading: 'Company',
      links: [
        { label: 'Contact Us', href: '/contact' },
        { label: 'Login', href: '/login' },
      ],
    },
  ]

  return (
    <footer style={{ background: '#0A1128', color: '#fff', padding: '56px 24px 0' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48, marginBottom: 48 }}>
          {/* Brand */}
          <div style={{ flex: '1 1 240px', minWidth: 200 }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <img src="/app-icon.png" alt="LottoMeter" style={{ width: 32, height: 32, borderRadius: 8 }} />
              <span style={{ fontWeight: 800, fontSize: 18, background: 'linear-gradient(to right, #4DB8FF, #5CDE3A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                LottoMeter
              </span>
            </Link>
            <p style={{ fontSize: 13, color: '#8EA8C3', lineHeight: 1.7, maxWidth: 260, margin: 0 }}>
              The all-in-one platform for lottery store owners to track shifts, manage books, and stay compliant.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.heading} style={{ flex: '0 0 140px' }}>
              <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8EA8C3', marginBottom: 16 }}>
                {col.heading}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.href}
                    style={{ fontSize: 14, color: '#C8D8E8', textDecoration: 'none', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => e.target.style.color = '#fff'}
                    onMouseLeave={(e) => e.target.style.color = '#C8D8E8'}
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid #1E2E45', padding: '20px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#8EA8C3' }}>
            © {year} LottoMeter. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Privacy Policy', 'Terms of Service'].map((t) => (
              <a key={t} href="#" style={{ fontSize: 13, color: '#8EA8C3', textDecoration: 'none' }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = '#8EA8C3'}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

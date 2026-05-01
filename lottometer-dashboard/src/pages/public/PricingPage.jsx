import { Link } from 'react-router-dom'
import Navbar from '../../components/public/Navbar'
import Footer from '../../components/public/Footer'

const PLANS = [
  {
    name: 'Basic',
    price: '$29',
    period: '/mo',
    desc: 'Perfect for single-location stores just getting started.',
    color: '#46627F',
    features: [
      '1 store location',
      'Up to 5 employees',
      'Digital shift management',
      'Lottery book scanning',
      'Basic shift reports',
      'Email support',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    desc: 'For growing stores that need full visibility and control.',
    color: '#0077CC',
    features: [
      '1 store location',
      'Unlimited employees',
      'Everything in Basic',
      'Advanced variance reports',
      'Business day management',
      'Priority email & chat support',
      'Export to CSV',
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/mo',
    desc: 'Multi-location chains and franchise operators.',
    color: '#2DAE1A',
    features: [
      'Multiple store locations',
      'Unlimited employees',
      'Everything in Pro',
      'Cross-store reporting',
      'Dedicated account manager',
      'Custom onboarding',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
]

const FAQ = [
  { q: 'Is there a free trial?', a: 'Yes — the Pro plan includes a 14-day free trial, no credit card required. Request a demo and we'll get you set up.' },
  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade your plan at any time from your account settings.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data is kept for 90 days after cancellation, giving you time to export everything you need.' },
  { q: 'Do employees need their own subscription?', a: 'No. The subscription covers your store — all your employees use the mobile app under the same plan.' },
]

export default function PricingPage() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#0A1128', background: '#fff' }}>
      <Navbar />

      {/* Header */}
      <section style={{ padding: '80px 24px 56px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0077CC', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
          Pricing
        </p>
        <h1 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: 16, color: '#46627F', margin: '0 auto', maxWidth: 480, lineHeight: 1.7 }}>
          No hidden fees. No contracts. Cancel anytime.
        </p>
      </section>

      {/* Plans */}
      <section style={{ padding: '0 24px 80px', background: 'linear-gradient(135deg, #F0F7FF 0%, #F8FFF4 100%)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                flex: '1 1 280px', maxWidth: 340,
                background: plan.highlight ? 'linear-gradient(135deg, #0A1128, #0E2040)' : '#fff',
                borderRadius: 16, padding: '32px',
                border: plan.highlight ? '2px solid #0077CC' : '1.5px solid #E2EAF4',
                boxShadow: plan.highlight ? '0 12px 48px rgba(0,119,204,0.22)' : '0 2px 12px rgba(0,77,140,0.06)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  padding: '4px 10px', borderRadius: 999, letterSpacing: '0.06em',
                }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: plan.highlight ? '#8EA8C3' : '#46627F', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: 46, fontWeight: 900, color: plan.highlight ? '#fff' : '#0A1128', lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: plan.highlight ? '#8EA8C3' : '#46627F', paddingBottom: 6 }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: 13, color: plan.highlight ? '#8EA8C3' : '#46627F', lineHeight: 1.6, margin: '0 0 24px' }}>
                {plan.desc}
              </p>
              <Link
                to="/apply"
                style={{
                  display: 'block', textAlign: 'center', textDecoration: 'none',
                  padding: '12px', borderRadius: 9, fontWeight: 700, fontSize: 14,
                  background: plan.highlight ? 'linear-gradient(to right, #0077CC, #2DAE1A)' : '#F0F7FF',
                  color: plan.highlight ? '#fff' : plan.color,
                  border: plan.highlight ? 'none' : `1.5px solid ${plan.color}30`,
                  marginBottom: 24,
                }}
              >
                {plan.cta}
              </Link>
              <div style={{ borderTop: `1px solid ${plan.highlight ? '#1E3A5F' : '#E2EAF4'}`, paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: '#2DAE1A', fontWeight: 700, fontSize: 14, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: plan.highlight ? '#C8D8E8' : '#46627F', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '72px 24px 80px', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
              Frequently asked questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FAQ.map((item) => (
              <div key={item.q} style={{ background: '#F8FAFF', borderRadius: 12, padding: '20px 24px', border: '1px solid #E2EAF4' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{item.q}</div>
                <div style={{ fontSize: 14, color: '#46627F', lineHeight: 1.65 }}>{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: '64px 24px', background: '#F0F7FF', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Not sure which plan fits?
        </h2>
        <p style={{ fontSize: 15, color: '#46627F', margin: '0 0 32px', lineHeight: 1.7 }}>
          Book a free demo and we'll help you pick the right plan for your store.
        </p>
        <Link to="/apply" style={{
          textDecoration: 'none', fontSize: 15, fontWeight: 700, color: '#fff',
          padding: '14px 32px', borderRadius: 10,
          background: 'linear-gradient(to right, #0077CC, #2DAE1A)',
          boxShadow: '0 4px 16px rgba(0,119,204,0.25)',
        }}>
          Request a Free Demo
        </Link>
      </section>

      <Footer />
    </div>
  )
}

import { useState } from 'react'
import Badge from '../components/UI/Badge'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    period: 'mo',
    description: 'Perfect for single-store operations',
    features: [
      '1 store location',
      'Up to 5 users',
      'Shift management',
      'Basic reports',
      'Book inventory tracking',
      'Email support',
    ],
    cta: 'Get Started',
    variant: 'secondary',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    period: 'mo',
    description: 'For growing multi-store businesses',
    features: [
      'Up to 3 store locations',
      'Unlimited users',
      'Advanced analytics',
      'PDF export',
      'Priority support',
      'Shift variance alerts',
      'Business day management',
    ],
    cta: 'Upgrade Now',
    variant: 'primary',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    period: 'mo',
    description: 'For large-scale lottery operations',
    features: [
      'Unlimited store locations',
      'Unlimited users',
      'Custom integrations',
      'Dedicated account manager',
      'White label branding',
      'API access',
      'SLA guarantee',
      '24/7 phone support',
    ],
    cta: 'Contact Sales',
    variant: 'secondary',
    popular: false,
  },
]

const BILLING_HISTORY = [
  { date: 'Apr 1, 2026', plan: 'Basic', amount: '$29.00', status: 'paid', invoice: '#INV-2026-04' },
  { date: 'Mar 1, 2026', plan: 'Basic', amount: '$29.00', status: 'paid', invoice: '#INV-2026-03' },
  { date: 'Feb 1, 2026', plan: 'Basic', amount: '$29.00', status: 'paid', invoice: '#INV-2026-02' },
  { date: 'Jan 1, 2026', plan: 'Basic', amount: '$29.00', status: 'paid', invoice: '#INV-2026-01' },
  { date: 'Dec 1, 2025', plan: 'Basic', amount: '$29.00', status: 'paid', invoice: '#INV-2025-12' },
]

export default function Subscription() {
  const [currentPlan] = useState('basic')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const handlePlanClick = (plan) => {
    if (plan.id === 'enterprise') {
      alert('Please contact our sales team at sales@lottometer.com to discuss Enterprise pricing.')
      return
    }
    if (plan.id === currentPlan) {
      alert('You are already on this plan.')
      return
    }
    alert(`Upgrading to ${plan.name} plan... (Payment integration coming soon)`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Subscription</h1>
          <p className="page-header-sub">Manage your plan and billing</p>
        </div>
      </div>

      {/* Plans */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Choose Your Plan</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
          marginBottom: 48,
          alignItems: 'start',
        }}
      >
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          const isPopular = plan.popular
          return (
            <div
              key={plan.id}
              style={{
                background: 'var(--bg-card)',
                border: isPopular
                  ? '2px solid var(--blue)'
                  : isCurrent
                  ? '2px solid var(--green)'
                  : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 28,
                boxShadow: isPopular
                  ? '0 8px 32px rgba(0, 119, 204, 0.15)'
                  : 'var(--shadow)',
                position: 'relative',
              }}
            >
              {/* Popular badge */}
              {isPopular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -13,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--gradient)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 14px',
                    borderRadius: 999,
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <div style={{ marginBottom: 12 }}>
                  <Badge variant="green">Current Plan</Badge>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800 }}>{plan.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {plan.description}
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 800,
                    background: isPopular ? 'var(--gradient)' : 'none',
                    WebkitBackgroundClip: isPopular ? 'text' : undefined,
                    WebkitTextFillColor: isPopular ? 'transparent' : undefined,
                    backgroundClip: isPopular ? 'text' : undefined,
                    color: isPopular ? undefined : 'var(--text-primary)',
                  }}
                >
                  ${plan.price}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>/{plan.period}</span>
              </div>

              <ul style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--green)',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${plan.variant === 'primary' ? 'btn-primary' : 'btn-secondary'} btn-lg`}
                style={{ width: '100%' }}
                onClick={() => handlePlanClick(plan)}
                disabled={isCurrent}
              >
                {isCurrent ? 'Current Plan' : plan.cta}
              </button>
            </div>
          )
        })}
      </div>

      {/* Billing History */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="stack-row">
          <h2 className="card-title">Billing History</h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_HISTORY.map((bill) => (
                <tr key={bill.invoice}>
                  <td>{bill.date}</td>
                  <td>{bill.plan}</td>
                  <td style={{ fontWeight: 600 }}>{bill.amount}</td>
                  <td>
                    <Badge variant={bill.status === 'paid' ? 'green' : 'amber'}>
                      {bill.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => alert(`Downloading invoice ${bill.invoice}...`)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 0 8px',
          borderTop: '1px solid var(--border)',
        }}
      >
        {!showCancelConfirm ? (
          <button
            onClick={() => setShowCancelConfirm(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--red)',
              fontSize: 13,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontWeight: 500,
            }}
          >
            Cancel subscription
          </button>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: 20,
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
            }}
          >
            <p style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              Are you sure you want to cancel your subscription? You'll lose access at the end of your billing period.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Subscription
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setShowCancelConfirm(false)
                  alert('Subscription cancellation request submitted. You will receive a confirmation email.')
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

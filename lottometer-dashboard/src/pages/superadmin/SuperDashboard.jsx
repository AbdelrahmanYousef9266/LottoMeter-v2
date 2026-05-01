import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSuperStats } from '../../api/superadmin'
import useApi from '../../hooks/useApi'

const PURPLE = '#7C3AED'

function StatCard({ icon, label, value, sub, onClick, accent }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        flex: '1 1 180px', cursor: onClick ? 'pointer' : 'default',
        borderTop: `3px solid ${accent || PURPLE}`,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'none')}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export default function SuperDashboard() {
  const navigate = useNavigate()
  const apiFn = useCallback(() => getSuperStats(), [])
  const { data, loading } = useApi(apiFn)

  const stats = [
    { icon: '🏪', label: 'Total Stores', value: data?.total_stores, accent: PURPLE, onClick: () => navigate('/superadmin/stores') },
    { icon: '✅', label: 'Active Stores', value: data?.active_stores, accent: '#0077CC', onClick: () => navigate('/superadmin/stores') },
    { icon: '👥', label: 'Total Users', value: data?.total_users, accent: '#2DAE1A' },
    { icon: '📬', label: 'New Submissions', value: data?.new_submissions, accent: '#F59E0B', onClick: () => navigate('/superadmin/submissions') },
    { icon: '🔄', label: 'Shifts Today', value: data?.shifts_today, accent: '#0077CC' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ color: PURPLE }}>⚡ Super Admin Overview</h1>
          <p className="page-header-sub">Platform-wide stats across all customer stores</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} value={loading ? '…' : s.value} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/superadmin/stores/create')}>
          ➕ Create New Store
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/superadmin/submissions')}>
          📬 View Submissions
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/superadmin/stores')}>
          🏪 Manage Stores
        </button>
      </div>
    </div>
  )
}

export default function StatCard({ label, value, icon, trend, valueColor }) {
  return (
    <div className="stat-card">
      {icon && (
        <div className="stat-icon">{icon}</div>
      )}
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueColor ? { color: valueColor } : undefined}>
        {value ?? '—'}
      </div>
      {trend && (
        <div className={`stat-trend ${trend.positive ? 'up' : 'down'}`}>
          <span>{trend.positive ? '▲' : '▼'}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}

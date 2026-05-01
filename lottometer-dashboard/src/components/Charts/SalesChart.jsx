import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: 'var(--shadow)',
        fontSize: 13,
      }}
    >
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--blue)', fontWeight: 700 }}>
        ${Number(payload[0].value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  )
}

export default function SalesChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0077CC" />
            <stop offset="100%" stopColor="#2DAE1A" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#E2EAF4" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#46627F' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#46627F' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="sales"
          stroke="url(#lineGradient)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: '#0077CC', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

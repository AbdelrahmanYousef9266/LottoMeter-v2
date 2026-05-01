export default function Badge({ children, variant = 'gray' }) {
  const variantClass = {
    green: 'badge-green',
    red: 'badge-red',
    amber: 'badge-amber',
    blue: 'badge-blue',
    gray: 'badge-gray',
  }[variant] || 'badge-gray'

  return (
    <span className={`badge ${variantClass}`}>
      {children}
    </span>
  )
}

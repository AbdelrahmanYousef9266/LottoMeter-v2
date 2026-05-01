import LoadingSpinner from './LoadingSpinner'

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  style,
}) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
  const variantClass =
    variant === 'secondary'
      ? 'btn-secondary'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn-primary'

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass}`}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}

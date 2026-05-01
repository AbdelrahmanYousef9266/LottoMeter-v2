export default function LoadingSpinner({ size = 'md', fullPage = false }) {
  const sizeClass = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'

  const spinner = <div className={`loading-spinner ${sizeClass}`} />

  if (fullPage) {
    return (
      <div className="loading-spinner-fullpage">
        <div className="loading-spinner lg" />
      </div>
    )
  }

  return spinner
}

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  required = false,
  id,
  name,
  disabled = false,
  autoComplete,
}) {
  const inputId = id || name || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
          {required && (
            <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>
          )}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        className={`input-field${error ? ' input-error' : ''}`}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  )
}

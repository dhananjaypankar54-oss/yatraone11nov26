import React, { forwardRef } from 'react'

// forwardRef so React Hook Form's register() works on it.
const Input = forwardRef(function Input({ label, error, id, as = 'input', children, hint, ...props }, ref) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      {as === 'select' ? (
        <select id={inputId} ref={ref} className={error ? 'has-error' : ''} {...props}>{children}</select>
      ) : (
        <input id={inputId} ref={ref} className={error ? 'has-error' : ''} aria-invalid={!!error} {...props} />
      )}
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  )
})
export default Input

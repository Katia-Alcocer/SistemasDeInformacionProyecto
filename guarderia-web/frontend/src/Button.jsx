import React from 'react';

/** Botón compartido con variantes visuales, foco visible y estado de carga accesible. */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  icon,
  ...props
}) {
  const classes = ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-button__spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

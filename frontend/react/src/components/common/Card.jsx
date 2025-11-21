import './Card.css'

export default function Card({
  children,
  title,
  subtitle,
  headerActions,
  footer,
  className = '',
  padding = 'md',
  shadow = 'md',
  ...props
}) {
  const paddingClass = `card-padding-${padding}`
  const shadowClass = `card-shadow-${shadow}`
  
  const classes = ['card', paddingClass, shadowClass, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...props}>
      {(title || subtitle || headerActions) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {headerActions && (
            <div className="card-header-actions">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  )
}


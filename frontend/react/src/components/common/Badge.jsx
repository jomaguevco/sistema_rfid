import './Badge.css'

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) {
  const variantClass = `badge-${variant}`
  const sizeClass = `badge-${size}`
  
  const classes = ['badge', variantClass, sizeClass, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  )
}


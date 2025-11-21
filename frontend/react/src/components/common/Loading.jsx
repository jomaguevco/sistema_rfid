import './Loading.css'

export default function Loading({
  size = 'md',
  text,
  fullScreen = false,
  className = '',
}) {
  const sizeClass = `loading-${size}`
  
  const classes = ['loading', sizeClass, className]
    .filter(Boolean)
    .join(' ')

  const content = (
    <div className={classes}>
      <div className="loading-spinner"></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        {content}
      </div>
    )
  }

  return content
}


import './Table.css'

export default function Table({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  className = '',
  rowClassName,
  ...props
}) {
  if (loading) {
    return (
      <div className="table-container">
        <div className="table-loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-container">
        <div className="table-empty">
          <p>{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className={`table ${className}`} {...props}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key || column.field} className={column.className || ''}>
                {column.header || column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const customRowClassName = rowClassName ? rowClassName(row, rowIndex) : ''
            return (
              <tr 
                key={row.id || rowIndex} 
                className={customRowClassName}
                style={{
                  ...(row.is_first_in_group && {
                    borderTop: '2px solid var(--color-primary)',
                    backgroundColor: 'var(--color-background-secondary)'
                  }),
                  ...(row.is_last_in_group && {
                    borderBottom: '2px solid var(--color-primary)',
                    marginBottom: '0.5rem'
                  }),
                  ...(row.lot_index !== undefined && row.lot_index % 2 === 0 && !row.is_first_in_group && {
                    backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)'
                  })
                }}
              >
                {columns.map((column) => {
                  const cellValue = column.render
                    ? column.render(row[column.field], row, rowIndex)
                    : row[column.field]
                  
                  return (
                    <td key={column.key || column.field} className={column.className || ''}>
                      {cellValue}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}


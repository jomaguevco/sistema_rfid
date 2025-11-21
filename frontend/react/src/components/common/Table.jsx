import './Table.css'

export default function Table({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  className = '',
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
          {data.map((row, rowIndex) => (
            <tr key={row.id || rowIndex}>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}


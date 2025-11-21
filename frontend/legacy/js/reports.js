// Módulo de reportes avanzados
let currentReportData = null;
let currentReportType = null;

async function loadReports() {
  const container = document.getElementById('reportsContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="reports-container">
      <div class="section-header" style="margin-bottom: 20px;">
        <h3>Reportes Disponibles</h3>
        <button onclick="showCustomReportBuilder()" class="btn btn-primary">🔧 Reporte Personalizado</button>
      </div>
      <div class="reports-grid">
        <div class="report-card" onclick="showReportConfig('expired')">
          <div class="report-icon">⚠️</div>
          <h4>Productos Vencidos</h4>
          <p>Lista de todos los productos vencidos</p>
        </div>
        <div class="report-card" onclick="showReportConfig('expiring')">
          <div class="report-icon">⏰</div>
          <h4>Productos por Vencer</h4>
          <p>Productos que vencen en los próximos días</p>
        </div>
        <div class="report-card" onclick="showReportConfig('low-stock')">
          <div class="report-icon">📉</div>
          <h4>Stock Bajo</h4>
          <p>Productos con stock por debajo del mínimo</p>
        </div>
        <div class="report-card" onclick="showReportConfig('predictions')">
          <div class="report-icon">📊</div>
          <h4>Predicciones de Consumo</h4>
          <p>Reporte de predicciones por período y área</p>
        </div>
        <div class="report-card" onclick="showReportConfig('traceability')">
          <div class="report-icon">🔍</div>
          <h4>Trazabilidad</h4>
          <p>Historial completo de movimientos de stock</p>
        </div>
        <div class="report-card" onclick="showReportConfig('consumption-by-area')">
          <div class="report-icon">🏥</div>
          <h4>Consumo por Área</h4>
          <p>Análisis de consumo por departamento</p>
        </div>
        <div class="report-card" onclick="showReportConfig('comparative')">
          <div class="report-icon">📈</div>
          <h4>Reporte Comparativo</h4>
          <p>Comparar períodos y áreas</p>
        </div>
        <div class="report-card" onclick="showReportConfig('summary')">
          <div class="report-icon">📋</div>
          <h4>Resumen Ejecutivo</h4>
          <p>Vista general del inventario</p>
        </div>
      </div>
      <div id="reportResults"></div>
    </div>
  `;
}

function showReportConfig(type) {
  currentReportType = type;
  const modal = document.createElement('div');
  modal.id = 'reportConfigModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  let configHTML = '';
  
  switch(type) {
    case 'expired':
      configHTML = `
        <h2>Configurar Reporte: Productos Vencidos</h2>
        <div class="form-group">
          <label>Ordenar por:</label>
          <select id="reportSort" class="form-select">
            <option value="date">Fecha de Vencimiento</option>
            <option value="product">Nombre del Producto</option>
            <option value="quantity">Cantidad</option>
          </select>
        </div>
        <div class="form-group">
          <label>Incluir productos con cantidad cero:</label>
          <input type="checkbox" id="includeZero" checked>
        </div>
      `;
      break;
    case 'expiring':
      configHTML = `
        <h2>Configurar Reporte: Productos por Vencer</h2>
        <div class="form-group">
          <label>Días a considerar:</label>
          <select id="reportDays" class="form-select">
            <option value="7">7 días</option>
            <option value="15">15 días</option>
            <option value="30" selected>30 días</option>
            <option value="60">60 días</option>
            <option value="90">90 días</option>
          </select>
        </div>
        <div class="form-group">
          <label>Filtrar por categoría:</label>
          <select id="reportCategory" class="form-select">
            <option value="">Todas las categorías</option>
          </select>
        </div>
        <div class="form-group">
          <label>Ordenar por:</label>
          <select id="reportSort" class="form-select">
            <option value="date">Fecha de Vencimiento</option>
            <option value="days">Días Restantes</option>
            <option value="product">Nombre del Producto</option>
          </select>
        </div>
      `;
      break;
    case 'low-stock':
      configHTML = `
        <h2>Configurar Reporte: Stock Bajo</h2>
        <div class="form-group">
          <label>Filtrar por categoría:</label>
          <select id="reportCategory" class="form-select">
            <option value="">Todas las categorías</option>
          </select>
        </div>
        <div class="form-group">
          <label>Filtrar por tipo:</label>
          <select id="reportType" class="form-select">
            <option value="">Todos los tipos</option>
            <option value="medicamento">Medicamento</option>
            <option value="insumo">Insumo Médico</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mostrar solo productos sin stock:</label>
          <input type="checkbox" id="zeroStockOnly">
        </div>
      `;
      break;
    case 'consumption-by-area':
      configHTML = `
        <h2>Configurar Reporte: Consumo por Área</h2>
        <div class="form-group">
          <label>Período:</label>
          <select id="reportPeriod" class="form-select">
            <option value="7">Últimos 7 días</option>
            <option value="15">Últimos 15 días</option>
            <option value="30" selected>Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div class="form-row" id="customDateRange" style="display:none;">
          <div class="form-group">
            <label>Fecha inicio:</label>
            <input type="date" id="reportStartDate" class="form-control">
          </div>
          <div class="form-group">
            <label>Fecha fin:</label>
            <input type="date" id="reportEndDate" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label>Filtrar por área:</label>
          <select id="reportArea" class="form-select">
            <option value="">Todas las áreas</option>
          </select>
        </div>
      `;
      break;
    case 'comparative':
      configHTML = `
        <h2>Configurar Reporte Comparativo</h2>
        <div class="form-group">
          <label>Tipo de comparación:</label>
          <select id="comparisonType" class="form-select">
            <option value="periods">Comparar Períodos</option>
            <option value="areas">Comparar Áreas</option>
            <option value="products">Comparar Productos</option>
          </select>
        </div>
        <div id="comparisonConfig"></div>
      `;
      break;
    default:
      configHTML = `<h2>Configurar Reporte: ${type}</h2>`;
  }
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <span class="close" onclick="closeModal('reportConfigModal')">&times;</span>
      ${configHTML}
      <div class="form-group">
        <label>Formato de exportación:</label>
        <select id="exportFormat" class="form-select">
          <option value="csv">CSV</option>
          <option value="table">Tabla HTML</option>
        </select>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="includeChart" checked> Incluir gráfico
        </label>
      </div>
      <div class="form-actions">
        <button onclick="executeReport()" class="btn btn-primary">Generar Reporte</button>
        <button onclick="closeModal('reportConfigModal')" class="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cargar datos dinámicos
  if (type === 'expiring' || type === 'low-stock') {
    loadCategoriesForReport();
  }
  if (type === 'consumption-by-area') {
    loadAreasForReport();
  }
  if (type === 'comparative') {
    setupComparisonConfig();
  }
  
  // Mostrar/ocultar rango personalizado
  const periodSelect = document.getElementById('reportPeriod');
  if (periodSelect) {
    periodSelect.addEventListener('change', function() {
      const customRange = document.getElementById('customDateRange');
      if (customRange) {
        customRange.style.display = this.value === 'custom' ? 'grid' : 'none';
      }
    });
  }
}

function setupComparisonConfig() {
  const type = document.getElementById('comparisonType')?.value || 'periods';
  const container = document.getElementById('comparisonConfig');
  if (!container) return;
  
  if (type === 'periods') {
    container.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Período 1 - Inicio:</label>
          <input type="date" id="period1Start" class="form-control">
        </div>
        <div class="form-group">
          <label>Período 1 - Fin:</label>
          <input type="date" id="period1End" class="form-control">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Período 2 - Inicio:</label>
          <input type="date" id="period2Start" class="form-control">
        </div>
        <div class="form-group">
          <label>Período 2 - Fin:</label>
          <input type="date" id="period2End" class="form-control">
        </div>
      </div>
      <div class="form-group">
        <label>Métrica a comparar:</label>
        <select id="comparisonMetric" class="form-select">
          <option value="consumption">Consumo Total</option>
          <option value="products">Productos Únicos</option>
          <option value="areas">Áreas Activas</option>
        </select>
      </div>
    `;
    
    // Establecer fechas por defecto
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    document.getElementById('period1Start').value = twoMonthsAgo.toISOString().split('T')[0];
    document.getElementById('period1End').value = lastMonth.toISOString().split('T')[0];
    document.getElementById('period2Start').value = lastMonth.toISOString().split('T')[0];
    document.getElementById('period2End').value = today.toISOString().split('T')[0];
  } else if (type === 'areas') {
    loadAreasForReport().then(() => {
      container.innerHTML = `
        <div class="form-group">
          <label>Seleccionar áreas a comparar:</label>
          <div id="areasCheckboxes" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 6px;"></div>
        </div>
        <div class="form-group">
          <label>Período:</label>
          <select id="comparisonPeriod" class="form-select">
            <option value="7">Últimos 7 días</option>
            <option value="30" selected>Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
        </div>
      `;
      
      // Cargar checkboxes de áreas
      apiMedical.getAllAreas().then(areas => {
        const container = document.getElementById('areasCheckboxes');
        areas.forEach(area => {
          const div = document.createElement('div');
          div.innerHTML = `<label><input type="checkbox" class="area-checkbox" value="${area.id}"> ${escapeHtml(area.name)}</label>`;
          container.appendChild(div);
        });
      });
    });
  }
}

async function loadCategoriesForReport() {
  try {
    const categories = await apiMedical.getAllCategories();
    const select = document.getElementById('reportCategory');
    if (select) {
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar categorías:', error);
  }
}

async function loadAreasForReport() {
  try {
    const areas = await apiMedical.getAllAreas();
    const select = document.getElementById('reportArea');
    if (select) {
      areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        select.appendChild(option);
      });
    }
    return areas;
  } catch (error) {
    console.error('Error al cargar áreas:', error);
    return [];
  }
}

async function executeReport() {
  try {
    showLoading(true);
    closeModal('reportConfigModal');
    
    const includeChart = document.getElementById('includeChart')?.checked || false;
    const exportFormat = document.getElementById('exportFormat')?.value || 'csv';
    
    let data = [];
    let title = '';
    let config = {};
    
    switch(currentReportType) {
      case 'expired':
        config = {
          sort: document.getElementById('reportSort')?.value || 'date',
          includeZero: document.getElementById('includeZero')?.checked || false
        };
        const response1 = await fetch('/api/reports/expired');
        const result1 = await response1.json();
        data = result1.success ? result1.data : [];
        title = 'Productos Vencidos';
        break;
      case 'expiring':
        const days = parseInt(document.getElementById('reportDays')?.value || 30);
        const categoryId = document.getElementById('reportCategory')?.value || '';
        const sort = document.getElementById('reportSort')?.value || 'date';
        const response2 = await fetch(`/api/reports/expiring?days=${days}${categoryId ? '&category_id=' + categoryId : ''}`);
        const result2 = await response2.json();
        data = result2.success ? result2.data : [];
        title = `Productos por Vencer (Próximos ${days} días)`;
        config = { days, categoryId, sort };
        break;
      case 'low-stock':
        const categoryId2 = document.getElementById('reportCategory')?.value || '';
        const productType = document.getElementById('reportType')?.value || '';
        const zeroStockOnly = document.getElementById('zeroStockOnly')?.checked || false;
        const response3 = await fetch('/api/reports/low-stock');
        const result3 = await response3.json();
        data = result3.success ? result3.data : [];
        // Filtrar en frontend
        if (categoryId2) data = data.filter(p => p.category_id == categoryId2);
        if (productType) data = data.filter(p => p.product_type === productType);
        if (zeroStockOnly) data = data.filter(p => p.current_stock === 0);
        title = 'Productos con Stock Bajo';
        config = { categoryId: categoryId2, productType, zeroStockOnly };
        break;
      case 'consumption-by-area':
        const period = document.getElementById('reportPeriod')?.value || '30';
        const areaId = document.getElementById('reportArea')?.value || '';
        let startDate, endDate;
        
        if (period === 'custom') {
          startDate = document.getElementById('reportStartDate')?.value;
          endDate = document.getElementById('reportEndDate')?.value;
        } else {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - parseInt(period));
          startDate = start.toISOString().split('T')[0];
          endDate = end.toISOString().split('T')[0];
        }
        
        let url = `/api/reports/consumption-by-area`;
        if (period !== 'custom') {
          url += `?days=${period}`;
        } else {
          url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        if (areaId) url += `${period !== 'custom' ? '&' : '?'}area_id=${areaId}`;
        
        const response6 = await fetch(url);
        const result6 = await response6.json();
        data = result6.success ? result6.data : [];
        title = `Consumo por Área (${period === 'custom' ? startDate + ' a ' + endDate : 'Últimos ' + period + ' días'})`;
        config = { period, areaId, startDate, endDate };
        break;
      case 'comparative':
        await generateComparativeReport();
        return;
      case 'summary':
        await generateSummaryReport();
        return;
      default:
        await generateReport(currentReportType);
        return;
    }
    
    currentReportData = data;
    renderAdvancedReportResults(title, data, currentReportType, config, includeChart);
    
  } catch (error) {
    console.error('Error al generar reporte:', error);
    showNotification(`Error al generar reporte: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function generateComparativeReport() {
  const type = document.getElementById('comparisonType')?.value || 'periods';
  
  if (type === 'periods') {
    const period1Start = document.getElementById('period1Start')?.value;
    const period1End = document.getElementById('period1End')?.value;
    const period2Start = document.getElementById('period2Start')?.value;
    const period2End = document.getElementById('period2End')?.value;
    const metric = document.getElementById('comparisonMetric')?.value || 'consumption';
    
    // Obtener datos de ambos períodos
    const [data1, data2] = await Promise.all([
      fetch(`/api/reports/consumption-by-area?start_date=${period1Start}&end_date=${period1End}`).then(r => r.json()),
      fetch(`/api/reports/consumption-by-area?start_date=${period2Start}&end_date=${period2End}`).then(r => r.json())
    ]);
    
    renderComparisonReport(
      'Comparación de Períodos',
      data1.success ? data1.data : [],
      data2.success ? data2.data : [],
      period1Start, period1End, period2Start, period2End,
      metric
    );
  } else if (type === 'areas') {
    const selectedAreas = Array.from(document.querySelectorAll('.area-checkbox:checked')).map(cb => cb.value);
    const period = document.getElementById('comparisonPeriod')?.value || '30';
    
    if (selectedAreas.length === 0) {
      showNotification('Selecciona al menos un área', 'warning');
      return;
    }
    
    // Obtener datos de cada área
    const areaData = await Promise.all(
      selectedAreas.map(areaId => 
        fetch(`/api/reports/consumption-by-area?days=${period}&area_id=${areaId}`).then(r => r.json())
      )
    );
    
    renderAreaComparisonReport(selectedAreas, areaData, period);
  }
}

async function generateSummaryReport() {
  try {
    // Obtener múltiples métricas
    const [stats, expired, expiring, lowStock, consumption] = await Promise.all([
      fetch('/api/dashboard/stats').then(r => r.json()),
      fetch('/api/reports/expired').then(r => r.json()),
      fetch('/api/reports/expiring?days=30').then(r => r.json()),
      fetch('/api/reports/low-stock').then(r => r.json()),
      fetch('/api/reports/consumption-by-area?days=30').then(r => r.json())
    ]);
    
    renderSummaryReport({
      stats: stats.success ? stats.data : {},
      expired: expired.success ? expired.data : [],
      expiring: expiring.success ? expiring.data : [],
      lowStock: lowStock.success ? lowStock.data : [],
      consumption: consumption.success ? consumption.data : []
    });
  } catch (error) {
    showNotification(`Error al generar resumen: ${error.message}`, 'error');
  }
}

function renderAdvancedReportResults(title, data, type, config, includeChart) {
  const container = document.getElementById('reportResults');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Encabezado del reporte
  const header = document.createElement('div');
  header.className = 'report-header';
  header.innerHTML = `
    <div>
      <h4>${title}</h4>
      <p class="text-muted">Generado el ${new Date().toLocaleString('es-ES')}</p>
    </div>
    <div>
      <button class="btn btn-sm btn-primary" onclick="exportReportToCSV('${title}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
        📥 Exportar CSV
      </button>
      <button class="btn btn-sm btn-secondary" onclick="printReport()">
        🖨️ Imprimir
      </button>
    </div>
  `;
  container.appendChild(header);
  
  // Resumen estadístico
  const summary = document.createElement('div');
  summary.className = 'report-summary';
  summary.innerHTML = generateReportSummary(data, type);
  container.appendChild(summary);
  
  // Gráfico si está habilitado
  if (includeChart && data.length > 0) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'report-chart';
    chartContainer.innerHTML = `<canvas id="reportChart" style="max-height: 400px;"></canvas>`;
    container.appendChild(chartContainer);
    
    setTimeout(() => renderReportChart(data, type, 'reportChart'), 100);
  }
  
  // Tabla de datos
  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  tableContainer.innerHTML = generateReportTable(data, type);
  container.appendChild(tableContainer);
  
  currentReportData = data;
}

function generateReportSummary(data, type) {
  if (data.length === 0) return '<p class="text-muted">No hay datos para mostrar</p>';
  
  let summary = '<div class="report-summary-grid">';
  
  switch(type) {
    case 'expired':
      const totalExpired = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
      summary += `
        <div class="summary-item">
          <div class="summary-value">${data.length}</div>
          <div class="summary-label">Lotes Vencidos</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalExpired}</div>
          <div class="summary-label">Unidades Vencidas</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${new Set(data.map(d => d.product_id)).size}</div>
          <div class="summary-label">Productos Únicos</div>
        </div>
      `;
      break;
    case 'expiring':
      const totalExpiring = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const critical = data.filter(d => d.days_to_expiry <= 7).length;
      summary += `
        <div class="summary-item">
          <div class="summary-value">${data.length}</div>
          <div class="summary-label">Lotes por Vencer</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalExpiring}</div>
          <div class="summary-label">Unidades Totales</div>
        </div>
        <div class="summary-item critical">
          <div class="summary-value">${critical}</div>
          <div class="summary-label">Críticos (≤7 días)</div>
        </div>
      `;
      break;
    case 'low-stock':
      const totalLowStock = data.reduce((sum, item) => sum + (item.current_stock || 0), 0);
      const zeroStock = data.filter(d => d.current_stock === 0).length;
      summary += `
        <div class="summary-item">
          <div class="summary-value">${data.length}</div>
          <div class="summary-label">Productos con Stock Bajo</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalLowStock}</div>
          <div class="summary-label">Stock Total</div>
        </div>
        <div class="summary-item critical">
          <div class="summary-value">${zeroStock}</div>
          <div class="summary-label">Sin Stock</div>
        </div>
      `;
      break;
    case 'consumption-by-area':
      const totalConsumed = data.reduce((sum, item) => sum + (item.total_consumed || 0), 0);
      const totalRemovals = data.reduce((sum, item) => sum + (item.total_removals || 0), 0);
      summary += `
        <div class="summary-item">
          <div class="summary-value">${data.length}</div>
          <div class="summary-label">Áreas Activas</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalConsumed}</div>
          <div class="summary-label">Total Consumido</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalRemovals}</div>
          <div class="summary-label">Total Retiros</div>
        </div>
      `;
      break;
  }
  
  summary += '</div>';
  return summary;
}

function generateReportTable(data, type) {
  if (data.length === 0) return '<p class="text-muted">No hay datos para mostrar</p>';
  
  let tableHTML = '<table class="report-table"><thead><tr>';
  
  // Generar encabezados según tipo
  if (type === 'expired' || type === 'expiring') {
    tableHTML += `
      <th>Producto</th>
      <th>Tipo</th>
      <th>Categoría</th>
      <th>Lote</th>
      <th>Fecha Vencimiento</th>
      <th>Cantidad</th>
      <th>Días Restantes</th>
    `;
  } else if (type === 'low-stock') {
    tableHTML += `
      <th>Producto</th>
      <th>Tipo</th>
      <th>Categoría</th>
      <th>Stock Actual</th>
      <th>Stock Mínimo</th>
      <th>Déficit</th>
      <th>Estado</th>
    `;
  } else if (type === 'consumption-by-area') {
    tableHTML += `
      <th>Área</th>
      <th>Total Retiros</th>
      <th>Total Consumido</th>
      <th>Productos Únicos</th>
      <th>Promedio por Retiro</th>
    `;
  }
  
  tableHTML += '</tr></thead><tbody>';
  
  // Generar filas
  if (type === 'expired' || type === 'expiring') {
    tableHTML += data.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.product_name || item.name)}</strong></td>
        <td>${escapeHtml(item.product_type || '-')}</td>
        <td>${escapeHtml(item.category_name || '-')}</td>
        <td>${escapeHtml(item.lot_number || '-')}</td>
        <td>${formatDate(item.expiry_date)}</td>
        <td>${item.quantity || item.total_stock || 0}</td>
        <td>
          <span class="badge ${item.days_to_expiry < 0 ? 'badge-danger' : item.days_to_expiry <= 7 ? 'badge-danger' : item.days_to_expiry <= 30 ? 'badge-warning' : 'badge-info'}">
            ${item.days_to_expiry !== undefined ? item.days_to_expiry : '-'}
          </span>
        </td>
      </tr>
    `).join('');
  } else if (type === 'low-stock') {
    tableHTML += data.map(item => {
      const deficit = (item.min_stock || 0) - (item.current_stock || 0);
      const statusClass = item.current_stock === 0 ? 'badge-danger' : 'badge-warning';
      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${escapeHtml(item.product_type || '-')}</td>
          <td>${escapeHtml(item.category_name || '-')}</td>
          <td><span class="stock-badge ${item.current_stock === 0 ? 'stock-zero' : 'stock-low'}">${item.current_stock || 0}</span></td>
          <td>${item.min_stock || 0}</td>
          <td><strong class="text-danger">${deficit}</strong></td>
          <td><span class="badge ${statusClass}">${item.current_stock === 0 ? 'Sin Stock' : 'Stock Bajo'}</span></td>
        </tr>
      `;
    }).join('');
  } else if (type === 'consumption-by-area') {
    tableHTML += data.map(item => {
      const avgPerRemoval = item.total_removals > 0 ? (item.total_consumed / item.total_removals).toFixed(2) : 0;
      return `
        <tr>
          <td><strong>${escapeHtml(item.area_name || '-')}</strong></td>
          <td>${item.total_removals || 0}</td>
          <td><strong>${item.total_consumed || 0}</strong></td>
          <td>${item.unique_products || 0}</td>
          <td>${avgPerRemoval}</td>
        </tr>
      `;
    }).join('');
  }
  
  tableHTML += '</tbody></table>';
  return tableHTML;
}

function renderReportChart(data, type, canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  
  let chartConfig = {};
  
  switch(type) {
    case 'expired':
    case 'expiring':
      // Gráfico por categoría
      const byCategory = {};
      data.forEach(item => {
        const cat = item.category_name || 'Sin categoría';
        byCategory[cat] = (byCategory[cat] || 0) + (item.quantity || 0);
      });
      chartConfig = {
        type: 'bar',
        data: {
          labels: Object.keys(byCategory),
          datasets: [{
            label: 'Cantidad por Categoría',
            data: Object.values(byCategory),
            backgroundColor: '#4a90e2'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      };
      break;
    case 'consumption-by-area':
      chartConfig = {
        type: 'bar',
        data: {
          labels: data.map(d => d.area_name || 'Sin área'),
          datasets: [{
            label: 'Consumo Total',
            data: data.map(d => d.total_consumed || 0),
            backgroundColor: '#4a90e2'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      };
      break;
  }
  
  if (chartConfig.type) {
    new Chart(ctx, chartConfig);
  }
}

function renderComparisonReport(title, data1, data2, start1, end1, start2, end2, metric) {
  const container = document.getElementById('reportResults');
  if (!container) return;
  
  container.innerHTML = `
    <div class="report-results">
      <div class="report-header">
        <h4>${title}</h4>
        <button class="btn btn-sm btn-primary" onclick="exportComparisonToCSV()">📥 Exportar CSV</button>
      </div>
      <div class="comparison-container">
        <div class="comparison-period">
          <h5>Período 1: ${start1} a ${end1}</h5>
          <div class="comparison-metrics">
            <div class="metric-box">
              <div class="metric-value">${data1.reduce((sum, d) => sum + (d.total_consumed || 0), 0)}</div>
              <div class="metric-label">Total Consumido</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${data1.length}</div>
              <div class="metric-label">Áreas Activas</div>
            </div>
          </div>
        </div>
        <div class="comparison-period">
          <h5>Período 2: ${start2} a ${end2}</h5>
          <div class="comparison-metrics">
            <div class="metric-box">
              <div class="metric-value">${data2.reduce((sum, d) => sum + (d.total_consumed || 0), 0)}</div>
              <div class="metric-label">Total Consumido</div>
            </div>
            <div class="metric-box">
              <div class="metric-value">${data2.length}</div>
              <div class="metric-label">Áreas Activas</div>
            </div>
          </div>
        </div>
      </div>
      <canvas id="comparisonChart" style="max-height: 400px; margin-top: 20px;"></canvas>
    </div>
  `;
  
  // Renderizar gráfico comparativo
  setTimeout(() => {
    const ctx = document.getElementById('comparisonChart');
    if (ctx && typeof Chart !== 'undefined') {
      const areas = [...new Set([...data1.map(d => d.area_name), ...data2.map(d => d.area_name)])];
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: areas,
          datasets: [
            {
              label: `Período 1 (${start1} a ${end1})`,
              data: areas.map(area => {
                const item = data1.find(d => d.area_name === area);
                return item ? item.total_consumed : 0;
              }),
              backgroundColor: '#4a90e2'
            },
            {
              label: `Período 2 (${start2} a ${end2})`,
              data: areas.map(area => {
                const item = data2.find(d => d.area_name === area);
                return item ? item.total_consumed : 0;
              }),
              backgroundColor: '#ff9800'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  }, 100);
}

function renderAreaComparisonReport(areaIds, areaData, period) {
  const container = document.getElementById('reportResults');
  if (!container) return;
  
  // Obtener nombres de áreas
  apiMedical.getAllAreas().then(areas => {
    const areaNames = areaIds.map(id => {
      const area = areas.find(a => a.id == id);
      return area ? area.name : `Área ${id}`;
    });
    
    container.innerHTML = `
      <div class="report-results">
        <div class="report-header">
          <h4>Comparación de Áreas (Últimos ${period} días)</h4>
          <button class="btn btn-sm btn-primary" onclick="exportComparisonToCSV()">📥 Exportar CSV</button>
        </div>
        <div class="comparison-container">
          ${areaData.map((data, index) => {
            const areaInfo = data.success ? data.data[0] : {};
            return `
              <div class="comparison-period">
                <h5>${areaNames[index]}</h5>
                <div class="comparison-metrics">
                  <div class="metric-box">
                    <div class="metric-value">${areaInfo.total_consumed || 0}</div>
                    <div class="metric-label">Total Consumido</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-value">${areaInfo.total_removals || 0}</div>
                    <div class="metric-label">Total Retiros</div>
                  </div>
                  <div class="metric-box">
                    <div class="metric-value">${areaInfo.unique_products || 0}</div>
                    <div class="metric-label">Productos Únicos</div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <canvas id="areaComparisonChart" style="max-height: 400px; margin-top: 20px;"></canvas>
      </div>
    `;
    
    // Renderizar gráfico
    setTimeout(() => {
      const ctx = document.getElementById('areaComparisonChart');
      if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: areaNames,
            datasets: [{
              label: 'Consumo Total',
              data: areaData.map(d => d.success && d.data[0] ? d.data[0].total_consumed : 0),
              backgroundColor: '#4a90e2'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }, 100);
  });
}

function renderSummaryReport(data) {
  const container = document.getElementById('reportResults');
  if (!container) return;
  
  container.innerHTML = `
    <div class="report-results">
      <div class="report-header">
        <h4>Resumen Ejecutivo del Inventario</h4>
        <button class="btn btn-sm btn-primary" onclick="exportSummaryToCSV()">📥 Exportar CSV</button>
      </div>
      
      <div class="summary-executive">
        <h5>Métricas Generales</h5>
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="metric-card">
            <div class="metric-value">${data.stats.total_products || 0}</div>
            <div class="metric-label">Total Productos</div>
          </div>
          <div class="metric-card critical">
            <div class="metric-value">${data.stats.expired_products || 0}</div>
            <div class="metric-label">Productos Vencidos</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-value">${data.stats.expiring_soon || 0}</div>
            <div class="metric-label">Por Vencer</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-value">${data.stats.low_stock_products || 0}</div>
            <div class="metric-label">Stock Bajo</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.stats.total_stock || 0}</div>
            <div class="metric-label">Stock Total</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${data.stats.total_alerts || 0}</div>
            <div class="metric-label">Alertas Activas</div>
          </div>
        </div>
        
        <h5 style="margin-top: 30px;">Resumen por Categoría</h5>
        <div class="table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Productos</th>
                <th>Stock Total</th>
                <th>Lotes Vencidos</th>
                <th>Lotes por Vencer</th>
              </tr>
            </thead>
            <tbody>
              ${generateCategorySummary(data)}
            </tbody>
          </table>
        </div>
        
        <h5 style="margin-top: 30px;">Top 5 Áreas por Consumo</h5>
        <div class="table-container">
          <table class="report-table">
            <thead>
              <tr>
                <th>Área</th>
                <th>Total Consumido</th>
                <th>Retiros</th>
                <th>Productos Únicos</th>
              </tr>
            </thead>
            <tbody>
              ${data.consumption.slice(0, 5).map(item => `
                <tr>
                  <td>${escapeHtml(item.area_name || '-')}</td>
                  <td><strong>${item.total_consumed || 0}</strong></td>
                  <td>${item.total_removals || 0}</td>
                  <td>${item.unique_products || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function generateCategorySummary(data) {
  // Agrupar por categoría
  const byCategory = {};
  
  // Productos
  data.lowStock.forEach(product => {
    const cat = product.category_name || 'Sin categoría';
    if (!byCategory[cat]) {
      byCategory[cat] = { products: 0, stock: 0, expired: 0, expiring: 0 };
    }
    byCategory[cat].products++;
    byCategory[cat].stock += product.current_stock || 0;
  });
  
  // Lotes vencidos y por vencer
  data.expired.forEach(batch => {
    const cat = batch.category_name || 'Sin categoría';
    if (!byCategory[cat]) {
      byCategory[cat] = { products: 0, stock: 0, expired: 0, expiring: 0 };
    }
    byCategory[cat].expired++;
  });
  
  data.expiring.forEach(batch => {
    const cat = batch.category_name || 'Sin categoría';
    if (!byCategory[cat]) {
      byCategory[cat] = { products: 0, stock: 0, expired: 0, expiring: 0 };
    }
    byCategory[cat].expiring++;
  });
  
  return Object.keys(byCategory).map(cat => `
    <tr>
      <td><strong>${escapeHtml(cat)}</strong></td>
      <td>${byCategory[cat].products}</td>
      <td>${byCategory[cat].stock}</td>
      <td><span class="badge badge-danger">${byCategory[cat].expired}</span></td>
      <td><span class="badge badge-warning">${byCategory[cat].expiring}</span></td>
    </tr>
  `).join('');
}

function showCustomReportBuilder() {
  const modal = document.createElement('div');
  modal.id = 'customReportModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeModal('customReportModal')">&times;</span>
      <h2>Constructor de Reporte Personalizado</h2>
      <div class="form-group">
        <label>Tipo de reporte base:</label>
        <select id="customReportType" class="form-select" onchange="updateCustomReportFields()">
          <option value="">Seleccionar tipo...</option>
          <option value="consumption">Consumo</option>
          <option value="stock">Stock</option>
          <option value="expiry">Vencimientos</option>
          <option value="traceability">Trazabilidad</option>
        </select>
      </div>
      <div id="customReportFields"></div>
      <div class="form-actions">
        <button onclick="generateCustomReport()" class="btn btn-primary">Generar Reporte</button>
        <button onclick="closeModal('customReportModal')" class="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function updateCustomReportFields() {
  const type = document.getElementById('customReportType')?.value;
  const container = document.getElementById('customReportFields');
  if (!container) return;
  
  if (!type) {
    container.innerHTML = '';
    return;
  }
  
  let fieldsHTML = '';
  
  switch(type) {
    case 'consumption':
      fieldsHTML = `
        <div class="form-group">
          <label>Rango de fechas:</label>
          <div class="form-row">
            <input type="date" id="customStartDate" class="form-control">
            <input type="date" id="customEndDate" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label>Filtrar por área:</label>
          <select id="customArea" class="form-select">
            <option value="">Todas las áreas</option>
          </select>
        </div>
        <div class="form-group">
          <label>Filtrar por producto:</label>
          <select id="customProduct" class="form-select">
            <option value="">Todos los productos</option>
          </select>
        </div>
      `;
      loadAreasForReport();
      loadProductsForReport();
      break;
    case 'stock':
      fieldsHTML = `
        <div class="form-group">
          <label>Filtrar por categoría:</label>
          <select id="customCategory" class="form-select">
            <option value="">Todas las categorías</option>
          </select>
        </div>
        <div class="form-group">
          <label>Filtrar por tipo:</label>
          <select id="customProductType" class="form-select">
            <option value="">Todos los tipos</option>
            <option value="medicamento">Medicamento</option>
            <option value="insumo">Insumo Médico</option>
          </select>
        </div>
        <div class="form-group">
          <label>Mostrar solo productos con stock bajo:</label>
          <input type="checkbox" id="customLowStock" checked>
        </div>
      `;
      loadCategoriesForReport();
      break;
    case 'expiry':
      fieldsHTML = `
        <div class="form-group">
          <label>Días a considerar:</label>
          <input type="number" id="customDays" class="form-control" value="30" min="1" max="365">
        </div>
        <div class="form-group">
          <label>Incluir productos vencidos:</label>
          <input type="checkbox" id="customIncludeExpired" checked>
        </div>
        <div class="form-group">
          <label>Filtrar por categoría:</label>
          <select id="customCategory" class="form-select">
            <option value="">Todas las categorías</option>
          </select>
        </div>
      `;
      loadCategoriesForReport();
      break;
  }
  
  container.innerHTML = fieldsHTML;
}

async function loadProductsForReport() {
  try {
    const products = await apiMedical.getAllProducts();
    const select = document.getElementById('customProduct');
    if (select) {
      products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
}

async function generateCustomReport() {
  const type = document.getElementById('customReportType')?.value;
  if (!type) {
    showNotification('Selecciona un tipo de reporte', 'warning');
    return;
  }
  
  try {
    showLoading(true);
    closeModal('customReportModal');
    
    let data = [];
    let title = 'Reporte Personalizado';
    
    switch(type) {
      case 'consumption':
        const startDate = document.getElementById('customStartDate')?.value;
        const endDate = document.getElementById('customEndDate')?.value;
        const areaId = document.getElementById('customArea')?.value || '';
        const productId = document.getElementById('customProduct')?.value || '';
        
        if (!startDate || !endDate) {
          showNotification('Selecciona un rango de fechas', 'warning');
          return;
        }
        
        let url = `/api/traceability?start_date=${startDate}&end_date=${endDate}`;
        if (areaId) url += `&area_id=${areaId}`;
        if (productId) url += `&product_id=${productId}`;
        
        const response = await fetch(url);
        const result = await response.json();
        data = result.success ? result.data : [];
        title = `Consumo Personalizado (${startDate} a ${endDate})`;
        break;
      case 'stock':
        // Similar a low-stock pero con filtros personalizados
        const categoryId = document.getElementById('customCategory')?.value || '';
        const productType = document.getElementById('customProductType')?.value || '';
        const lowStockOnly = document.getElementById('customLowStock')?.checked || false;
        
        const response2 = await fetch('/api/reports/low-stock');
        const result2 = await response2.json();
        data = result2.success ? result2.data : [];
        if (categoryId) data = data.filter(p => p.category_id == categoryId);
        if (productType) data = data.filter(p => p.product_type === productType);
        if (lowStockOnly) data = data.filter(p => p.current_stock <= p.min_stock);
        title = 'Stock Personalizado';
        break;
      case 'expiry':
        const days = parseInt(document.getElementById('customDays')?.value || 30);
        const includeExpired = document.getElementById('customIncludeExpired')?.checked || false;
        const categoryId2 = document.getElementById('customCategory')?.value || '';
        
        if (includeExpired) {
          const [expiredData, expiringData] = await Promise.all([
            fetch('/api/reports/expired').then(r => r.json()),
            fetch(`/api/reports/expiring?days=${days}`).then(r => r.json())
          ]);
          data = [
            ...(expiredData.success ? expiredData.data : []),
            ...(expiringData.success ? expiringData.data : [])
          ];
        } else {
          const response3 = await fetch(`/api/reports/expiring?days=${days}`);
          const result3 = await response3.json();
          data = result3.success ? result3.data : [];
        }
        
        if (categoryId2) {
          data = data.filter(item => item.category_id == categoryId2);
        }
        title = `Vencimientos Personalizado (${days} días)`;
        break;
    }
    
    renderAdvancedReportResults(title, data, type, {}, true);
    
  } catch (error) {
    showNotification(`Error al generar reporte: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function exportReportToCSV(title, data) {
  if (!data || data.length === 0) {
    showNotification('No hay datos para exportar', 'warning');
    return;
  }
  
  // Determinar columnas según el tipo de reporte
  const headers = Object.keys(data[0]);
  const rows = data.map(item => headers.map(header => item[header] || ''));
  
  const csv = [
    [title],
    [],
    headers,
    ...rows
  ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  
  downloadCSV(csv, `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
}

function exportComparisonToCSV() {
  // Implementar exportación de comparación
  showNotification('Exportación de comparación en desarrollo', 'info');
}

function exportSummaryToCSV() {
  // Implementar exportación de resumen
  showNotification('Exportación de resumen en desarrollo', 'info');
}

function printReport() {
  window.print();
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('Reporte exportado correctamente', 'success');
}

// Funciones de utilidad
if (typeof window.escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
}

if (typeof window.formatDate === 'undefined') {
  window.formatDate = function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  };
}

if (typeof window.formatDateTime === 'undefined') {
  window.formatDateTime = function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES');
  };
}

if (typeof window.showLoading === 'undefined') {
  window.showLoading = function(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
  };
}

if (typeof window.showNotification === 'undefined') {
  window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };
}

if (typeof window.closeModal === 'undefined') {
  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };
}

// Mantener compatibilidad con función antigua
async function generateReport(type) {
  currentReportType = type;
  await executeReport();
}

function exportToCSV(title, data) {
  exportReportToCSV(title, data);
}

// Exportar funciones globalmente
window.loadReports = loadReports;
window.showReportConfig = showReportConfig;
window.executeReport = executeReport;
window.generateReport = generateReport;
window.generateCustomReport = generateCustomReport;
window.showCustomReportBuilder = showCustomReportBuilder;
window.updateCustomReportFields = updateCustomReportFields;
window.exportReportToCSV = exportReportToCSV;
window.exportComparisonToCSV = exportComparisonToCSV;
window.exportSummaryToCSV = exportSummaryToCSV;
window.printReport = printReport;

async function generateReport(type) {
  try {
    showLoading(true);
    const resultsContainer = document.getElementById('reportResults');
    resultsContainer.innerHTML = '<p>Generando reporte...</p>';
    
    let data = [];
    let title = '';
    
    switch(type) {
      case 'expired':
        const response1 = await fetch('/api/reports/expired');
        const result1 = await response1.json();
        data = result1.success ? result1.data : [];
        title = 'Productos Vencidos';
        break;
      case 'expiring':
        const response2 = await fetch('/api/reports/expiring?days=30');
        const result2 = await response2.json();
        data = result2.success ? result2.data : [];
        title = 'Productos por Vencer (Próximos 30 días)';
        break;
      case 'low-stock':
        const response3 = await fetch('/api/reports/low-stock');
        const result3 = await response3.json();
        data = result3.success ? result3.data : [];
        title = 'Productos con Stock Bajo';
        break;
      case 'predictions':
        const response4 = await fetch('/api/reports/predictions?period=month');
        const result4 = await response4.json();
        data = result4.success ? result4.data : [];
        title = 'Predicciones de Consumo (Próximo Mes)';
        break;
      case 'traceability':
        const response5 = await fetch('/api/reports/traceability');
        const result5 = await response5.json();
        data = result5.success ? result5.data : [];
        title = 'Trazabilidad Completa';
        break;
      case 'consumption-by-area':
        const response6 = await fetch('/api/reports/consumption-by-area?days=30');
        const result6 = await response6.json();
        data = result6.success ? result6.data : [];
        title = 'Consumo por Área (Últimos 30 días)';
        break;
      default:
        showNotification('Tipo de reporte no válido', 'error');
        return;
    }
    
    renderReportResults(title, data, type);
    
  } catch (error) {
    showNotification(`Error al generar reporte: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderReportResults(title, data, type) {
  const container = document.getElementById('reportResults');
  
  if (data.length === 0) {
    container.innerHTML = `<div class="report-results"><h4>${title}</h4><p class="text-muted">No hay datos para mostrar</p></div>`;
    return;
  }
  
  let tableHTML = `
    <div class="report-results">
      <div class="report-header">
        <h4>${title}</h4>
        <button class="btn btn-sm btn-primary" onclick="exportToCSV('${title}', ${JSON.stringify(data).replace(/"/g, '&quot;')})">
          📥 Exportar CSV
        </button>
      </div>
      <div class="table-container">
        <table class="report-table">
  `;
  
  // Generar encabezados según tipo
  if (type === 'expired' || type === 'expiring') {
    tableHTML += `
      <thead>
        <tr>
          <th>Producto</th>
          <th>Tipo</th>
          <th>Categoría</th>
          <th>Lote</th>
          <th>Fecha Vencimiento</th>
          <th>Cantidad</th>
          <th>Días Restantes</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td>${escapeHtml(item.product_name || item.name)}</td>
            <td>${escapeHtml(item.product_type || '-')}</td>
            <td>${escapeHtml(item.category_name || '-')}</td>
            <td>${escapeHtml(item.lot_number || '-')}</td>
            <td>${formatDate(item.expiry_date)}</td>
            <td>${item.quantity || item.total_stock || 0}</td>
            <td>${item.days_to_expiry !== undefined ? item.days_to_expiry : '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  } else if (type === 'traceability') {
    tableHTML += `
      <thead>
        <tr>
          <th>Fecha/Hora</th>
          <th>Producto</th>
          <th>Lote</th>
          <th>Área</th>
          <th>Acción</th>
          <th>Stock Anterior</th>
          <th>Stock Nuevo</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td>${formatDateTime(item.created_at)}</td>
            <td>${escapeHtml(item.product_name || '-')}</td>
            <td>${escapeHtml(item.lot_number || '-')}</td>
            <td>${escapeHtml(item.area_name || '-')}</td>
            <td>${escapeHtml(item.action || '-')}</td>
            <td>${item.previous_stock || 0}</td>
            <td>${item.new_stock || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  } else if (type === 'consumption-by-area') {
    tableHTML += `
      <thead>
        <tr>
          <th>Área</th>
          <th>Total Retiros</th>
          <th>Total Consumido</th>
          <th>Productos Únicos</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td>${escapeHtml(item.area_name || '-')}</td>
            <td>${item.total_removals || 0}</td>
            <td>${item.total_consumed || 0}</td>
            <td>${item.unique_products || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
  } else if (type === 'predictions') {
    tableHTML += `
      <thead>
        <tr>
          <th>Producto</th>
          <th>Área</th>
          <th>Período</th>
          <th>Stock Actual</th>
          <th>Predicción</th>
          <th>Confianza</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => {
          const stock = item.current_stock || 0;
          const predicted = item.predicted_quantity || 0;
          const status = stock >= predicted ? 'Suficiente' : 'Insuficiente';
          return `
            <tr>
              <td>${escapeHtml(item.product_name || '-')}</td>
              <td>${escapeHtml(item.area_name || 'General')}</td>
              <td>${escapeHtml(item.prediction_period || '-')}</td>
              <td>${stock}</td>
              <td>${Math.round(predicted)}</td>
              <td>${item.confidence_level || 0}%</td>
              <td class="${stock >= predicted ? 'text-success' : 'text-danger'}">${status}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  } else if (type === 'low-stock') {
    tableHTML += `
      <thead>
        <tr>
          <th>Producto</th>
          <th>Categoría</th>
          <th>Stock Actual</th>
          <th>Stock Mínimo</th>
          <th>Diferencia</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => {
          const stock = item.current_stock || item.total_stock || 0;
          const min = item.min_stock || 0;
          return `
            <tr>
              <td>${escapeHtml(item.name)}</td>
              <td>${escapeHtml(item.category_name || '-')}</td>
              <td>${stock}</td>
              <td>${min}</td>
              <td class="${stock < min ? 'text-danger' : ''}">${stock - min}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;
  }
  
  tableHTML += `
        </table>
      </div>
      <p class="report-summary">Total de registros: ${data.length}</p>
    </div>
  `;
  
  container.innerHTML = tableHTML;
}

function exportToCSV(title, data) {
  if (!data || data.length === 0) {
    showNotification('No hay datos para exportar', 'warning');
    return;
  }
  
  // Crear CSV
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(','))
  ].join('\n');
  
  // Descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('Reporte exportado correctamente', 'success');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('es-ES');
}

// Funciones de utilidad si no están disponibles
if (typeof window.escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
}

if (typeof window.formatDate === 'undefined') {
  window.formatDate = function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES');
  };
}

if (typeof window.formatDateTime === 'undefined') {
  window.formatDateTime = function(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES');
  };
}

if (typeof window.showLoading === 'undefined') {
  window.showLoading = function(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = show ? 'flex' : 'none';
  };
}

if (typeof window.showNotification === 'undefined') {
  window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };
}

// Sobrescribir función placeholder
window.loadReports = loadReports;
window.generateReport = generateReport;
window.exportToCSV = exportToCSV;


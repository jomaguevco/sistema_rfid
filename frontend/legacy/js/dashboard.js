// Dashboard médico
let categoryChart = null;
let expiryChart = null;
let consumptionChart = null;
let trendsChart = null;

async function refreshDashboard() {
  try {
    showLoading(true);
    
    // Obtener rango de fechas seleccionado
    const dateRange = getSelectedDateRange();
    
    // Cargar estadísticas
    const stats = await apiMedical.getDashboardStats(dateRange);
    updateMetrics(stats);
    
    // Cargar productos por vencer
    const expiring = await apiMedical.getExpiringProducts(30);
    renderExpiringProducts(expiring);
    
    // Cargar alertas prioritarias
    const alerts = await apiMedical.getActiveAlerts();
    renderPriorityAlerts(alerts.slice(0, 10));
    updateAlertsBadge(alerts.length);
    
    // Cargar gráficos
    await loadCharts(dateRange);
    
    // Cargar consumo por área si está disponible
    if (typeof apiMedical.getConsumptionByArea === 'function') {
      const consumption = await apiMedical.getConsumptionByArea(dateRange.days || 30);
      renderConsumptionChart(consumption);
    }
    
  } catch (error) {
    console.error('Error al refrescar dashboard:', error);
    showNotification(`Error al cargar dashboard: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function getSelectedDateRange() {
  const range = document.getElementById('dashboardDateRange')?.value || 'month';
  const startDate = document.getElementById('dashboardStartDate');
  const endDate = document.getElementById('dashboardEndDate');
  
  if (range === 'custom') {
    startDate.style.display = 'inline-block';
    endDate.style.display = 'inline-block';
    return {
      start: startDate.value || new Date().toISOString().split('T')[0],
      end: endDate.value || new Date().toISOString().split('T')[0],
      type: 'custom'
    };
  } else {
    startDate.style.display = 'none';
    endDate.style.display = 'none';
    
    const today = new Date();
    let start, end, days;
    
    switch(range) {
      case 'today':
        start = end = today.toISOString().split('T')[0];
        days = 1;
        break;
      case 'week':
        start = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        days = 7;
        break;
      case 'month':
        start = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        days = 30;
        break;
      case 'quarter':
        start = new Date(today.setMonth(today.getMonth() - 3)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        days = 90;
        break;
      case 'year':
        start = new Date(today.setFullYear(today.getFullYear() - 1)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        days = 365;
        break;
      default:
        days = 30;
    }
    
    return { start, end, days, type: range };
  }
}

function updateMetrics(stats) {
  document.getElementById('metric-total-products').textContent = stats.total_products || 0;
  document.getElementById('metric-expired').textContent = stats.expired_products || 0;
  document.getElementById('metric-expiring').textContent = stats.expiring_soon || 0;
  document.getElementById('metric-low-stock').textContent = stats.low_stock_products || 0;
  document.getElementById('metric-total-stock').textContent = stats.total_stock || 0;
  document.getElementById('metric-alerts').textContent = stats.total_alerts || 0;
}

async function loadCharts(dateRange = {}) {
  try {
    // Verificar que Chart.js esté disponible antes de intentar renderizar gráficos
    if (typeof Chart === 'undefined') {
      console.error('Chart.js no está disponible. Esperando a que se cargue...');
      // Esperar un momento y reintentar
      setTimeout(() => {
        if (typeof Chart !== 'undefined') {
          loadCharts(dateRange);
        } else {
          console.error('Chart.js no se pudo cargar. Verifica la conexión a internet o la configuración CSP.');
        }
      }, 1000);
      return;
    }
    
    // Gráfico de productos por categoría
    const categoryData = await apiMedical.getProductsByCategory();
    renderCategoryChart(categoryData);
    
    // Gráfico de vencimientos con datos reales
    await renderExpiryChart();
    
    // Gráfico de consumo por área
    if (dateRange.days) {
      const consumption = await apiMedical.getConsumptionByArea(dateRange.days);
      renderConsumptionChart(consumption);
    }
  } catch (error) {
    console.error('Error al cargar gráficos:', error);
    // Si es un error de Chart no definido, mostrar mensaje más claro
    if (error.message && error.message.includes('Chart is not defined')) {
      console.error('Chart.js no está disponible. Verifica que el script se haya cargado desde el CDN.');
    }
  }
}

function renderConsumptionChart(data) {
  // Verificar que Chart.js esté disponible
  if (typeof Chart === 'undefined') {
    console.error('Chart.js no está disponible. Verifica que el script se haya cargado correctamente.');
    return;
  }
  
  const container = document.getElementById('consumptionChartContainer');
  if (!container) {
    // Crear contenedor si no existe
    const chartsGrid = document.querySelector('.charts-grid');
    if (chartsGrid) {
      const newContainer = document.createElement('div');
      newContainer.className = 'chart-card';
      newContainer.id = 'consumptionChartContainer';
      newContainer.innerHTML = '<h3>Consumo por Área</h3><canvas id="consumptionChart"></canvas>';
      chartsGrid.appendChild(newContainer);
    } else {
      return;
    }
  }
  
  const ctx = document.getElementById('consumptionChart');
  if (!ctx) return;
  
  if (consumptionChart) consumptionChart.destroy();
  
  consumptionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.area_name || 'Sin área'),
      datasets: [{
        label: 'Cantidad Consumida',
        data: data.map(d => d.total_consumption || 0),
        backgroundColor: '#4a90e2'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function comparePeriods() {
  // Mostrar modal de comparación de períodos
  const modal = document.createElement('div');
  modal.id = 'comparePeriodsModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px;">
      <span class="close" onclick="closeModal('comparePeriodsModal')">&times;</span>
      <h2>Comparar Períodos</h2>
      <div class="form-row">
        <div class="form-group">
          <label>Período 1 - Inicio</label>
          <input type="date" id="period1Start" class="form-control">
        </div>
        <div class="form-group">
          <label>Período 1 - Fin</label>
          <input type="date" id="period1End" class="form-control">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Período 2 - Inicio</label>
          <input type="date" id="period2Start" class="form-control">
        </div>
        <div class="form-group">
          <label>Período 2 - Fin</label>
          <input type="date" id="period2End" class="form-control">
        </div>
      </div>
      <div class="form-actions">
        <button onclick="executeComparison()" class="btn btn-primary">Comparar</button>
        <button onclick="closeModal('comparePeriodsModal')" class="btn btn-secondary">Cancelar</button>
      </div>
      <div id="comparisonResults" style="margin-top: 20px;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
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
}

async function executeComparison() {
  const period1Start = document.getElementById('period1Start').value;
  const period1End = document.getElementById('period1End').value;
  const period2Start = document.getElementById('period2Start').value;
  const period2End = document.getElementById('period2End').value;
  
  if (!period1Start || !period1End || !period2Start || !period2End) {
    showNotification('Por favor completa todas las fechas', 'error');
    return;
  }
  
  try {
    showLoading(true);
    
    // Obtener datos de consumo para ambos períodos
    const [period1Data, period2Data] = await Promise.all([
      fetch(`/api/dashboard/consumption-by-area?start_date=${period1Start}&end_date=${period1End}`).then(r => r.json()),
      fetch(`/api/dashboard/consumption-by-area?start_date=${period2Start}&end_date=${period2End}`).then(r => r.json())
    ]);
    
    // Renderizar comparación
    renderComparison(period1Data.data || [], period2Data.data || [], period1Start, period1End, period2Start, period2End);
    
  } catch (error) {
    console.error('Error al comparar períodos:', error);
    showNotification(`Error al comparar períodos: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderComparison(data1, data2, start1, end1, start2, end2) {
  const container = document.getElementById('comparisonResults');
  if (!container) return;
  
  // Crear gráfico comparativo
  const areas = [...new Set([...data1.map(d => d.area_name), ...data2.map(d => d.area_name)])];
  
  container.innerHTML = `
    <h3>Comparación de Consumo</h3>
    <canvas id="comparisonChart" style="max-height: 400px;"></canvas>
  `;
  
  const ctx = document.getElementById('comparisonChart');
  if (ctx && typeof Chart !== 'undefined') {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: areas,
        datasets: [
          {
            label: `Período 1 (${start1} a ${end1})`,
            data: areas.map(area => {
              const item = data1.find(d => d.area_name === area);
              return item ? item.total_consumption : 0;
            }),
            backgroundColor: '#4a90e2'
          },
          {
            label: `Período 2 (${start2} a ${end2})`,
            data: areas.map(area => {
              const item = data2.find(d => d.area_name === area);
              return item ? item.total_consumption : 0;
            }),
            backgroundColor: '#ff9800'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

function renderCategoryChart(data) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  
  // Verificar que Chart.js esté disponible
  if (typeof Chart === 'undefined') {
    console.error('Chart.js no está disponible. Verifica que el script se haya cargado correctamente.');
    return;
  }
  
  if (categoryChart) categoryChart.destroy();
  
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.category_name || 'Sin categoría'),
      datasets: [{
        data: data.map(d => d.product_count),
        backgroundColor: [
          '#2c5282', '#4a90e2', '#5ba3f5', '#6c757d',
          '#17a2b8', '#28a745', '#ff9800', '#6c757d'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

async function renderExpiryChart() {
  const ctx = document.getElementById('expiryChart');
  if (!ctx) return;
  
  // Verificar que Chart.js esté disponible
  if (typeof Chart === 'undefined') {
    console.error('Chart.js no está disponible. Verifica que el script se haya cargado correctamente.');
    return;
  }
  
  try {
    // Obtener datos reales de la API usando apiMedical
    let result;
    if (typeof apiMedical !== 'undefined' && apiMedical && typeof apiMedical.getExpiryDistribution === 'function') {
      const data = await apiMedical.getExpiryDistribution();
      result = { success: true, data: data };
    } else {
      // Fallback si apiMedical no está disponible
      const response = await fetch('/api/dashboard/expiry-distribution', {
        headers: typeof apiMedical !== 'undefined' && apiMedical ? apiMedical.getAuthHeaders() : {}
      });
      result = await response.json();
    }
    
    if (!result.success || !result.data || result.data.length === 0) {
      // Si no hay datos, mostrar gráfico vacío
      if (expiryChart) expiryChart.destroy();
      expiryChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Sin datos'],
          datasets: [{
            label: 'Productos por vencer',
            data: [0],
            backgroundColor: '#ccc'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });
      return;
    }
    
    const data = result.data;
    const labels = data.map(d => d.range_label);
    const values = data.map(d => d.batch_count);
    
    // Colores según urgencia (más profesionales)
    const backgroundColors = labels.map(label => {
      if (label === 'Vencidos') return '#d32f2f';
      if (label === '0-7 días') return '#ff9800';
      if (label === '8-15 días') return '#ffb74d';
      if (label === '16-30 días') return '#ffcc80';
      return '#4a90e2';
    });
    
    if (expiryChart) expiryChart.destroy();
    
    expiryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Lotes por vencer',
          data: values,
          backgroundColor: backgroundColors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function(context) {
                const index = context.dataIndex;
                return `Cantidad total: ${data[index].total_quantity} unidades`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error al cargar gráfico de vencimientos:', error);
  }
}

function renderExpiringProducts(products) {
  const container = document.getElementById('expiringProductsList');
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay productos por vencer en los próximos 30 días</p>';
    return;
  }
  
  container.innerHTML = products.slice(0, 10).map(product => {
    const days = product.days_to_expiry || 0;
    const badgeClass = days <= 7 ? 'badge-danger' : days <= 15 ? 'badge-warning' : 'badge-info';
    
    return `
      <div class="product-card">
        <div class="product-info">
          <strong>${escapeHtml(product.product_name)}</strong>
          <span class="badge ${badgeClass}">${days} días</span>
        </div>
        <div class="product-details">
          Lote: ${escapeHtml(product.lot_number)} | 
          Vence: ${formatDate(product.expiry_date)} | 
          Stock: ${product.quantity}
        </div>
      </div>
    `;
  }).join('');
}

function renderPriorityAlerts(alerts) {
  const container = document.getElementById('priorityAlertsList');
  if (!container) return;
  
  if (alerts.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay alertas activas</p>';
    return;
  }
  
  container.innerHTML = alerts.map(alert => {
    const severityClass = {
      'critical': 'alert-critical',
      'high': 'alert-high',
      'medium': 'alert-medium',
      'low': 'alert-low'
    }[alert.severity] || 'alert-medium';
    
    return `
      <div class="alert-item ${severityClass}">
        <div class="alert-icon">${getAlertIcon(alert.alert_type)}</div>
        <div class="alert-content">
          <strong>${escapeHtml(alert.message)}</strong>
          <small>${formatDate(alert.created_at)}</small>
        </div>
      </div>
    `;
  }).join('');
}

function getAlertIcon(type) {
  const icons = {
    'expired': '⚠️',
    'expiring_soon': '⏰',
    'low_stock': '📉',
    'prediction_insufficient': '📊',
    'no_rfid': '📡'
  };
  return icons[type] || '🔔';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES');
}

// Hacer funciones disponibles globalmente
if (typeof window.escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
}

if (typeof window.formatDate === 'undefined') {
  window.formatDate = formatDate;
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
window.refreshDashboard = refreshDashboard;


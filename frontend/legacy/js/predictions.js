// Módulo de predicciones mejorado
let predictionsChart = null;
let comparisonChart = null;
let trendChart = null;
let currentPredictionsData = [];

async function loadPredictions() {
  const container = document.getElementById('predictionsContent');
  if (!container) {
    console.error('Contenedor predictionsContent no encontrado');
    return;
  }
  
  try {
    showLoading(true);
    const period = document.getElementById('predictionPeriod')?.value || 'month';
    const areaId = document.getElementById('predictionArea')?.value || '';
    const viewMode = document.getElementById('predictionViewMode')?.value || 'table';
    
    container.innerHTML = '<p>Cargando predicciones...</p>';
    
    // Cargar áreas para el selector
    try {
      await loadAreasForPredictions();
    } catch (error) {
      console.warn('Error al cargar áreas para predicciones:', error);
      // Continuar aunque falle la carga de áreas
    }
    
    if (areaId) {
      // Predicciones por área específica
      const predictions = await apiMedical.getPredictionsByArea(period);
      currentPredictionsData = predictions;
      if (viewMode === 'chart') {
        renderPredictionsChart(predictions, container, period);
      } else {
        renderPredictionsByArea(predictions, container);
      }
    } else {
      // Predicciones generales - obtener predicciones guardadas
      let products;
      try {
        products = await apiMedical.getAllProducts();
      } catch (error) {
        throw new Error(`Error al cargar productos: ${error.message}`);
      }
      
      if (!products || products.length === 0) {
        container.innerHTML = `
          <div class="alert alert-info" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h4>No hay productos disponibles</h4>
            <p>No se pueden generar predicciones sin productos. Crea productos primero.</p>
          </div>
        `;
        return;
      }
      
      const predictions = await loadAllPredictionsData(products, period);
      currentPredictionsData = predictions;
      
      if (viewMode === 'chart') {
        renderPredictionsChart(predictions, container, period);
      } else if (viewMode === 'comparison') {
        renderPredictionsComparison(predictions, container, period);
      } else if (viewMode === 'trends') {
        renderPredictionsTrends(predictions, container);
      } else {
        await renderAllPredictions(products, period, container);
      }
    }
    
    // Mostrar alertas basadas en predicciones
    checkPredictionAlerts(currentPredictionsData);
    
  } catch (error) {
    console.error('Error al cargar predicciones:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar predicciones: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h4>Error al cargar predicciones</h4>
        <p>${errorMessage}</p>
        <button onclick="loadPredictions()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

async function loadAllPredictionsData(products, period) {
  const predictions = [];
  for (const product of products.slice(0, 50)) {
    try {
      const productPredictions = await apiMedical.getPredictions(product.id);
      const prediction = productPredictions.find(p => p.prediction_period === period);
      if (prediction) {
        predictions.push({
          ...prediction,
          product_name: product.name,
          current_stock: product.total_stock || 0,
          product_id: product.id
        });
      }
    } catch (error) {
      console.error(`Error al cargar predicción para producto ${product.id}:`, error);
    }
  }
  return predictions;
}

async function loadAreasForPredictions() {
  try {
    const areas = await apiMedical.getAllAreas();
    const select = document.getElementById('predictionArea');
    if (select) {
      select.innerHTML = '<option value="">Todas las áreas</option>';
      areas.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar áreas:', error);
  }
}

async function renderAllPredictions(products, period, container) {
  container.innerHTML = `
    <div class="predictions-header">
      <h3>Predicciones para el ${getPeriodLabel(period)}</h3>
      <p class="text-muted">Las predicciones se basan en el consumo histórico de los últimos 90 días</p>
    </div>
    <div class="predictions-summary-cards">
      <div class="summary-card">
        <div class="summary-value">${currentPredictionsData.length}</div>
        <div class="summary-label">Productos con Predicción</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-value">${currentPredictionsData.filter(p => (p.current_stock || 0) < (p.predicted_quantity || 0)).length}</div>
        <div class="summary-label">Stock Insuficiente</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${Math.round(currentPredictionsData.reduce((sum, p) => sum + (Number(p.confidence_level) || 0), 0) / currentPredictionsData.length || 0)}%</div>
        <div class="summary-label">Confianza Promedio</div>
      </div>
    </div>
    <div class="predictions-table-container">
      <table class="predictions-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Stock Actual</th>
            <th>Predicción</th>
            <th>Déficit</th>
            <th>Confianza</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="predictionsTableBody"></tbody>
      </table>
    </div>
  `;
  
  const tbody = document.getElementById('predictionsTableBody');
  if (!tbody) return;
  
  // Ordenar por déficit (mayor primero)
  const sortedPredictions = [...currentPredictionsData].sort((a, b) => {
    const deficitA = (a.predicted_quantity || 0) - (a.current_stock || 0);
    const deficitB = (b.predicted_quantity || 0) - (b.current_stock || 0);
    return deficitB - deficitA;
  });
  
  sortedPredictions.forEach(prediction => {
    const stock = Number(prediction.current_stock) || 0;
    const predicted = Number(prediction.predicted_quantity) || 0;
    const confidence = Number(prediction.confidence_level) || 0;
    const deficit = Math.max(0, predicted - stock);
    const status = stock >= predicted ? 'success' : 'warning';
    
    const row = document.createElement('tr');
    row.className = deficit > 0 ? 'prediction-insufficient' : '';
    row.innerHTML = `
      <td><strong>${escapeHtml(prediction.product_name || '-')}</strong></td>
      <td><span class="stock-badge">${stock}</span></td>
      <td><span class="prediction-badge">${Math.round(predicted)}</span></td>
      <td><span class="deficit-badge ${deficit > 0 ? 'deficit-warning' : ''}">${Math.round(deficit)}</span></td>
      <td>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${Math.min(100, Math.max(0, confidence))}%"></div>
          <span>${confidence.toFixed(1)}%</span>
        </div>
      </td>
      <td>
        <span class="badge badge-${status}">
          ${stock >= predicted ? 'Suficiente' : 'Insuficiente'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="regeneratePrediction(${prediction.product_id})">
          🔄 Regenerar
        </button>
        <button class="btn btn-sm btn-info" onclick="viewPredictionDetails(${prediction.product_id})">
          📊 Detalles
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  if (tbody.children.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay predicciones disponibles. Genera predicciones para ver los resultados.</td></tr>';
  }
}

function renderPredictionsChart(predictions, container, period) {
  if (predictions.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay predicciones para mostrar</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="predictions-header">
      <h3>Visualización Gráfica - ${getPeriodLabel(period)}</h3>
    </div>
    <div class="charts-grid" style="grid-template-columns: 1fr;">
      <div class="chart-card">
        <h4>Stock Actual vs Predicción</h4>
        <canvas id="predictionsChart" style="max-height: 400px;"></canvas>
      </div>
      <div class="chart-card">
        <h4>Distribución de Confianza</h4>
        <canvas id="confidenceChart" style="max-height: 300px;"></canvas>
      </div>
      <div class="chart-card">
        <h4>Top 10 Productos con Mayor Déficit</h4>
        <canvas id="deficitChart" style="max-height: 400px;"></canvas>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    renderStockVsPredictionChart(predictions);
    renderConfidenceChart(predictions);
    renderDeficitChart(predictions);
  }, 100);
}

function renderStockVsPredictionChart(predictions) {
  const ctx = document.getElementById('predictionsChart');
  if (!ctx || typeof Chart === 'undefined') return;
  
  // Limitar a top 15 productos para mejor visualización
  const sorted = [...predictions].sort((a, b) => {
    const deficitA = (a.predicted_quantity || 0) - (a.current_stock || 0);
    const deficitB = (b.predicted_quantity || 0) - (b.current_stock || 0);
    return deficitB - deficitA;
  }).slice(0, 15);
  
  if (predictionsChart) {
    predictionsChart.destroy();
  }
  
  predictionsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(p => p.product_name || 'Sin nombre'),
      datasets: [
        {
          label: 'Stock Actual',
          data: sorted.map(p => p.current_stock || 0),
          backgroundColor: '#4a90e2'
        },
        {
          label: 'Predicción',
          data: sorted.map(p => Math.round(p.predicted_quantity || 0)),
          backgroundColor: '#ff9800'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: { ticks: { maxRotation: 45, minRotation: 45 } }
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
}

function renderConfidenceChart(predictions) {
  const ctx = document.getElementById('confidenceChart');
  if (!ctx || typeof Chart === 'undefined') return;
  
  const ranges = {
    'Alta (80-100%)': predictions.filter(p => (Number(p.confidence_level) || 0) >= 80).length,
    'Media (50-79%)': predictions.filter(p => (Number(p.confidence_level) || 0) >= 50 && (Number(p.confidence_level) || 0) < 80).length,
    'Baja (<50%)': predictions.filter(p => (Number(p.confidence_level) || 0) < 50).length
  };
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(ranges),
      datasets: [{
        data: Object.values(ranges),
        backgroundColor: ['#28a745', '#ffc107', '#dc3545']
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

function renderDeficitChart(predictions) {
  const ctx = document.getElementById('deficitChart');
  if (!ctx || typeof Chart === 'undefined') return;
  
  const sorted = [...predictions]
    .map(p => ({
      name: p.product_name || 'Sin nombre',
      deficit: Math.max(0, (p.predicted_quantity || 0) - (p.current_stock || 0))
    }))
    .filter(p => p.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 10);
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(p => p.name),
      datasets: [{
        label: 'Déficit Estimado',
        data: sorted.map(p => Math.round(p.deficit)),
        backgroundColor: '#dc3545'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: { ticks: { maxRotation: 45, minRotation: 45 } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderPredictionsComparison(predictions, container, period) {
  container.innerHTML = `
    <div class="predictions-header">
      <h3>Comparación de Predicciones</h3>
      <p class="text-muted">Compara predicciones entre diferentes períodos</p>
    </div>
    <div class="comparison-controls">
      <select id="comparisonPeriod1" class="form-select">
        <option value="month">Mes</option>
        <option value="quarter">Trimestre</option>
        <option value="year">Año</option>
      </select>
      <span>vs</span>
      <select id="comparisonPeriod2" class="form-select">
        <option value="quarter">Trimestre</option>
        <option value="year">Año</option>
      </select>
      <button onclick="loadComparison()" class="btn btn-primary">Comparar</button>
    </div>
    <div class="chart-card">
      <canvas id="comparisonChart" style="max-height: 500px;"></canvas>
    </div>
  `;
  
  // Cargar comparación inicial
  setTimeout(() => loadComparison(), 100);
}

async function loadComparison() {
  const period1 = document.getElementById('comparisonPeriod1')?.value || 'month';
  const period2 = document.getElementById('comparisonPeriod2')?.value || 'quarter';
  
  try {
    showLoading(true);
    const products = await apiMedical.getAllProducts();
    const predictions1 = await loadAllPredictionsData(products, period1);
    const predictions2 = await loadAllPredictionsData(products, period2);
    
    renderComparisonChart(predictions1, predictions2, period1, period2);
  } catch (error) {
    showNotification(`Error al cargar comparación: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderComparisonChart(predictions1, predictions2, period1, period2) {
  const ctx = document.getElementById('comparisonChart');
  if (!ctx || typeof Chart === 'undefined') return;
  
  // Agrupar por producto
  const productMap = new Map();
  predictions1.forEach(p => {
    productMap.set(p.product_id, {
      name: p.product_name,
      period1: p.predicted_quantity || 0
    });
  });
  predictions2.forEach(p => {
    if (productMap.has(p.product_id)) {
      productMap.get(p.product_id).period2 = p.predicted_quantity || 0;
    }
  });
  
  const products = Array.from(productMap.values()).slice(0, 15);
  
  if (comparisonChart) {
    comparisonChart.destroy();
  }
  
  comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: products.map(p => p.name),
      datasets: [
        {
          label: getPeriodLabel(period1),
          data: products.map(p => Math.round(p.period1 || 0)),
          backgroundColor: '#4a90e2'
        },
        {
          label: getPeriodLabel(period2),
          data: products.map(p => Math.round(p.period2 || 0)),
          backgroundColor: '#ff9800'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
        x: { ticks: { maxRotation: 45, minRotation: 45 } }
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
}

function renderPredictionsTrends(predictions, container) {
  container.innerHTML = `
    <div class="predictions-header">
      <h3>Tendencias de Consumo</h3>
      <p class="text-muted">Análisis de tendencias históricas vs predicciones</p>
    </div>
    <div class="chart-card">
      <canvas id="trendsChart" style="max-height: 500px;"></canvas>
    </div>
    <div class="trends-summary">
      <h4>Resumen de Tendencias</h4>
      <div id="trendsSummary"></div>
    </div>
  `;
  
  // Cargar datos históricos y mostrar tendencias
  setTimeout(() => loadTrendsData(), 100);
}

async function loadTrendsData() {
  try {
    // Obtener historial de consumo de los últimos meses
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    const history = await apiMedical.getAllTraceability({
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      action: 'remove'
    });
    
    // Agrupar por mes
    const monthlyConsumption = {};
    history.forEach(item => {
      const date = new Date(item.consumption_date || item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyConsumption[monthKey]) {
        monthlyConsumption[monthKey] = 0;
      }
      monthlyConsumption[monthKey] += Math.abs((item.previous_stock || 0) - (item.new_stock || 0));
    });
    
    renderTrendsChart(monthlyConsumption, currentPredictionsData);
  } catch (error) {
    console.error('Error al cargar tendencias:', error);
  }
}

function renderTrendsChart(monthlyData, predictions) {
  const ctx = document.getElementById('trendsChart');
  if (!ctx || typeof Chart === 'undefined') return;
  
  const months = Object.keys(monthlyData).sort();
  const consumption = months.map(m => monthlyData[m]);
  const predictedTotal = predictions.reduce((sum, p) => sum + (p.predicted_quantity || 0), 0);
  
  if (trendChart) {
    trendChart.destroy();
  }
  
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...months, 'Predicción'],
      datasets: [
        {
          label: 'Consumo Histórico',
          data: [...consumption, null],
          borderColor: '#4a90e2',
          backgroundColor: 'rgba(74, 144, 226, 0.1)',
          tension: 0.4
        },
        {
          label: 'Predicción',
          data: [...Array(months.length).fill(null), predictedTotal],
          borderColor: '#ff9800',
          borderDash: [5, 5],
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { display: true },
        tooltip: { mode: 'index', intersect: false }
      }
    }
  });
  
  // Mostrar resumen
  const summaryContainer = document.getElementById('trendsSummary');
  if (summaryContainer) {
    const avgConsumption = consumption.reduce((a, b) => a + b, 0) / consumption.length || 0;
    const trend = predictedTotal > avgConsumption ? 'creciente' : 'decreciente';
    const percentage = avgConsumption > 0 ? ((predictedTotal - avgConsumption) / avgConsumption * 100).toFixed(1) : 0;
    
    summaryContainer.innerHTML = `
      <div class="trend-metric">
        <strong>Consumo Promedio Histórico:</strong> ${Math.round(avgConsumption)} unidades
      </div>
      <div class="trend-metric">
        <strong>Predicción Total:</strong> ${Math.round(predictedTotal)} unidades
      </div>
      <div class="trend-metric ${trend === 'creciente' ? 'trend-up' : 'trend-down'}">
        <strong>Tendencia:</strong> ${trend} (${percentage > 0 ? '+' : ''}${percentage}%)
      </div>
    `;
  }
}

function checkPredictionAlerts(predictions) {
  const alerts = [];
  
  predictions.forEach(prediction => {
    const stock = prediction.current_stock || 0;
    const predicted = prediction.predicted_quantity || 0;
    const deficit = predicted - stock;
    
    if (deficit > 0) {
      const severity = deficit > predicted * 0.5 ? 'critical' : deficit > predicted * 0.3 ? 'high' : 'medium';
      alerts.push({
        product_id: prediction.product_id,
        product_name: prediction.product_name,
        deficit: Math.round(deficit),
        predicted: Math.round(predicted),
        severity: severity
      });
    }
  });
  
  if (alerts.length > 0) {
    showPredictionAlerts(alerts);
  }
}

function showPredictionAlerts(alerts) {
  const container = document.getElementById('predictionsContent');
  if (!container) return;
  
  const alertsHTML = `
    <div class="prediction-alerts">
      <h4>⚠️ Alertas de Predicción</h4>
      <div class="alerts-list">
        ${alerts.slice(0, 5).map(alert => `
          <div class="alert-item alert-${alert.severity}">
            <strong>${escapeHtml(alert.product_name)}</strong>
            <span>Déficit estimado: ${alert.deficit} unidades</span>
          </div>
        `).join('')}
      </div>
      ${alerts.length > 5 ? `<p class="text-muted">Y ${alerts.length - 5} alertas más...</p>` : ''}
    </div>
  `;
  
  // Insertar al inicio del contenido
  const existingContent = container.innerHTML;
  container.innerHTML = alertsHTML + existingContent;
}

async function viewPredictionDetails(productId) {
  try {
    showLoading(true);
    const predictions = await apiMedical.getPredictions(productId);
    const product = await apiMedical.getProductById(productId);
    
    const modal = document.createElement('div');
    modal.id = 'predictionDetailsModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <span class="close" onclick="closeModal('predictionDetailsModal')">&times;</span>
        <h2>Detalles de Predicción: ${escapeHtml(product.name)}</h2>
        <div class="prediction-details-content">
          <div class="detail-section">
            <h4>Stock Actual</h4>
            <div class="detail-value">${product.total_stock || 0} unidades</div>
          </div>
          <div class="detail-section">
            <h4>Predicciones por Período</h4>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Predicción</th>
                  <th>Confianza</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${predictions.map(p => {
                  const stock = product.total_stock || 0;
                  const predicted = p.predicted_quantity || 0;
                  const status = stock >= predicted ? 'Suficiente' : 'Insuficiente';
                  return `
                    <tr>
                      <td>${getPeriodLabel(p.prediction_period)}</td>
                      <td>${Math.round(predicted)} unidades</td>
                      <td>${(Number(p.confidence_level) || 0).toFixed(1)}%</td>
                      <td><span class="badge badge-${stock >= predicted ? 'success' : 'warning'}">${status}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="detail-section">
            <canvas id="productPredictionChart" style="max-height: 300px;"></canvas>
          </div>
        </div>
        <div class="form-actions">
          <button onclick="regeneratePrediction(${productId})" class="btn btn-primary">🔄 Regenerar Predicciones</button>
          <button onclick="closeModal('predictionDetailsModal')" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Renderizar gráfico
    setTimeout(() => {
      const ctx = document.getElementById('productPredictionChart');
      if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: predictions.map(p => getPeriodLabel(p.prediction_period)),
            datasets: [{
              label: 'Predicción',
              data: predictions.map(p => Math.round(p.predicted_quantity || 0)),
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
    
  } catch (error) {
    showNotification(`Error al cargar detalles: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderPredictionsByArea(predictions, container) {
  if (predictions.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay predicciones por área disponibles</p>';
    return;
  }
  
  const groupedByArea = {};
  predictions.forEach(p => {
    const areaName = p.area_name || 'General';
    if (!groupedByArea[areaName]) {
      groupedByArea[areaName] = [];
    }
    groupedByArea[areaName].push(p);
  });
  
  container.innerHTML = Object.keys(groupedByArea).map(areaName => {
    const areaPredictions = groupedByArea[areaName];
    return `
      <div class="area-predictions-card">
        <h3>${escapeHtml(areaName)}</h3>
        <div class="predictions-list">
          ${areaPredictions.map(p => {
            const stock = p.current_stock || 0;
            const predicted = p.predicted_quantity || 0;
            const status = stock >= predicted ? 'success' : 'warning';
            
            return `
              <div class="prediction-item">
                <div class="prediction-product">${escapeHtml(p.product_name)}</div>
                <div class="prediction-details">
                  <span>Stock: ${stock}</span>
                  <span>Predicción: ${Math.round(predicted)}</span>
                  <span class="badge badge-${status}">
                    ${stock >= predicted ? 'Suficiente' : 'Insuficiente'}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function generateAllPredictions() {
  if (!confirm('¿Generar predicciones para todos los productos? Esto puede tomar varios minutos.')) {
    return;
  }
  
  try {
    showLoading(true);
    const areaId = document.getElementById('predictionArea')?.value || null;
    const results = await apiMedical.generateAllPredictions(areaId ? parseInt(areaId) : null);
    
    const successCount = results.filter(r => r.success).length;
    showNotification(`Predicciones generadas: ${successCount} exitosas de ${results.length} productos`, 'success');
    
    await loadPredictions();
  } catch (error) {
    showNotification(`Error al generar predicciones: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function regeneratePrediction(productId) {
  try {
    showLoading(true);
    await apiMedical.generatePredictions(productId);
    showNotification('Predicción regenerada correctamente', 'success');
    await loadPredictions();
  } catch (error) {
    showNotification(`Error al regenerar predicción: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function getPeriodLabel(period) {
  const labels = {
    'month': 'próximo mes',
    'quarter': 'próximo trimestre',
    'year': 'próximo año'
  };
  return labels[period] || period;
}

// Asegurar que funciones de utilidad estén disponibles
if (typeof window.escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Exportar funciones globalmente
window.loadPredictions = loadPredictions;
window.generateAllPredictions = generateAllPredictions;
window.regeneratePrediction = regeneratePrediction;
window.viewPredictionDetails = viewPredictionDetails;
window.loadComparison = loadComparison;


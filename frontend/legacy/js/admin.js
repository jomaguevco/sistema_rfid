// Módulo de administración del sistema

let systemConfig = [];
let scheduledReports = [];

/**
 * Cargar vista de administración
 */
async function loadAdminView() {
  const section = document.getElementById('admin-section');
  if (!section) return;
  
  section.innerHTML = `
    <div class="admin-container">
      <h2>Panel de Administración</h2>
      
      <div class="admin-tabs">
        <button class="admin-tab-btn active" onclick="showAdminTab('config')">Configuración</button>
        <button class="admin-tab-btn" onclick="showAdminTab('scheduled-reports')">Reportes Programados</button>
        <button class="admin-tab-btn" onclick="showAdminTab('executive-dashboard')">Dashboard Ejecutivo</button>
      </div>
      
      <div id="admin-config-tab" class="admin-tab-content active">
        <div class="config-header">
          <h3>Configuración del Sistema</h3>
          <button class="btn btn-primary" onclick="showConfigForm()">
            <i class="icon">➕</i> Nueva Configuración
          </button>
        </div>
        <div id="config-list" class="config-list"></div>
      </div>
      
      <div id="admin-scheduled-reports-tab" class="admin-tab-content">
        <div class="reports-header">
          <h3>Reportes Programados</h3>
          <button class="btn btn-primary" onclick="showScheduledReportForm()">
            <i class="icon">➕</i> Nuevo Reporte Programado
          </button>
        </div>
        <div id="scheduled-reports-list" class="scheduled-reports-list"></div>
      </div>
      
      <div id="admin-executive-dashboard-tab" class="admin-tab-content">
        <div id="executive-dashboard-content"></div>
      </div>
    </div>
  `;
  
  await loadSystemConfig();
  await loadScheduledReports();
  await loadExecutiveDashboard();
}

/**
 * Mostrar tab de administración
 */
function showAdminTab(tabName) {
  // Ocultar todos los tabs
  document.querySelectorAll('.admin-tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Mostrar tab seleccionado
  const tabContent = document.getElementById(`admin-${tabName}-tab`);
  const tabBtn = event.target;
  
  if (tabContent) {
    tabContent.classList.add('active');
  }
  if (tabBtn) {
    tabBtn.classList.add('active');
  }
}

/**
 * Cargar configuraciones del sistema
 */
async function loadSystemConfig() {
  try {
    const result = await apiMedical.getSystemConfig();
    systemConfig = result.data || [];
    renderSystemConfig();
  } catch (error) {
    showNotification('Error al cargar configuraciones: ' + error.message, 'error');
  }
}

/**
 * Renderizar configuraciones
 */
function renderSystemConfig() {
  const container = document.getElementById('config-list');
  if (!container) return;
  
  if (systemConfig.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay configuraciones definidas</p>';
    return;
  }
  
  // Agrupar por categoría
  const grouped = systemConfig.reduce((acc, config) => {
    const category = config.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(config);
    return acc;
  }, {});
  
  container.innerHTML = Object.keys(grouped).map(category => `
    <div class="config-category">
      <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
      <div class="config-items">
        ${grouped[category].map(config => `
          <div class="config-item">
            <div class="config-info">
              <strong>${config.config_key}</strong>
              <span class="config-type">${config.config_type}</span>
              ${config.description ? `<p class="config-description">${config.description}</p>` : ''}
            </div>
            <div class="config-value">
              ${renderConfigValue(config)}
            </div>
            <div class="config-actions">
              ${config.is_editable ? `
                <button class="btn btn-sm" onclick="editConfig('${config.config_key}')">
                  <i class="icon">✏️</i> Editar
                </button>
              ` : '<span class="badge badge-info">Solo lectura</span>'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

/**
 * Renderizar valor de configuración
 */
function renderConfigValue(config) {
  switch (config.config_type) {
    case 'boolean':
      return `<span class="badge ${config.config_value === 'true' ? 'badge-success' : 'badge-secondary'}">${config.config_value === 'true' ? 'Sí' : 'No'}</span>`;
    case 'number':
      return `<span class="config-number">${config.config_value}</span>`;
    case 'json':
      return `<pre class="config-json">${JSON.stringify(JSON.parse(config.config_value || '{}'), null, 2)}</pre>`;
    default:
      return `<span class="config-string">${config.config_value || '(vacío)'}</span>`;
  }
}

/**
 * Mostrar formulario de configuración
 */
function showConfigForm(config = null) {
  const isEdit = !!config;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${isEdit ? 'Editar' : 'Nueva'} Configuración</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <form id="config-form">
          <div class="form-group">
            <label>Clave *</label>
            <input type="text" name="config_key" value="${config?.config_key || ''}" ${isEdit ? 'readonly' : ''} required>
          </div>
          <div class="form-group">
            <label>Valor *</label>
            <textarea name="config_value" rows="3" required>${config?.config_value || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select name="config_type">
              <option value="string" ${config?.config_type === 'string' ? 'selected' : ''}>String</option>
              <option value="number" ${config?.config_type === 'number' ? 'selected' : ''}>Number</option>
              <option value="boolean" ${config?.config_type === 'boolean' ? 'selected' : ''}>Boolean</option>
              <option value="json" ${config?.config_type === 'json' ? 'selected' : ''}>JSON</option>
            </select>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea name="description" rows="2">${config?.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <input type="text" name="category" value="${config?.category || 'general'}">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('config-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      if (isEdit) {
        await apiMedical.updateSystemConfig(data.config_key, data.config_value, data.description);
        showNotification('Configuración actualizada', 'success');
      } else {
        await apiMedical.createSystemConfig(data);
        showNotification('Configuración creada', 'success');
      }
      modal.remove();
      await loadSystemConfig();
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  });
}

/**
 * Editar configuración
 */
function editConfig(key) {
  const config = systemConfig.find(c => c.config_key === key);
  if (config) {
    showConfigForm(config);
  }
}

/**
 * Cargar reportes programados
 */
async function loadScheduledReports() {
  try {
    const result = await apiMedical.getScheduledReports();
    scheduledReports = result.data || [];
    renderScheduledReports();
  } catch (error) {
    showNotification('Error al cargar reportes programados: ' + error.message, 'error');
  }
}

/**
 * Renderizar reportes programados
 */
function renderScheduledReports() {
  const container = document.getElementById('scheduled-reports-list');
  if (!container) return;
  
  if (scheduledReports.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay reportes programados</p>';
    return;
  }
  
  container.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Tipo</th>
          <th>Programación</th>
          <th>Formato</th>
          <th>Estado</th>
          <th>Próxima Ejecución</th>
          <th>Última Ejecución</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${scheduledReports.map(report => {
          const scheduleConfig = typeof report.schedule_config === 'string' 
            ? JSON.parse(report.schedule_config) 
            : report.schedule_config || {};
          const scheduleText = getScheduleText(report.schedule_type, scheduleConfig);
          
          return `
            <tr>
              <td><strong>${report.report_name}</strong></td>
              <td><span class="badge badge-info">${report.report_type}</span></td>
              <td>${scheduleText}</td>
              <td><span class="badge badge-secondary">${report.format.toUpperCase()}</span></td>
              <td>${report.is_active 
                ? '<span class="badge badge-success">Activo</span>' 
                : '<span class="badge badge-secondary">Inactivo</span>'}</td>
              <td>${report.next_run_at ? new Date(report.next_run_at).toLocaleString('es-ES') : 'N/A'}</td>
              <td>${report.last_run_at ? new Date(report.last_run_at).toLocaleString('es-ES') : 'Nunca'}</td>
              <td>
                <button class="btn btn-sm" onclick="editScheduledReport(${report.id})">
                  <i class="icon">✏️</i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteScheduledReport(${report.id})">
                  <i class="icon">🗑️</i>
                </button>
                <button class="btn btn-sm" onclick="viewScheduledReportExecutions(${report.id})">
                  <i class="icon">📊</i>
                </button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Obtener texto de programación
 */
function getScheduleText(scheduleType, config) {
  switch (scheduleType) {
    case 'daily':
      return `Diario a las ${config.hour || 8}:${String(config.minute || 0).padStart(2, '0')}`;
    case 'weekly':
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return `Semanal: ${days[config.dayOfWeek || 1]} a las ${config.hour || 8}:${String(config.minute || 0).padStart(2, '0')}`;
    case 'monthly':
      return `Mensual: día ${config.dayOfMonth || 1} a las ${config.hour || 8}:${String(config.minute || 0).padStart(2, '0')}`;
    default:
      return scheduleType;
  }
}

/**
 * Mostrar formulario de reporte programado
 */
function showScheduledReportForm(report = null) {
  const isEdit = !!report;
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content modal-large">
      <div class="modal-header">
        <h3>${isEdit ? 'Editar' : 'Nuevo'} Reporte Programado</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <form id="scheduled-report-form">
          <div class="form-group">
            <label>Nombre del Reporte *</label>
            <input type="text" name="report_name" value="${report?.report_name || ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo de Reporte *</label>
              <select name="report_type" required>
                <option value="expired" ${report?.report_type === 'expired' ? 'selected' : ''}>Productos Vencidos</option>
                <option value="expiring" ${report?.report_type === 'expiring' ? 'selected' : ''}>Productos por Vencer</option>
                <option value="low_stock" ${report?.report_type === 'low_stock' ? 'selected' : ''}>Stock Bajo</option>
                <option value="traceability" ${report?.report_type === 'traceability' ? 'selected' : ''}>Trazabilidad</option>
                <option value="consumption_by_area" ${report?.report_type === 'consumption_by_area' ? 'selected' : ''}>Consumo por Área</option>
                <option value="predictions" ${report?.report_type === 'predictions' ? 'selected' : ''}>Predicciones</option>
              </select>
            </div>
            <div class="form-group">
              <label>Formato *</label>
              <select name="format" required>
                <option value="pdf" ${report?.format === 'pdf' ? 'selected' : ''}>PDF</option>
                <option value="excel" ${report?.format === 'excel' ? 'selected' : ''}>Excel</option>
                <option value="csv" ${report?.format === 'csv' ? 'selected' : ''}>CSV</option>
                <option value="json" ${report?.format === 'json' ? 'selected' : ''}>JSON</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Tipo de Programación *</label>
            <select name="schedule_type" id="schedule-type-select" required>
              <option value="daily" ${report?.schedule_type === 'daily' ? 'selected' : ''}>Diario</option>
              <option value="weekly" ${report?.schedule_type === 'weekly' ? 'selected' : ''}>Semanal</option>
              <option value="monthly" ${report?.schedule_type === 'monthly' ? 'selected' : ''}>Mensual</option>
            </select>
          </div>
          <div id="schedule-config-container"></div>
          <div class="form-group">
            <label>Destinatarios (emails separados por coma)</label>
            <input type="text" name="recipients" value="${report?.recipients || ''}" placeholder="email1@example.com, email2@example.com">
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="is_active" ${report?.is_active !== false ? 'checked' : ''}>
              Activo
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Renderizar configuración de programación
  renderScheduleConfig(report?.schedule_type || 'daily', report?.schedule_config);
  
  // Actualizar cuando cambie el tipo de programación
  document.getElementById('schedule-type-select').addEventListener('change', (e) => {
    renderScheduleConfig(e.target.value);
  });
  
  document.getElementById('scheduled-report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      report_name: formData.get('report_name'),
      report_type: formData.get('report_type'),
      format: formData.get('format'),
      schedule_type: formData.get('schedule_type'),
      schedule_config: getScheduleConfig(),
      recipients: formData.get('recipients') || null,
      is_active: formData.has('is_active'),
      filters: {}
    };
    
    try {
      if (isEdit) {
        await apiMedical.updateScheduledReport(report.id, data);
        showNotification('Reporte programado actualizado', 'success');
      } else {
        await apiMedical.createScheduledReport(data);
        showNotification('Reporte programado creado', 'success');
      }
      modal.remove();
      await loadScheduledReports();
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    }
  });
}

/**
 * Renderizar configuración de programación
 */
function renderScheduleConfig(scheduleType, existingConfig = {}) {
  const container = document.getElementById('schedule-config-container');
  if (!container) return;
  
  const config = typeof existingConfig === 'string' ? JSON.parse(existingConfig) : existingConfig;
  
  let html = '';
  switch (scheduleType) {
    case 'daily':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label>Hora</label>
            <input type="number" name="hour" min="0" max="23" value="${config.hour || 8}" required>
          </div>
          <div class="form-group">
            <label>Minuto</label>
            <input type="number" name="minute" min="0" max="59" value="${config.minute || 0}" required>
          </div>
        </div>
      `;
      break;
    case 'weekly':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label>Día de la Semana</label>
            <select name="dayOfWeek" required>
              <option value="1" ${config.dayOfWeek === 1 ? 'selected' : ''}>Lunes</option>
              <option value="2" ${config.dayOfWeek === 2 ? 'selected' : ''}>Martes</option>
              <option value="3" ${config.dayOfWeek === 3 ? 'selected' : ''}>Miércoles</option>
              <option value="4" ${config.dayOfWeek === 4 ? 'selected' : ''}>Jueves</option>
              <option value="5" ${config.dayOfWeek === 5 ? 'selected' : ''}>Viernes</option>
              <option value="6" ${config.dayOfWeek === 6 ? 'selected' : ''}>Sábado</option>
              <option value="0" ${config.dayOfWeek === 0 ? 'selected' : ''}>Domingo</option>
            </select>
          </div>
          <div class="form-group">
            <label>Hora</label>
            <input type="number" name="hour" min="0" max="23" value="${config.hour || 8}" required>
          </div>
          <div class="form-group">
            <label>Minuto</label>
            <input type="number" name="minute" min="0" max="59" value="${config.minute || 0}" required>
          </div>
        </div>
      `;
      break;
    case 'monthly':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label>Día del Mes</label>
            <input type="number" name="dayOfMonth" min="1" max="31" value="${config.dayOfMonth || 1}" required>
          </div>
          <div class="form-group">
            <label>Hora</label>
            <input type="number" name="hour" min="0" max="23" value="${config.hour || 8}" required>
          </div>
          <div class="form-group">
            <label>Minuto</label>
            <input type="number" name="minute" min="0" max="59" value="${config.minute || 0}" required>
          </div>
        </div>
      `;
      break;
  }
  
  container.innerHTML = html;
}

/**
 * Obtener configuración de programación del formulario
 */
function getScheduleConfig() {
  const scheduleType = document.getElementById('schedule-type-select')?.value;
  const container = document.getElementById('schedule-config-container');
  if (!container) return {};
  
  const inputs = container.querySelectorAll('input, select');
  const config = {};
  
  inputs.forEach(input => {
    if (input.name && input.value !== '') {
      config[input.name] = input.type === 'number' ? parseInt(input.value) : input.value;
    }
  });
  
  return config;
}

/**
 * Editar reporte programado
 */
function editScheduledReport(id) {
  const report = scheduledReports.find(r => r.id === id);
  if (report) {
    showScheduledReportForm(report);
  }
}

/**
 * Eliminar reporte programado
 */
async function deleteScheduledReport(id) {
  if (!confirm('¿Está seguro de eliminar este reporte programado?')) return;
  
  try {
    await apiMedical.deleteScheduledReport(id);
    showNotification('Reporte programado eliminado', 'success');
    await loadScheduledReports();
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

/**
 * Ver ejecuciones de reporte programado
 */
async function viewScheduledReportExecutions(reportId) {
  try {
    const result = await apiMedical.getScheduledReportExecutions(reportId);
    const executions = result.data || [];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Historial de Ejecuciones</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          ${executions.length === 0 
            ? '<p class="empty-state">No hay ejecuciones registradas</p>'
            : `
              <table class="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Registros</th>
                    <th>Tiempo</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  ${executions.map(exec => `
                    <tr>
                      <td>${new Date(exec.execution_date).toLocaleString('es-ES')}</td>
                      <td><span class="badge badge-${exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'danger' : 'warning'}">${exec.status}</span></td>
                      <td>${exec.records_generated || 0}</td>
                      <td>${exec.execution_time_ms ? `${exec.execution_time_ms}ms` : 'N/A'}</td>
                      <td>${exec.error_message || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (error) {
    showNotification('Error al cargar ejecuciones: ' + error.message, 'error');
  }
}

/**
 * Cargar dashboard ejecutivo
 */
async function loadExecutiveDashboard() {
  const container = document.getElementById('executive-dashboard-content');
  if (!container) return;
  
  try {
    // Obtener métricas ejecutivas
    const [statsResult, alertsResult, predictionsResult] = await Promise.all([
      apiMedical.getDashboardStats(),
      apiMedical.getActiveAlerts(),
      apiMedical.getPredictions({ period: 'month' })
    ]);
    
    const stats = statsResult.data || {};
    const alerts = alertsResult.data || [];
    const predictions = predictionsResult.data || [];
    
    container.innerHTML = `
      <div class="executive-dashboard">
        <h3>Vista Ejecutiva</h3>
        
        <div class="executive-metrics">
          <div class="metric-card">
            <div class="metric-value">${stats.total_products || 0}</div>
            <div class="metric-label">Productos Totales</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${stats.total_stock || 0}</div>
            <div class="metric-label">Stock Total</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${stats.expired_batches || 0}</div>
            <div class="metric-label">Lotes Vencidos</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${stats.expiring_soon_batches || 0}</div>
            <div class="metric-label">Por Vencer (30 días)</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${stats.low_stock_products || 0}</div>
            <div class="metric-label">Productos Stock Bajo</div>
          </div>
          <div class="metric-card">
            <div class="metric-value">${alerts.filter(a => a.severity === 'critical').length}</div>
            <div class="metric-label">Alertas Críticas</div>
          </div>
        </div>
        
        <div class="executive-charts">
          <div class="chart-container">
            <h4>Distribución de Stock por Categoría</h4>
            <canvas id="executive-category-chart"></canvas>
          </div>
          <div class="chart-container">
            <h4>Consumo por Área (Últimos 30 días)</h4>
            <canvas id="executive-area-chart"></canvas>
          </div>
        </div>
        
        <div class="executive-alerts">
          <h4>Alertas Prioritarias</h4>
          <div id="executive-alerts-list"></div>
        </div>
      </div>
    `;
    
    // Renderizar gráficos
    renderExecutiveCharts(stats, alerts);
    renderExecutiveAlerts(alerts);
  } catch (error) {
    container.innerHTML = `<p class="error">Error al cargar dashboard ejecutivo: ${error.message}</p>`;
  }
}

/**
 * Renderizar gráficos ejecutivos
 */
function renderExecutiveCharts(stats, alerts) {
  // Implementar gráficos con Chart.js si está disponible
  // Por ahora solo mostrar datos
}

/**
 * Renderizar alertas ejecutivas
 */
function renderExecutiveAlerts(alerts) {
  const container = document.getElementById('executive-alerts-list');
  if (!container) return;
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 10);
  
  if (criticalAlerts.length === 0) {
    container.innerHTML = '<p class="empty-state">No hay alertas prioritarias</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="alerts-list">
      ${criticalAlerts.map(alert => `
        <div class="alert-item alert-${alert.severity}">
          <div class="alert-icon">${getAlertIcon(alert.alert_type)}</div>
          <div class="alert-content">
            <strong>${alert.message}</strong>
            <span class="alert-date">${new Date(alert.created_at).toLocaleString('es-ES')}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Obtener icono de alerta
 */
function getAlertIcon(alertType) {
  const icons = {
    expired: '⚠️',
    expiring_soon: '⏰',
    low_stock: '📉',
    prediction_insufficient: '📊',
    no_rfid: '🏷️'
  };
  return icons[alertType] || '⚠️';
}

// Exportar funciones globalmente
window.loadAdminView = loadAdminView;
window.showAdminTab = showAdminTab;
window.showConfigForm = showConfigForm;
window.editConfig = editConfig;
window.showScheduledReportForm = showScheduledReportForm;
window.editScheduledReport = editScheduledReport;
window.deleteScheduledReport = deleteScheduledReport;
window.viewScheduledReportExecutions = viewScheduledReportExecutions;


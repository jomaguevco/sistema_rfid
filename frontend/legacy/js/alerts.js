// Módulo de alertas
async function loadAlerts() {
  try {
    showLoading(true);
    const alerts = await apiMedical.getActiveAlerts();
    renderAlerts(alerts);
    updateAlertsBadge(alerts.length);
  } catch (error) {
    console.error('Error al cargar alertas:', error);
    showNotification(`Error al cargar alertas: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderAlerts(alerts) {
  const container = document.getElementById('alertsContent');
  if (!container) return;
  
  if (alerts.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>✅ No hay alertas activas</p></div>';
    return;
  }
  
  // Agrupar por severidad
  const critical = alerts.filter(a => a.severity === 'critical');
  const high = alerts.filter(a => a.severity === 'high');
  const medium = alerts.filter(a => a.severity === 'medium');
  const low = alerts.filter(a => a.severity === 'low');
  
  container.innerHTML = `
    <div class="alerts-summary">
      <div class="summary-card critical">
        <div class="summary-count">${critical.length}</div>
        <div class="summary-label">Críticas</div>
      </div>
      <div class="summary-card high">
        <div class="summary-count">${high.length}</div>
        <div class="summary-label">Altas</div>
      </div>
      <div class="summary-card medium">
        <div class="summary-count">${medium.length}</div>
        <div class="summary-label">Medias</div>
      </div>
      <div class="summary-card low">
        <div class="summary-count">${low.length}</div>
        <div class="summary-label">Bajas</div>
      </div>
    </div>
    
    <div class="alerts-list-container">
      ${renderAlertsGroup('Críticas', critical, 'critical')}
      ${renderAlertsGroup('Altas', high, 'high')}
      ${renderAlertsGroup('Medias', medium, 'medium')}
      ${renderAlertsGroup('Bajas', low, 'low')}
    </div>
  `;
}

function renderAlertsGroup(title, alerts, severity) {
  if (alerts.length === 0) return '';
  
  return `
    <div class="alerts-group">
      <h3 class="alerts-group-title severity-${severity}">${title} (${alerts.length})</h3>
      <div class="alerts-items">
        ${alerts.map(alert => renderAlertItem(alert)).join('')}
      </div>
    </div>
  `;
}

function renderAlertItem(alert) {
  const icon = getAlertIcon(alert.alert_type);
  const severityClass = `alert-${alert.severity}`;
  
  return `
    <div class="alert-card ${severityClass}">
      <div class="alert-icon-large">${icon}</div>
      <div class="alert-details">
        <div class="alert-message">${escapeHtml(alert.message)}</div>
        <div class="alert-meta">
          <span>Producto: ${escapeHtml(alert.product_name || 'N/A')}</span>
          ${alert.lot_number ? `<span>Lote: ${escapeHtml(alert.lot_number)}</span>` : ''}
          ${alert.expiry_date ? `<span>Vence: ${formatDate(alert.expiry_date)}</span>` : ''}
          <span class="alert-time">${formatDateTime(alert.created_at)}</span>
        </div>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm btn-secondary" onclick="resolveAlert(${alert.id})">
          Resolver
        </button>
      </div>
    </div>
  `;
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

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('es-ES');
}

async function checkAlerts() {
  try {
    showLoading(true);
    await apiMedical.checkAlerts();
    showNotification('Verificación de alertas completada', 'success');
    await loadAlerts();
  } catch (error) {
    showNotification(`Error al verificar alertas: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function resolveAlert(alertId) {
  if (!confirm('¿Marcar esta alerta como resuelta?')) return;
  
  try {
    showLoading(true);
    const response = await fetch(`/api/alerts/${alertId}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    if (data.success) {
      showNotification('Alerta marcada como resuelta', 'success');
      await loadAlerts();
      updateAlertsBadge((await apiMedical.getActiveAlerts()).length);
    } else {
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error al resolver alerta: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
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

if (typeof window.updateAlertsBadge === 'undefined') {
  window.updateAlertsBadge = function(count) {
    const badge = document.getElementById('alertsBadge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  };
}

// Sobrescribir funciones placeholder
window.loadAlerts = loadAlerts;
window.checkAlerts = checkAlerts;
window.resolveAlert = resolveAlert;


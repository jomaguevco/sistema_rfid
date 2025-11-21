// Módulo de notificaciones

let notificationPreferences = null;

/**
 * Cargar vista de notificaciones
 */
async function loadNotificationsView() {
  const section = document.getElementById('notifications-section');
  if (!section) return;
  
  section.innerHTML = `
    <div class="section-header">
      <h2>Configuración de Notificaciones</h2>
      <div>
        <button onclick="sendTestEmail()" class="btn btn-primary">📧 Enviar Email de Prueba</button>
        <button onclick="loadNotificationPreferences()" class="btn btn-secondary">🔄 Actualizar</button>
      </div>
    </div>
    
    <div id="notificationsContent">
      <div class="notification-config">
        <h3>Preferencias de Notificaciones</h3>
        <div id="notificationPreferencesList" class="preferences-list">
          <p class="text-muted">Cargando preferencias...</p>
        </div>
      </div>
      
      <div class="notification-history" style="margin-top: 30px;">
        <h3>Historial de Notificaciones</h3>
        <div id="notificationHistoryList" class="history-list">
          <p class="text-muted">El historial de notificaciones se mostrará aquí.</p>
        </div>
      </div>
    </div>
  `;
  
  await loadNotificationPreferences();
}

/**
 * Cargar preferencias de notificaciones
 */
async function loadNotificationPreferences() {
  try {
    showLoading(true);
    const preferences = await apiMedical.getNotificationPreferences();
    notificationPreferences = preferences;
    
    const container = document.getElementById('notificationPreferencesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!preferences || Object.keys(preferences).length === 0) {
      container.innerHTML = '<p class="text-muted">No hay preferencias configuradas.</p>';
      return;
    }
    
    const preferencesList = document.createElement('div');
    preferencesList.className = 'preferences-grid';
    
    // Preferencias por tipo de alerta
    const alertTypes = [
      { key: 'expired', label: 'Productos Vencidos', icon: '⚠️' },
      { key: 'expiring_soon', label: 'Productos por Vencer', icon: '⏰' },
      { key: 'low_stock', label: 'Stock Bajo', icon: '📉' },
      { key: 'prediction_insufficient', label: 'Stock Insuficiente (Predicción)', icon: '📊' }
    ];
    
    alertTypes.forEach(type => {
      const prefItem = document.createElement('div');
      prefItem.className = 'preference-item';
      const enabled = preferences[`alert_${type.key}_enabled`] !== false;
      const email = preferences[`alert_${type.key}_email`] !== false;
      
      prefItem.innerHTML = `
        <div class="preference-header">
          <span class="preference-icon">${type.icon}</span>
          <h4>${type.label}</h4>
        </div>
        <div class="preference-options">
          <label class="checkbox-label">
            <input type="checkbox" id="pref_${type.key}_enabled" ${enabled ? 'checked' : ''} 
                   onchange="updateNotificationPreference('alert_${type.key}_enabled', this.checked)">
            <span>Notificaciones activas</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="pref_${type.key}_email" ${email ? 'checked' : ''} 
                   onchange="updateNotificationPreference('alert_${type.key}_email', this.checked)">
            <span>Enviar por email</span>
          </label>
        </div>
      `;
      preferencesList.appendChild(prefItem);
    });
    
    container.appendChild(preferencesList);
    
  } catch (error) {
    showNotification(`Error al cargar preferencias: ${error.message}`, 'error');
    console.error('Error al cargar preferencias:', error);
  } finally {
    showLoading(false);
  }
}

/**
 * Actualizar preferencia de notificación
 */
async function updateNotificationPreference(key, value) {
  try {
    if (!notificationPreferences) {
      notificationPreferences = {};
    }
    
    notificationPreferences[key] = value;
    
    await apiMedical.updateNotificationPreferences(notificationPreferences);
    showNotification('Preferencia actualizada correctamente', 'success');
  } catch (error) {
    showNotification(`Error al actualizar preferencia: ${error.message}`, 'error');
    console.error('Error al actualizar preferencia:', error);
    // Revertir cambio en UI
    await loadNotificationPreferences();
  }
}

/**
 * Enviar email de prueba
 */
async function sendTestEmail() {
  const email = prompt('Ingresa el email de destino para la prueba:');
  if (!email) return;
  
  try {
    showLoading(true);
    const result = await apiMedical.sendTestEmail(email);
    showNotification('Email de prueba enviado correctamente', 'success');
  } catch (error) {
    showNotification(`Error al enviar email de prueba: ${error.message}`, 'error');
    console.error('Error al enviar email de prueba:', error);
  } finally {
    showLoading(false);
  }
}

// Exportar funciones globalmente
window.loadNotificationsView = loadNotificationsView;
window.loadNotificationPreferences = loadNotificationPreferences;
window.updateNotificationPreference = updateNotificationPreference;
window.sendTestEmail = sendTestEmail;


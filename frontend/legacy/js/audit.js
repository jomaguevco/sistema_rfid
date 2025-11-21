// Módulo de auditoría

/**
 * Cargar vista de auditoría
 */
async function loadAuditView() {
  const container = document.getElementById('auditContent') || document.getElementById('reportsContent');
  if (!container) {
    console.error('Contenedor auditContent no encontrado');
    return;
  }
  
  try {
    container.innerHTML = `
      <div class="audit-container">
        <div class="section-header" style="margin-bottom: 20px;">
          <h3>Logs de Auditoría</h3>
          <button onclick="exportAuditLogs()" class="btn btn-secondary">📥 Exportar CSV</button>
        </div>
        
        <div class="audit-filters" style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h4>Filtros</h4>
          <div class="filters-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div class="form-group">
              <label>Usuario</label>
              <select id="auditUserId" class="form-select">
                <option value="">Todos los usuarios</option>
              </select>
            </div>
            <div class="form-group">
              <label>Acción</label>
              <select id="auditAction" class="form-select">
                <option value="">Todas las acciones</option>
                <option value="CREATE">Crear</option>
                <option value="UPDATE">Actualizar</option>
                <option value="DELETE">Eliminar</option>
                <option value="LOGIN">Iniciar Sesión</option>
                <option value="LOGOUT">Cerrar Sesión</option>
              </select>
            </div>
            <div class="form-group">
              <label>Tabla</label>
              <select id="auditTable" class="form-select">
                <option value="">Todas las tablas</option>
                <option value="products">Productos</option>
                <option value="product_batches">Lotes</option>
                <option value="product_categories">Categorías</option>
                <option value="areas">Áreas</option>
                <option value="users">Usuarios</option>
              </select>
            </div>
            <div class="form-group">
              <label>Fecha Inicio</label>
              <input type="date" id="auditStartDate" class="form-select">
            </div>
            <div class="form-group">
              <label>Fecha Fin</label>
              <input type="date" id="auditEndDate" class="form-select">
            </div>
          </div>
          <div style="margin-top: 15px;">
            <button onclick="loadAuditLogs()" class="btn btn-primary">🔍 Buscar</button>
            <button onclick="clearAuditFilters()" class="btn btn-secondary">🔄 Limpiar</button>
          </div>
        </div>
        
        <div id="auditStats" style="margin-bottom: 20px;"></div>
        
        <div id="auditLogsContainer">
          <p class="text-muted">Cargando logs...</p>
        </div>
      </div>
    `;
    
    await loadUsersForAudit();
    await loadAuditStats();
    await loadAuditLogs();
  } catch (error) {
    console.error('Error al cargar vista de auditoría:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar auditoría: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h4>Error al cargar auditoría</h4>
        <p>${errorMessage}</p>
        <button onclick="loadAuditView()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  }
}

async function loadUsersForAudit() {
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const users = await apiMedical.getAllUsers();
    const select = document.getElementById('auditUserId');
    if (select && users) {
      users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.username;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    // No bloquear la carga si falla
  }
}

async function loadAuditStats() {
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const startDate = document.getElementById('auditStartDate')?.value;
    const endDate = document.getElementById('auditEndDate')?.value;
    
    const stats = await apiMedical.getAuditStats({
      start_date: startDate,
      end_date: endDate
    });
    
    if (stats) {
      renderAuditStats(stats);
    }
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
    // No bloquear la carga si falla
  }
}

function renderAuditStats(stats) {
  const container = document.getElementById('auditStats');
  if (!container) return;
  
  container.innerHTML = `
    <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div class="stat-card" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div class="stat-value" style="font-size: 32px; font-weight: bold; color: #2c5282;">${stats.total}</div>
        <div class="stat-label" style="color: #666; font-size: 14px;">Total de Logs</div>
      </div>
      <div class="stat-card" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div class="stat-value" style="font-size: 32px; font-weight: bold; color: #28a745;">${stats.byAction.length}</div>
        <div class="stat-label" style="color: #666; font-size: 14px;">Tipos de Acciones</div>
      </div>
      <div class="stat-card" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div class="stat-value" style="font-size: 32px; font-weight: bold; color: #17a2b8;">${stats.byTable.length}</div>
        <div class="stat-label" style="color: #666; font-size: 14px;">Tablas Afectadas</div>
      </div>
    </div>
  `;
}

async function loadAuditLogs() {
  const container = document.getElementById('auditLogsContainer');
  if (!container) return;
  
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const userId = document.getElementById('auditUserId')?.value;
    const action = document.getElementById('auditAction')?.value;
    const tableName = document.getElementById('auditTable')?.value;
    const startDate = document.getElementById('auditStartDate')?.value;
    const endDate = document.getElementById('auditEndDate')?.value;
    
    const data = await apiMedical.getAuditLogs({
      user_id: userId || undefined,
      action: action || undefined,
      table_name: tableName || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      limit: 100,
      offset: 0
    });
    
    if (data && data.logs) {
      renderAuditLogs(data.logs, data.total || 0);
    } else {
      container.innerHTML = '<p class="text-muted">No se encontraron logs</p>';
    }
  } catch (error) {
    console.error('Error al cargar logs:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar logs: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 15px; margin: 10px 0; border-radius: 8px;">
        <p>${errorMessage}</p>
        <button onclick="loadAuditLogs()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  }
}

function renderAuditLogs(logs, total) {
  const container = document.getElementById('auditLogsContainer');
  if (!container) return;
  
  if (logs.length === 0) {
    container.innerHTML = '<p class="text-muted">No se encontraron logs con los filtros seleccionados</p>';
    return;
  }
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES');
  };
  
  const getActionBadge = (action) => {
    const badges = {
      'CREATE': 'badge-success',
      'UPDATE': 'badge-info',
      'DELETE': 'badge-danger',
      'LOGIN': 'badge-primary',
      'LOGOUT': 'badge-secondary'
    };
    return badges[action] || 'badge-secondary';
  };
  
  container.innerHTML = `
    <div class="table-container">
      <p style="margin-bottom: 10px;"><strong>Total:</strong> ${total} registros</p>
      <table class="products-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Tabla</th>
            <th>Registro ID</th>
            <th>IP</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${formatDate(log.timestamp)}</td>
              <td>${escapeHtml(log.username || 'Sistema')}</td>
              <td><span class="badge ${getActionBadge(log.action)}">${escapeHtml(log.action)}</span></td>
              <td>${escapeHtml(log.table_name)}</td>
              <td>${log.record_id || '-'}</td>
              <td>${log.ip_address || '-'}</td>
              <td>
                <button onclick="viewAuditDetails(${log.id})" class="btn btn-sm btn-info">👁️ Detalles</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function clearAuditFilters() {
  document.getElementById('auditUserId').value = '';
  document.getElementById('auditAction').value = '';
  document.getElementById('auditTable').value = '';
  document.getElementById('auditStartDate').value = '';
  document.getElementById('auditEndDate').value = '';
  loadAuditLogs();
  loadAuditStats();
}

async function viewAuditDetails(logId) {
  // Obtener log completo con valores antiguos y nuevos
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/audit/logs?limit=1&offset=0`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      const log = data.data.logs.find(l => l.id === logId);
      if (log) {
        showAuditDetailsModal(log);
      }
    }
  } catch (error) {
    console.error('Error al obtener detalles:', error);
  }
}

function showAuditDetailsModal(log) {
  const modal = document.createElement('div');
  modal.id = 'auditDetailsModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeModal('auditDetailsModal')">&times;</span>
      <h2>Detalles del Log de Auditoría</h2>
      <div style="margin: 20px 0;">
        <p><strong>Fecha:</strong> ${new Date(log.timestamp).toLocaleString('es-ES')}</p>
        <p><strong>Usuario:</strong> ${escapeHtml(log.username || 'Sistema')}</p>
        <p><strong>Acción:</strong> <span class="badge badge-info">${escapeHtml(log.action)}</span></p>
        <p><strong>Tabla:</strong> ${escapeHtml(log.table_name)}</p>
        <p><strong>Registro ID:</strong> ${log.record_id || '-'}</p>
        <p><strong>IP:</strong> ${log.ip_address || '-'}</p>
      </div>
      ${log.old_values || log.new_values ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
          ${log.old_values ? `
            <div>
              <h4>Valores Anteriores</h4>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto;">${JSON.stringify(log.old_values, null, 2)}</pre>
            </div>
          ` : ''}
          ${log.new_values ? `
            <div>
              <h4>Valores Nuevos</h4>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto;">${JSON.stringify(log.new_values, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
      ` : ''}
      <div style="margin-top: 20px;">
        <button onclick="closeModal('auditDetailsModal')" class="btn btn-secondary">Cerrar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = function(event) {
    if (event.target === modal) {
      closeModal('auditDetailsModal');
    }
  };
}

async function exportAuditLogs() {
  try {
    const token = localStorage.getItem('authToken');
    const userId = document.getElementById('auditUserId')?.value;
    const action = document.getElementById('auditAction')?.value;
    const tableName = document.getElementById('auditTable')?.value;
    const startDate = document.getElementById('auditStartDate')?.value;
    const endDate = document.getElementById('auditEndDate')?.value;
    
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    if (action) params.append('action', action);
    if (tableName) params.append('table_name', tableName);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await fetch(`/api/audit/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotification('Logs exportados correctamente', 'success');
    } else {
      const data = await response.json();
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error al exportar logs:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Exportar funciones globalmente
window.loadAuditView = loadAuditView;
window.loadAuditLogs = loadAuditLogs;
window.clearAuditFilters = clearAuditFilters;
window.viewAuditDetails = viewAuditDetails;
window.exportAuditLogs = exportAuditLogs;


// Módulo de backup y restauración

/**
 * Cargar vista de backup
 */
async function loadBackupView() {
  const container = document.getElementById('backupContent') || document.getElementById('reportsContent');
  if (!container) {
    console.error('Contenedor backupContent no encontrado');
    return;
  }
  
  try {
    container.innerHTML = `
      <div class="backup-container">
        <div class="section-header" style="margin-bottom: 20px;">
          <h3>Gestión de Backups</h3>
          <button onclick="createBackup()" class="btn btn-primary">💾 Crear Backup</button>
        </div>
        
        <div class="backup-actions" style="margin-bottom: 30px;">
          <div class="action-card">
            <h4>Crear Backup Manual</h4>
            <p>Genera un backup completo de la base de datos</p>
            <button onclick="createBackup()" class="btn btn-success">Crear Backup Ahora</button>
          </div>
          
          <div class="action-card">
            <h4>Restaurar Backup</h4>
            <p>Restaura la base de datos desde un backup anterior</p>
            <button onclick="showRestoreModal()" class="btn btn-warning">Restaurar Backup</button>
          </div>
        </div>
        
        <div id="backupList">
          <h3>Backups Disponibles</h3>
          <div id="backupsTableContainer">
            <p class="text-muted">Cargando backups...</p>
          </div>
        </div>
      </div>
    `;
    
    await loadBackupsList();
  } catch (error) {
    console.error('Error al cargar vista de backup:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar backup: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h4>Error al cargar backup</h4>
        <p>${errorMessage}</p>
        <button onclick="loadBackupView()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  }
}

/**
 * Cargar lista de backups
 */
async function loadBackupsList() {
  const container = document.getElementById('backupsTableContainer');
  if (!container) return;
  
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const backups = await apiMedical.listBackups();
    
    if (backups && Array.isArray(backups)) {
      renderBackupsList(backups);
    } else {
      container.innerHTML = '<p class="text-muted">No hay backups disponibles</p>';
    }
  } catch (error) {
    console.error('Error al cargar backups:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar backups: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 15px; margin: 10px 0; border-radius: 8px;">
        <p>${errorMessage}</p>
        <button onclick="loadBackupsList()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  }
}

/**
 * Renderizar lista de backups
 */
function renderBackupsList(backups) {
  const container = document.getElementById('backupsTableContainer');
  if (!container) return;
  
  if (backups.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay backups disponibles</p>';
    return;
  }
  
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  
  const formatDate = (date) => {
    return new Date(date).toLocaleString('es-ES');
  };
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Nombre del Archivo</th>
            <th>Tamaño</th>
            <th>Fecha de Creación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${backups.map(backup => `
            <tr>
              <td><strong>${escapeHtml(backup.filename)}</strong></td>
              <td>${formatSize(backup.size)}</td>
              <td>${formatDate(backup.createdAt)}</td>
              <td>
                <button onclick="downloadBackup('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-info">
                  📥 Descargar
                </button>
                <button onclick="restoreBackup('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-warning">
                  🔄 Restaurar
                </button>
                <button onclick="deleteBackupFile('${escapeHtml(backup.filename)}')" class="btn btn-sm btn-danger">
                  🗑️ Eliminar
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Crear backup
 */
async function createBackup() {
  if (!confirm('¿Crear un nuevo backup de la base de datos? Esto puede tomar varios minutos.')) {
    return;
  }
  
  try {
    showLoading(true);
    
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const result = await apiMedical.createBackup();
    
    if (result) {
      showNotification('Backup creado correctamente', 'success');
      await loadBackupsList();
    }
  } catch (error) {
    console.error('Error al crear backup:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al crear backup: ${error.message || 'Error desconocido'}`;
    showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Descargar backup
 */
async function downloadBackup(filename) {
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    await apiMedical.downloadBackup(filename);
    showNotification('Backup descargado correctamente', 'success');
  } catch (error) {
    console.error('Error al descargar backup:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al descargar backup: ${error.message || 'Error desconocido'}`;
    showNotification(errorMessage, 'error');
  }
}

/**
 * Restaurar backup
 */
async function restoreBackup(filename) {
  if (!confirm(`¿Estás seguro de restaurar el backup "${filename}"? Esto reemplazará todos los datos actuales.`)) {
    return;
  }
  
  if (!confirm('⚠️ ADVERTENCIA: Esta acción NO se puede deshacer. ¿Continuar?')) {
    return;
  }
  
  try {
    showLoading(true);
    
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const result = await apiMedical.restoreBackup(filename);
    
    if (result) {
      showNotification('Backup restaurado correctamente. Recargando página...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al restaurar backup: ${error.message || 'Error desconocido'}`;
    showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Eliminar backup
 */
async function deleteBackupFile(filename) {
  if (!confirm(`¿Eliminar el backup "${filename}"?`)) {
    return;
  }
  
  try {
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    const result = await apiMedical.deleteBackup(filename);
    
    if (result) {
      showNotification('Backup eliminado correctamente', 'success');
      await loadBackupsList();
    }
  } catch (error) {
    console.error('Error al eliminar backup:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al eliminar backup: ${error.message || 'Error desconocido'}`;
    showNotification(errorMessage, 'error');
  }
}

function showRestoreModal() {
  loadBackupsList().then(() => {
    showNotification('Selecciona un backup de la lista para restaurar', 'info');
  });
}

// Exportar funciones globalmente
window.loadBackupView = loadBackupView;
window.createBackup = createBackup;
window.downloadBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.deleteBackupFile = deleteBackupFile;
window.showRestoreModal = showRestoreModal;


// Módulo de gestión de áreas/departamentos médicos
let areas = [];

async function loadAreasView() {
  try {
    console.log('🔄 Cargando áreas...');
    showLoading(true);
    
    // Usar apiMedical para obtener todas las áreas incluyendo inactivas
    if (typeof apiMedical !== 'undefined' && apiMedical) {
      // Obtener todas las áreas usando apiMedical con autenticación
      areas = await apiMedical.getAllAreas();
      console.log('✓ Áreas cargadas:', areas.length);
      renderAreas();
    } else {
      throw new Error('apiMedical no está disponible');
    }
  } catch (error) {
    console.error('❌ Error al cargar áreas:', error);
    
    // Manejar errores de autenticación de manera más elegante
    if (error.requiresAuth || error.status === 401) {
      showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
    } else {
      showNotification(`Error al cargar áreas: ${error.message}`, 'error');
    }
    
    // Mostrar mensaje en el contenedor
    const tbody = document.getElementById('areasTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar áreas: ${error.message}</td></tr>`;
    }
  } finally {
    showLoading(false);
  }
}

function renderAreas() {
  const tbody = document.getElementById('areasTableBody');
  if (!tbody) {
    console.error('❌ areasTableBody no encontrado');
    return;
  }
  
  tbody.innerHTML = '';
  
  if (areas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay áreas registradas</td></tr>';
    return;
  }
  
  console.log('📋 Renderizando', areas.length, 'áreas');
  
  areas.forEach(area => {
    const row = document.createElement('tr');
    // Manejar is_active como número (1/0) o booleano
    const isActive = area.is_active === 1 || area.is_active === true;
    const statusBadge = isActive ? 
      '<span class="badge badge-success">Activa</span>' : 
      '<span class="badge badge-secondary">Inactiva</span>';
    
    row.innerHTML = `
      <td>${area.id}</td>
      <td><strong>${escapeHtml(area.name)}</strong></td>
      <td>${escapeHtml(area.description || '-')}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editArea(${area.id})">✏️ Editar</button>
        ${isActive ? 
          `<button class="btn btn-sm btn-warning" onclick="deactivateArea(${area.id})">Desactivar</button>` :
          `<button class="btn btn-sm btn-success" onclick="activateArea(${area.id})">Activar</button>`
        }
        <button class="btn btn-sm btn-danger" onclick="deleteArea(${area.id})">🗑️ Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function showAreaForm(area = null) {
  editingAreaId = area ? area.id : null;
  const modal = document.getElementById('areaModal');
  const title = document.getElementById('modalAreaTitle');
  const form = document.getElementById('areaForm');
  
  if (!modal || !form) {
    console.error('Modal o formulario de área no encontrado');
    return;
  }
  
  if (area) {
    title.textContent = 'Editar Área/Departamento';
    document.getElementById('areaName').value = area.name || '';
    document.getElementById('areaDescription').value = area.description || '';
    // Manejar is_active como número (1/0) o booleano
    const isActive = area.is_active === 1 || area.is_active === true;
    document.getElementById('areaIsActive').checked = isActive;
  } else {
    title.textContent = 'Nueva Área/Departamento';
    // Resetear formulario correctamente
    form.reset();
    // Establecer valores por defecto después del reset
    setTimeout(() => {
      document.getElementById('areaIsActive').checked = true;
    }, 10);
  }
  
  modal.style.display = 'block';
}

async function saveArea(event) {
  if (event) {
    event.preventDefault();
  }
  
  // Validaciones
  const name = document.getElementById('areaName')?.value.trim();
  if (!name) {
    showNotification('El nombre del área es obligatorio', 'error');
    return;
  }
  
  const areaData = {
    name: name,
    description: document.getElementById('areaDescription')?.value.trim() || null,
    is_active: document.getElementById('areaIsActive')?.checked !== false
  };
  
  try {
    showLoading(true);
    
    if (editingAreaId) {
      await apiMedical.updateArea(editingAreaId, areaData);
      showNotification('Área actualizada correctamente', 'success');
    } else {
      await apiMedical.createArea(areaData);
      showNotification('Área creada correctamente', 'success');
    }
    
    // Cerrar modal y limpiar formulario
    closeModal('areaModal');
    editingAreaId = null;
    
    // Recargar áreas
    await loadAreasView();
    
    // Recargar áreas en otros módulos
    if (typeof loadAreas === 'function') {
      await loadAreas();
    }
  } catch (error) {
    console.error('Error al guardar área:', error);
    showNotification(`Error: ${error.message || 'Error desconocido al guardar área'}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function editArea(id) {
  try {
    const area = await apiMedical.getAreaById(id);
    showAreaForm(area);
  } catch (error) {
    showNotification(`Error al cargar área: ${error.message}`, 'error');
  }
}

async function deleteArea(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta área? Esta acción no se puede deshacer.')) return;
  
  try {
    showLoading(true);
    await apiMedical.deleteArea(id);
    showNotification('Área eliminada correctamente', 'success');
    await loadAreasView();
  } catch (error) {
    showNotification(`Error al eliminar área: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function activateArea(id) {
  try {
    showLoading(true);
    await apiMedical.updateArea(id, { is_active: true });
    showNotification('Área activada correctamente', 'success');
    await loadAreasView();
  } catch (error) {
    showNotification(`Error al activar área: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function deactivateArea(id) {
  if (!confirm('¿Desactivar esta área? Los retiros futuros no podrán asignarse a esta área.')) return;
  
  try {
    showLoading(true);
    await apiMedical.updateArea(id, { is_active: false });
    showNotification('Área desactivada correctamente', 'success');
    await loadAreasView();
  } catch (error) {
    showNotification(`Error al desactivar área: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

let editingAreaId = null;

// Funciones de utilidad si no están disponibles
if (typeof window.escapeHtml === 'undefined') {
  window.escapeHtml = function(text) {
    if (!text) return '';
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

if (typeof window.closeModal === 'undefined') {
  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };
}

// Exportar funciones globalmente
window.loadAreasView = loadAreasView;
window.showAreaForm = showAreaForm;
window.saveArea = saveArea;
window.editArea = editArea;
window.deleteArea = deleteArea;
window.activateArea = activateArea;
window.deactivateArea = deactivateArea;


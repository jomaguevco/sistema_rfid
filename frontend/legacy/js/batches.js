// Módulo de gestión de lotes
let selectedProductId = null;

// Obtener referencia al socket desde app_medical.js
function getSocket() {
  return window.socket || (typeof io !== 'undefined' ? io() : null);
}

async function loadBatchesView() {
  const container = document.getElementById('batchesContent');
  if (!container) {
    console.error('Contenedor batchesContent no encontrado');
    return;
  }
  
  try {
    showLoading(true);
    const products = await apiMedical.getAllProducts();
    
    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="batches-header">
          <p class="text-muted">No hay productos disponibles. Crea un producto primero.</p>
        </div>
        <div id="batchesListContainer"></div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="batches-header">
        <p>Selecciona un producto para ver sus lotes o crea un nuevo lote</p>
      </div>
      <div class="products-selector">
        <select id="batchProductSelector" class="form-select" onchange="loadProductBatches(this.value)">
          <option value="">Seleccionar producto...</option>
          ${products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
      <div id="batchesListContainer"></div>
    `;
  } catch (error) {
    console.error('Error al cargar vista de lotes:', error);
    const errorMessage = error.requiresAuth || error.status === 401 
      ? 'Sesión expirada. Por favor inicia sesión nuevamente.'
      : `Error al cargar productos: ${error.message || 'Error desconocido'}`;
    
    container.innerHTML = `
      <div class="alert alert-danger" style="padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h4>Error al cargar lotes</h4>
        <p>${errorMessage}</p>
        <button onclick="loadBatchesView()" class="btn btn-primary btn-sm">Reintentar</button>
      </div>
    `;
    showNotification(errorMessage, 'error');
  } finally {
    showLoading(false);
  }
}

async function loadProductBatches(productId) {
  if (!productId) {
    document.getElementById('batchesListContainer').innerHTML = '';
    return;
  }
  
  try {
    showLoading(true);
    selectedProductId = productId;
    const batches = await apiMedical.getProductBatches(productId);
    renderBatches(batches);
  } catch (error) {
    showNotification(`Error al cargar lotes: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderBatches(batches) {
  const container = document.getElementById('batchesListContainer');
  if (!container) return;
  
  if (batches.length === 0) {
    container.innerHTML = '<p class="text-muted">Este producto no tiene lotes registrados</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="batches-table-container">
      <table class="batches-table">
        <thead>
          <tr>
            <th>Lote</th>
            <th>Fecha Vencimiento</th>
            <th>Días Restantes</th>
            <th>Cantidad</th>
            <th>RFID</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${batches.map(batch => renderBatchRow(batch)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBatchRow(batch) {
  const days = batch.days_to_expiry || 0;
  const isExpired = batch.is_expired;
  const statusClass = isExpired ? 'badge-danger' : days <= 7 ? 'badge-warning' : days <= 30 ? 'badge-info' : 'badge-success';
  const statusText = isExpired ? 'Vencido' : days <= 7 ? 'Crítico' : days <= 30 ? 'Por vencer' : 'Vigente';
  
  return `
    <tr class="${isExpired ? 'row-expired' : ''}">
      <td><strong>${escapeHtml(batch.lot_number)}</strong></td>
      <td>${formatDate(batch.expiry_date)}</td>
      <td>
        <span class="badge ${statusClass}">${isExpired ? 'Vencido' : days + ' días'}</span>
      </td>
      <td><span class="stock-badge">${batch.quantity}</span></td>
      <td>${batch.rfid_uid ? `<span class="rfid-badge">${escapeHtml(batch.rfid_uid)}</span>` : '<span class="text-muted">Sin asignar</span>'}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td>
        ${!batch.rfid_uid ? `<button class="btn btn-sm btn-info" onclick="assignRfidToBatch(${batch.id})">📡 Asignar RFID</button>` : ''}
        <button class="btn btn-sm btn-primary" onclick="editBatchQuantity(${batch.id})">✏️ Editar</button>
        <button class="btn btn-sm btn-success" onclick="showPrintModal(${batch.id})">🖨️ Imprimir</button>
      </td>
    </tr>
  `;
}

function showBatchForm(productId = null) {
  const modal = document.getElementById('batchModal');
  const productSelect = document.getElementById('batchProductId');
  
  // Cargar productos en el select
  apiMedical.getAllProducts().then(products => {
    productSelect.innerHTML = '<option value="">Seleccionar producto...</option>';
    products.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.name;
      if (productId && p.id === productId) option.selected = true;
      productSelect.appendChild(option);
    });
  });
  
  // Establecer fecha de ingreso por defecto
  document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
  
  modal.style.display = 'block';
}

async function saveBatch(event) {
  event.preventDefault();
  
  const batchData = {
    product_id: parseInt(document.getElementById('batchProductId').value),
    lot_number: document.getElementById('lotNumber').value.trim(),
    expiry_date: document.getElementById('expiryDate').value,
    quantity: parseInt(document.getElementById('batchQuantity').value),
    entry_date: document.getElementById('entryDate').value || new Date().toISOString().split('T')[0],
    rfid_uid: document.getElementById('batchRfidUid').value.trim() || null
  };
  
  if (!batchData.lot_number || !batchData.expiry_date) {
    showNotification('Número de lote y fecha de vencimiento son obligatorios', 'error');
    return;
  }
  
  try {
    showLoading(true);
    await apiMedical.createBatch(batchData);
    showNotification('Lote creado correctamente', 'success');
    closeModal('batchModal');
    if (selectedProductId) {
      await loadProductBatches(selectedProductId);
    } else {
      await loadBatchesView();
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function viewBatches(productId) {
  showSection('batches');
  setTimeout(() => {
    document.getElementById('batchProductSelector').value = productId;
    loadProductBatches(productId);
  }, 100);
}

// Variable global para el modo de asignación RFID
let rfidAssignmentMode = {
  active: false,
  batchId: null,
  timeout: null
};

// Exponer globalmente para que app_medical.js pueda acceder
window.rfidAssignmentMode = rfidAssignmentMode;

async function assignRfidToBatch(batchId) {
  // Activar modo de escucha RFID
  rfidAssignmentMode.active = true;
  rfidAssignmentMode.batchId = batchId;
  
  // Sincronizar con window para que app_medical.js pueda acceder
  window.rfidAssignmentMode = rfidAssignmentMode;
  
  console.log('🔵 Modo asignación RFID activado para lote:', batchId);
  
  // Mostrar modal de escucha
  showRfidListeningModal(batchId);
  
  // Configurar timeout de 60 segundos
  rfidAssignmentMode.timeout = setTimeout(() => {
    if (rfidAssignmentMode.active) {
      cancelRfidAssignment();
      showNotification('Tiempo de espera agotado. Intenta nuevamente.', 'warning');
    }
  }, 60000);
  
  // El evento se maneja en app_medical.js que verifica rfidAssignmentMode
  // Asegurar que el socket esté disponible
  const socket = getSocket();
  if (!socket) {
    console.warn('Socket.IO no disponible. El modo de escucha RFID puede no funcionar.');
  } else {
    console.log('✓ Socket.IO disponible, escuchando eventos RFID...');
  }
}

function showRfidListeningModal(batchId) {
  // Cerrar modal anterior si existe
  const existingModal = document.getElementById('rfidListeningModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'rfidListeningModal';
  modal.className = 'modal';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '10000';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px; text-align: center; padding: 40px;">
      <div style="font-size: 64px; margin-bottom: 20px;">📡</div>
      <h2 style="margin-bottom: 20px;">Modo de Escucha RFID Activado</h2>
      <p style="font-size: 18px; margin-bottom: 30px; color: #666;">
        Acerca el tag RFID al lector RC522
      </p>
      <div id="rfidListeningStatus" style="padding: 20px; background: #f0f0f0; border-radius: 8px; margin-bottom: 20px;">
        <div style="display: inline-block; width: 20px; height: 20px; background: #28a745; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <span style="margin-left: 10px; font-weight: bold; color: #28a745;">Escuchando...</span>
      </div>
      <button onclick="cancelRfidAssignment()" class="btn btn-secondary" style="margin-top: 20px;">
        Cancelar
      </button>
    </div>
  `;
  
  // Agregar animación CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(modal);
  
  // Cerrar al hacer clic fuera del modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      cancelRfidAssignment();
    }
  });
}

function cancelRfidAssignment() {
  rfidAssignmentMode.active = false;
  rfidAssignmentMode.batchId = null;
  
  // Sincronizar con window
  window.rfidAssignmentMode = rfidAssignmentMode;
  
  if (rfidAssignmentMode.timeout) {
    clearTimeout(rfidAssignmentMode.timeout);
    rfidAssignmentMode.timeout = null;
  }
  
  const modal = document.getElementById('rfidListeningModal');
  if (modal) {
    modal.remove();
  }
  
  console.log('🔴 Modo asignación RFID cancelado');
}

async function assignDetectedRfid(batchId, rfidUid) {
  console.log('🎯 assignDetectedRfid llamado:', { batchId, rfidUid });
  
  if (!rfidUid || !rfidUid.trim()) {
    console.error('❌ RFID no válido:', rfidUid);
    showNotification('RFID no válido detectado', 'error');
    cancelRfidAssignment();
    return;
  }
  
  // Desactivar modo inmediatamente para evitar múltiples detecciones
  rfidAssignmentMode.active = false;
  // Asegurar que window tenga la misma referencia
  if (window.rfidAssignmentMode) {
    window.rfidAssignmentMode.active = false;
  }
  
  // Actualizar modal con el UID detectado
  const statusDiv = document.getElementById('rfidListeningStatus');
  if (statusDiv) {
    statusDiv.innerHTML = `
      <div style="color: #28a745; font-weight: bold; margin-bottom: 10px;">
        ✓ RFID Detectado
      </div>
      <div style="font-family: monospace; font-size: 16px; background: white; padding: 10px; border-radius: 4px;">
        ${rfidUid}
      </div>
      <div style="margin-top: 10px; color: #666;">
        Asignando al lote...
      </div>
    `;
  }
  
  try {
    showLoading(true);
    
    // Obtener token de autenticación
    const token = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`/api/batches/${batchId}/rfid`, {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify({ rfid_uid: rfidUid.trim().toUpperCase() })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('✅ RFID asignado exitosamente');
      showNotification('RFID asignado correctamente al lote', 'success');
      
      // Cerrar modal inmediatamente
      cancelRfidAssignment();
      
      // Recargar lotes después de un pequeño delay para que el modal se cierre
      setTimeout(async () => {
        if (selectedProductId) {
          await loadProductBatches(selectedProductId);
        } else {
          await loadBatchesView();
        }
      }, 300);
    } else {
      console.error('❌ Error al asignar RFID:', data.error);
      showNotification(`Error: ${data.error}`, 'error');
      cancelRfidAssignment();
    }
  } catch (error) {
    showNotification(`Error al asignar RFID: ${error.message}`, 'error');
    cancelRfidAssignment();
  } finally {
    showLoading(false);
  }
}

async function editBatchQuantity(batchId) {
  const newQuantity = prompt('Ingresa la nueva cantidad:');
  if (!newQuantity || isNaN(newQuantity) || parseInt(newQuantity) < 0) {
    showNotification('Cantidad inválida', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const response = await fetch(`/api/batches/${batchId}/quantity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: parseInt(newQuantity) })
    });
    
    const data = await response.json();
    if (data.success) {
      showNotification('Cantidad actualizada correctamente', 'success');
      if (selectedProductId) {
        await loadProductBatches(selectedProductId);
      }
    } else {
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error al actualizar cantidad: ${error.message}`, 'error');
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

if (typeof window.showSection === 'undefined') {
  window.showSection = function(section) {
    console.warn('showSection no está disponible');
  };
}

// Vista de calendario de vencimientos
async function showExpiryCalendar() {
  try {
    showLoading(true);
    
    // Obtener todos los lotes con vencimientos próximos
    const products = await apiMedical.getAllProducts();
    const allBatches = [];
    
    for (const product of products) {
      try {
        const batches = await apiMedical.getProductBatches(product.id);
        batches.forEach(batch => {
          allBatches.push({ ...batch, product_name: product.name });
        });
      } catch (err) {
        console.error(`Error al cargar lotes de ${product.name}:`, err);
      }
    }
    
    // Ordenar por fecha de vencimiento
    allBatches.sort((a, b) => {
      const dateA = new Date(a.expiry_date);
      const dateB = new Date(b.expiry_date);
      return dateA - dateB;
    });
    
    renderExpiryCalendar(allBatches);
    
  } catch (error) {
    console.error('Error al cargar calendario:', error);
    showNotification(`Error al cargar calendario: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function renderExpiryCalendar(batches) {
  const container = document.getElementById('batchesContent');
  if (!container) return;
  
  // Agrupar por mes de vencimiento
  const byMonth = {};
  batches.forEach(batch => {
    const date = new Date(batch.expiry_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = [];
    }
    byMonth[monthKey].push(batch);
  });
  
  const months = Object.keys(byMonth).sort();
  
  container.innerHTML = `
    <div class="expiry-calendar-view">
      <h3>Calendario de Vencimientos</h3>
      <div class="calendar-months">
        ${months.map(month => {
          const batches = byMonth[month];
          const [year, monthNum] = month.split('-');
          const monthName = new Date(year, parseInt(monthNum) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          
          return `
            <div class="calendar-month-card">
              <h4>${monthName}</h4>
              <div class="calendar-batches">
                ${batches.map(batch => {
                  const days = batch.days_to_expiry || 0;
                  const isExpired = batch.is_expired;
                  const urgencyClass = isExpired ? 'urgent-expired' : days <= 7 ? 'urgent-critical' : days <= 30 ? 'urgent-warning' : 'urgent-normal';
                  
                  return `
                    <div class="calendar-batch-item ${urgencyClass}">
                      <div class="batch-date">
                        <strong>${formatDate(batch.expiry_date)}</strong>
                        <span class="badge ${isExpired ? 'badge-danger' : days <= 7 ? 'badge-danger' : days <= 30 ? 'badge-warning' : 'badge-info'}">
                          ${isExpired ? 'Vencido' : days + ' días'}
                        </span>
                      </div>
                      <div class="batch-info">
                        <strong>${escapeHtml(batch.product_name)}</strong> - Lote: ${escapeHtml(batch.lot_number)}
                      </div>
                      <div class="batch-details">
                        Cantidad: ${batch.quantity} | 
                        ${batch.rfid_uid ? `RFID: ${escapeHtml(batch.rfid_uid)}` : 'Sin RFID'}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top: 20px;">
        <button onclick="loadBatchesView()" class="btn btn-secondary">← Volver a Vista de Lotes</button>
      </div>
    </div>
  `;
}

// Asignación masiva de RFID
function showBulkRfidAssignment() {
  const modal = document.createElement('div');
  modal.id = 'bulkRfidModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeModal('bulkRfidModal')">&times;</span>
      <h2>Asignación Masiva de RFID</h2>
      <p>Selecciona los lotes y asigna RFID en lote:</p>
      <div id="bulkRfidBatchesList" style="max-height: 400px; overflow-y: auto; margin: 20px 0;">
        <p class="text-muted">Cargando lotes sin RFID...</p>
      </div>
      <div class="form-group">
        <label>Formato de asignación:</label>
        <select id="bulkRfidFormat" class="form-select">
          <option value="manual">Manual (ingresar cada RFID)</option>
          <option value="auto">Auto-generar (RFID001, RFID002...)</option>
        </select>
      </div>
      <div class="form-actions">
        <button onclick="executeBulkRfidAssignment()" class="btn btn-primary">Asignar RFID Seleccionados</button>
        <button onclick="closeModal('bulkRfidModal')" class="btn btn-secondary">Cancelar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  loadBatchesForBulkRfid();
}

async function loadBatchesForBulkRfid() {
  try {
    showLoading(true);
    const products = await apiMedical.getAllProducts();
    const batchesWithoutRfid = [];
    
    for (const product of products) {
      try {
        const batches = await apiMedical.getProductBatches(product.id);
        batches.filter(b => !b.rfid_uid).forEach(batch => {
          batchesWithoutRfid.push({ ...batch, product_name: product.name });
        });
      } catch (err) {
        console.error(`Error al cargar lotes de ${product.name}:`, err);
      }
    }
    
    const container = document.getElementById('bulkRfidBatchesList');
    if (!container) return;
    
    if (batchesWithoutRfid.length === 0) {
      container.innerHTML = '<p class="text-muted">No hay lotes sin RFID asignado</p>';
      return;
    }
    
    container.innerHTML = `
      <table class="products-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllBatches" onchange="toggleAllBatches(this.checked)"></th>
            <th>Producto</th>
            <th>Lote</th>
            <th>Vencimiento</th>
            <th>Cantidad</th>
            <th>RFID</th>
          </tr>
        </thead>
        <tbody>
          ${batchesWithoutRfid.map((batch, index) => `
            <tr>
              <td><input type="checkbox" class="batch-checkbox" data-batch-id="${batch.id}" data-index="${index}"></td>
              <td>${escapeHtml(batch.product_name)}</td>
              <td>${escapeHtml(batch.lot_number)}</td>
              <td>${formatDate(batch.expiry_date)}</td>
              <td>${batch.quantity}</td>
              <td><input type="text" id="rfid_${batch.id}" class="form-control" placeholder="RFID o auto-generar" style="width: 150px;"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
  } catch (error) {
    console.error('Error al cargar lotes:', error);
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function toggleAllBatches(checked) {
  document.querySelectorAll('.batch-checkbox').forEach(cb => {
    cb.checked = checked;
  });
}

async function executeBulkRfidAssignment() {
  const format = document.getElementById('bulkRfidFormat')?.value || 'manual';
  const checkboxes = document.querySelectorAll('.batch-checkbox:checked');
  
  if (checkboxes.length === 0) {
    showNotification('Selecciona al menos un lote', 'warning');
    return;
  }
  
  try {
    showLoading(true);
    let rfidCounter = 1;
    const assignments = [];
    
    for (const checkbox of checkboxes) {
      const batchId = checkbox.dataset.batchId;
      let rfidUid;
      
      if (format === 'auto') {
        // Auto-generar RFID
        rfidUid = `RFID${String(rfidCounter).padStart(3, '0')}`;
        rfidCounter++;
      } else {
        // Manual
        const input = document.getElementById(`rfid_${batchId}`);
        rfidUid = input?.value.trim();
        if (!rfidUid) {
          showNotification(`Lote ${batchId} no tiene RFID asignado`, 'warning');
          continue;
        }
      }
      
      assignments.push({ batchId, rfidUid });
    }
    
    // Asignar todos los RFID
    let successCount = 0;
    let errorCount = 0;
    
    for (const assignment of assignments) {
      try {
        const response = await fetch(`/api/batches/${assignment.batchId}/rfid`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rfid_uid: assignment.rfidUid.toUpperCase() })
        });
        
        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    showNotification(`RFID asignados: ${successCount} exitosos, ${errorCount} errores`, successCount > 0 ? 'success' : 'error');
    closeModal('bulkRfidModal');
    
    if (selectedProductId) {
      await loadProductBatches(selectedProductId);
    } else {
      await loadBatchesView();
    }
    
  } catch (error) {
    console.error('Error en asignación masiva:', error);
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function exportBatches() {
  // Obtener todos los lotes y exportar a CSV
  apiMedical.getAllProducts().then(async products => {
    const allBatches = [];
    
    for (const product of products) {
      try {
        const batches = await apiMedical.getProductBatches(product.id);
        batches.forEach(batch => {
          allBatches.push({
            producto: product.name,
            lote: batch.lot_number,
            vencimiento: batch.expiry_date,
            cantidad: batch.quantity,
            rfid: batch.rfid_uid || '',
            fecha_ingreso: batch.entry_date || ''
          });
        });
      } catch (err) {
        console.error(`Error al cargar lotes de ${product.name}:`, err);
      }
    }
    
    if (allBatches.length === 0) {
      showNotification('No hay lotes para exportar', 'warning');
      return;
    }
    
    // Crear CSV
    const headers = ['Producto', 'Lote', 'Vencimiento', 'Cantidad', 'RFID', 'Fecha Ingreso'];
    const rows = allBatches.map(batch => [
      batch.producto,
      batch.lote,
      batch.vencimiento,
      batch.cantidad,
      batch.rfid,
      batch.fecha_ingreso
    ]);
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lotes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Lotes exportados correctamente', 'success');
  }).catch(error => {
    showNotification(`Error al exportar: ${error.message}`, 'error');
  });
}

// Exportar funciones y variables globalmente
window.loadBatchesView = loadBatchesView;
window.viewBatches = viewBatches;
window.showBatchForm = showBatchForm;
window.saveBatch = saveBatch;
window.assignRfidToBatch = assignRfidToBatch;
window.editBatchQuantity = editBatchQuantity;
window.loadProductBatches = loadProductBatches;
window.showExpiryCalendar = showExpiryCalendar;
window.showBulkRfidAssignment = showBulkRfidAssignment;
window.executeBulkRfidAssignment = executeBulkRfidAssignment;
window.toggleAllBatches = toggleAllBatches;
window.exportBatches = exportBatches;
window.cancelRfidAssignment = cancelRfidAssignment;
window.assignDetectedRfid = assignDetectedRfid;
window.rfidAssignmentMode = rfidAssignmentMode;


// Módulo de gestión de proveedores

/**
 * Cargar vista de proveedores
 */
async function loadSuppliersView() {
  const container = document.getElementById('suppliersContent');
  if (!container) return;
  
  try {
    const suppliers = await apiMedical.getAllSuppliers(true);
    renderSuppliers(suppliers);
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
    container.innerHTML = `<p class="text-danger">Error al cargar proveedores: ${error.message}</p>`;
  }
}

function renderSuppliers(suppliers) {
  const container = document.getElementById('suppliersContent');
  if (!container) return;
  
  if (suppliers.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay proveedores registrados</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Contacto</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>NIT/RUC</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${suppliers.map(supplier => `
            <tr>
              <td><strong>${escapeHtml(supplier.name)}</strong></td>
              <td>${escapeHtml(supplier.contact_person || '-')}</td>
              <td>${escapeHtml(supplier.email || '-')}</td>
              <td>${escapeHtml(supplier.phone || '-')}</td>
              <td>${escapeHtml(supplier.tax_id || '-')}</td>
              <td><span class="badge ${supplier.is_active ? 'badge-success' : 'badge-secondary'}">${supplier.is_active ? 'Activo' : 'Inactivo'}</span></td>
              <td>
                <button class="btn btn-sm btn-primary" onclick="editSupplier(${supplier.id})">✏️ Editar</button>
                ${supplier.is_active ? `<button class="btn btn-sm btn-danger" onclick="deleteSupplier(${supplier.id})">🗑️ Eliminar</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showSupplierForm(supplierId = null) {
  const modal = document.getElementById('supplierModal') || createSupplierModal();
  modal.style.display = 'block';
  
  if (supplierId) {
    loadSupplierForEdit(supplierId);
  } else {
    resetSupplierForm();
  }
}

function createSupplierModal() {
  const modal = document.createElement('div');
  modal.id = 'supplierModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeModal('supplierModal')">&times;</span>
      <h2 id="modalSupplierTitle">Nuevo Proveedor</h2>
      <form id="supplierForm" onsubmit="saveSupplier(event)">
        <div class="form-group">
          <label>Nombre del Proveedor *</label>
          <input type="text" id="supplierName" required>
        </div>
        <div class="form-group">
          <label>Persona de Contacto</label>
          <input type="text" id="supplierContactPerson">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="supplierEmail">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="text" id="supplierPhone">
          </div>
        </div>
        <div class="form-group">
          <label>Dirección</label>
          <textarea id="supplierAddress" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>NIT/RUC/ID Fiscal</label>
          <input type="text" id="supplierTaxId">
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="supplierNotes" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="supplierIsActive" checked> Proveedor Activo
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-success">Guardar</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('supplierModal')">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function resetSupplierForm() {
  document.getElementById('modalSupplierTitle').textContent = 'Nuevo Proveedor';
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierIsActive').checked = true;
  document.getElementById('supplierForm').onsubmit = saveSupplier;
}

async function loadSupplierForEdit(supplierId) {
  try {
    const supplier = await apiMedical.getSupplierById(supplierId);
    document.getElementById('modalSupplierTitle').textContent = 'Editar Proveedor';
    document.getElementById('supplierName').value = supplier.name || '';
    document.getElementById('supplierContactPerson').value = supplier.contact_person || '';
    document.getElementById('supplierEmail').value = supplier.email || '';
    document.getElementById('supplierPhone').value = supplier.phone || '';
    document.getElementById('supplierAddress').value = supplier.address || '';
    document.getElementById('supplierTaxId').value = supplier.tax_id || '';
    document.getElementById('supplierNotes').value = supplier.notes || '';
    document.getElementById('supplierIsActive').checked = supplier.is_active;
    document.getElementById('supplierForm').dataset.supplierId = supplierId;
  } catch (error) {
    console.error('Error al cargar proveedor:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function saveSupplier(event) {
  event.preventDefault();
  
  const supplierId = event.target.dataset.supplierId;
  const supplierData = {
    name: document.getElementById('supplierName').value,
    contact_person: document.getElementById('supplierContactPerson').value || null,
    email: document.getElementById('supplierEmail').value || null,
    phone: document.getElementById('supplierPhone').value || null,
    address: document.getElementById('supplierAddress').value || null,
    tax_id: document.getElementById('supplierTaxId').value || null,
    notes: document.getElementById('supplierNotes').value || null,
    is_active: document.getElementById('supplierIsActive').checked
  };
  
  try {
    if (supplierId) {
      await apiMedical.updateSupplier(supplierId, supplierData);
      showNotification('Proveedor actualizado correctamente', 'success');
    } else {
      await apiMedical.createSupplier(supplierData);
      showNotification('Proveedor creado correctamente', 'success');
    }
    closeModal('supplierModal');
    loadSuppliersView();
  } catch (error) {
    console.error('Error al guardar proveedor:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function editSupplier(supplierId) {
  showSupplierForm(supplierId);
}

async function deleteSupplier(supplierId) {
  if (!confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
    return;
  }
  
  try {
    await apiMedical.deleteSupplier(supplierId);
    showNotification('Proveedor eliminado correctamente', 'success');
    loadSuppliersView();
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Exportar funciones globalmente
window.loadSuppliersView = loadSuppliersView;
window.showSupplierForm = showSupplierForm;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.saveSupplier = saveSupplier;


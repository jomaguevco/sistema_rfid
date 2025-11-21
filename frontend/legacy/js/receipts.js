// Módulo de gestión de recepciones

let currentReceiptId = null;

/**
 * Cargar vista de recepciones
 */
async function loadReceiptsView() {
  const container = document.getElementById('receiptsContent');
  if (!container) {
    // Si no existe el contenedor, crear sección en orders
    return;
  }
  
  try {
    showLoading(true);
    const receipts = await apiMedical.getAllReceipts();
    renderReceipts(receipts.data || receipts);
  } catch (error) {
    console.error('Error al cargar recepciones:', error);
    showNotification(`Error al cargar recepciones: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Renderizar tabla de recepciones
 */
function renderReceipts(receipts) {
  const container = document.getElementById('receiptsContent');
  if (!container) return;
  
  if (!receipts || receipts.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay recepciones registradas</p>';
    return;
  }
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };
  
  container.innerHTML = `
    <div class="section-header">
      <h2>Gestión de Recepciones</h2>
      <div>
        <button onclick="loadReceiptsView()" class="btn btn-secondary">🔄 Actualizar</button>
      </div>
    </div>
    
    <div class="filters-bar">
      <input type="date" id="receiptStartDate" placeholder="Fecha inicio" onchange="filterReceipts()">
      <input type="date" id="receiptEndDate" placeholder="Fecha fin" onchange="filterReceipts()">
      <input type="text" id="receiptSearchInput" placeholder="Buscar por orden..." onkeyup="filterReceipts()">
    </div>
    
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Orden</th>
            <th>Proveedor</th>
            <th>Fecha Recepción</th>
            <th>Recibido Por</th>
            <th>Notas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="receiptsTableBody">
          ${receipts.map(receipt => `
            <tr>
              <td>${receipt.id}</td>
              <td>${receipt.order_number || '-'}</td>
              <td>${receipt.supplier_name || '-'}</td>
              <td>${formatDate(receipt.receipt_date)}</td>
              <td>${receipt.received_by_username || '-'}</td>
              <td>${receipt.notes || '-'}</td>
              <td>
                <button onclick="viewReceipt(${receipt.id})" class="btn btn-sm btn-info">Ver</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Ver detalles de recepción
 */
async function viewReceipt(receiptId) {
  try {
    showLoading(true);
    const receipt = await apiMedical.getReceiptById(receiptId);
    
    const modal = document.createElement('div');
    modal.id = 'receiptModal';
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px;">
        <span class="close" onclick="closeModal('receiptModal')">&times;</span>
        <h2>Detalles de Recepción #${receipt.data.id}</h2>
        
        <div class="receipt-details">
          <div class="detail-row">
            <strong>Orden:</strong> ${receipt.data.order_number || '-'}
          </div>
          <div class="detail-row">
            <strong>Proveedor:</strong> ${receipt.data.supplier_name || '-'}
          </div>
          <div class="detail-row">
            <strong>Fecha de Recepción:</strong> ${new Date(receipt.data.receipt_date).toLocaleDateString('es-ES')}
          </div>
          <div class="detail-row">
            <strong>Recibido Por:</strong> ${receipt.data.received_by_username || '-'}
          </div>
          ${receipt.data.notes ? `
            <div class="detail-row">
              <strong>Notas:</strong> ${receipt.data.notes}
            </div>
          ` : ''}
        </div>
        
        <div class="form-actions" style="margin-top: 20px;">
          <button onclick="closeModal('receiptModal')" class="btn btn-secondary">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Error al obtener recepción:', error);
    showNotification(`Error al obtener recepción: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Filtrar recepciones
 */
async function filterReceipts() {
  const startDate = document.getElementById('receiptStartDate')?.value;
  const endDate = document.getElementById('receiptEndDate')?.value;
  const search = document.getElementById('receiptSearchInput')?.value;
  
  try {
    showLoading(true);
    const filters = {};
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;
    
    const receipts = await apiMedical.getAllReceipts(filters);
    let filtered = receipts.data || receipts;
    
    if (search) {
      filtered = filtered.filter(r => 
        (r.order_number && r.order_number.toLowerCase().includes(search.toLowerCase())) ||
        (r.supplier_name && r.supplier_name.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    renderReceipts(filtered);
  } catch (error) {
    console.error('Error al filtrar recepciones:', error);
    showNotification(`Error al filtrar recepciones: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

// Exportar funciones globalmente
window.loadReceiptsView = loadReceiptsView;
window.viewReceipt = viewReceipt;
window.filterReceipts = filterReceipts;


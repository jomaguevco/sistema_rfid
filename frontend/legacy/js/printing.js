// Módulo de impresión de etiquetas

/**
 * Mostrar modal de impresión
 */
function showPrintModal(batchId = null) {
  const modal = document.createElement('div');
  modal.id = 'printModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closePrintModal()">&times;</span>
      <h2>Imprimir Etiquetas</h2>
      
      <div class="print-options">
        <div class="form-group">
          <label>Tipo de Impresión</label>
          <select id="printType" class="form-select" onchange="updatePrintOptions()">
            <option value="single">Etiqueta Individual</option>
            <option value="bulk">Impresión Masiva</option>
          </select>
        </div>
        
        <div id="singlePrintOptions" style="display: block;">
          <div class="form-group">
            <label>Lote</label>
            <select id="singleBatchId" class="form-select"></select>
          </div>
        </div>
        
        <div id="bulkPrintOptions" style="display: none;">
          <div class="form-group">
            <label>Seleccionar por:</label>
            <select id="bulkSelectType" class="form-select" onchange="updateBulkOptions()">
              <option value="batches">Lotes Específicos</option>
              <option value="products">Todos los Lotes de Productos</option>
            </select>
          </div>
          
          <div id="bulkBatchesOptions" style="display: block;">
            <label>Seleccionar Lotes:</label>
            <div id="batchesCheckboxes" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px;"></div>
          </div>
          
          <div id="bulkProductsOptions" style="display: none;">
            <label>Seleccionar Productos:</label>
            <div id="productsCheckboxes" style="max-height: 300px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px;"></div>
          </div>
        </div>
        
        <div class="form-group">
          <label>Tamaño de Etiqueta</label>
          <select id="labelSize" class="form-select">
            <option value="100x50">100mm x 50mm (Estándar)</option>
            <option value="80x40">80mm x 40mm (Pequeña)</option>
            <option value="120x60">120mm x 60mm (Grande)</option>
          </select>
        </div>
        
        <div class="form-actions" style="margin-top: 20px;">
          <button onclick="previewLabel()" class="btn btn-info">👁️ Vista Previa</button>
          <button onclick="printLabel()" class="btn btn-success">🖨️ Imprimir PDF</button>
          <button onclick="closePrintModal()" class="btn btn-secondary">Cancelar</button>
        </div>
      </div>
      
      <div id="printPreview" style="display: none; margin-top: 20px; border: 1px solid #ddd; padding: 20px; border-radius: 8px;"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cargar datos
  loadPrintData(batchId);
  
  modal.onclick = function(event) {
    if (event.target === modal) {
      closePrintModal();
    }
  };
}

function closePrintModal() {
  const modal = document.getElementById('printModal');
  if (modal) {
    modal.remove();
  }
}

function updatePrintOptions() {
  const printType = document.getElementById('printType')?.value;
  const singleOptions = document.getElementById('singlePrintOptions');
  const bulkOptions = document.getElementById('bulkPrintOptions');
  
  if (printType === 'single') {
    if (singleOptions) singleOptions.style.display = 'block';
    if (bulkOptions) bulkOptions.style.display = 'none';
  } else {
    if (singleOptions) singleOptions.style.display = 'none';
    if (bulkOptions) bulkOptions.style.display = 'block';
  }
}

function updateBulkOptions() {
  const selectType = document.getElementById('bulkSelectType')?.value;
  const batchesOptions = document.getElementById('bulkBatchesOptions');
  const productsOptions = document.getElementById('bulkProductsOptions');
  
  if (selectType === 'batches') {
    if (batchesOptions) batchesOptions.style.display = 'block';
    if (productsOptions) productsOptions.style.display = 'none';
  } else {
    if (batchesOptions) batchesOptions.style.display = 'none';
    if (productsOptions) productsOptions.style.display = 'block';
  }
}

async function loadPrintData(selectedBatchId = null) {
  try {
    // Cargar lotes para selector individual
    const batches = await apiMedical.getAllProducts({}).then(async products => {
      const allBatches = [];
      for (const product of products) {
        const productBatches = await apiMedical.getProductBatches(product.id);
        allBatches.push(...productBatches.map(b => ({ ...b, product_name: product.name })));
      }
      return allBatches;
    });
    
    const singleBatchSelect = document.getElementById('singleBatchId');
    if (singleBatchSelect) {
      singleBatchSelect.innerHTML = '<option value="">Seleccionar lote</option>';
      batches.forEach(batch => {
        const option = document.createElement('option');
        option.value = batch.id;
        option.textContent = `${batch.product_name} - Lote: ${batch.lot_number}`;
        if (selectedBatchId && batch.id === selectedBatchId) {
          option.selected = true;
        }
        singleBatchSelect.appendChild(option);
      });
    }
    
    // Cargar checkboxes para lotes
    const batchesCheckboxes = document.getElementById('batchesCheckboxes');
    if (batchesCheckboxes) {
      batchesCheckboxes.innerHTML = batches.map(batch => `
        <label style="display: block; padding: 5px;">
          <input type="checkbox" value="${batch.id}" class="batch-checkbox">
          ${escapeHtml(batch.product_name)} - Lote: ${escapeHtml(batch.lot_number)}
        </label>
      `).join('');
    }
    
    // Cargar productos para checkboxes
    const products = await apiMedical.getAllProducts({});
    const productsCheckboxes = document.getElementById('productsCheckboxes');
    if (productsCheckboxes) {
      productsCheckboxes.innerHTML = products.map(product => `
        <label style="display: block; padding: 5px;">
          <input type="checkbox" value="${product.id}" class="product-checkbox">
          ${escapeHtml(product.name)}
        </label>
      `).join('');
    }
  } catch (error) {
    console.error('Error al cargar datos para impresión:', error);
    showNotification(`Error al cargar datos: ${error.message}`, 'error');
  }
}

async function previewLabel() {
  const printType = document.getElementById('printType')?.value;
  const previewDiv = document.getElementById('printPreview');
  
  if (!previewDiv) return;
  
  try {
    if (printType === 'single') {
      const batchId = document.getElementById('singleBatchId')?.value;
      if (!batchId) {
        showNotification('Selecciona un lote', 'warning');
        return;
      }
      
      const token = localStorage.getItem('authToken');
      const size = document.getElementById('labelSize')?.value || '100x50';
      const response = await fetch(`/api/printing/preview/${batchId}?size=${size}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        previewDiv.innerHTML = html;
        previewDiv.style.display = 'block';
      } else {
        const data = await response.json();
        showNotification(`Error: ${data.error}`, 'error');
      }
    } else {
      showNotification('La vista previa masiva no está disponible', 'info');
    }
  } catch (error) {
    console.error('Error en vista previa:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function printLabel() {
  const printType = document.getElementById('printType')?.value;
  const size = document.getElementById('labelSize')?.value || '100x50';
  
  try {
    const token = localStorage.getItem('authToken');
    let url = '';
    
    if (printType === 'single') {
      const batchId = document.getElementById('singleBatchId')?.value;
      if (!batchId) {
        showNotification('Selecciona un lote', 'warning');
        return;
      }
      url = `/api/printing/pdf/${batchId}?size=${size}`;
    } else {
      // Impresión masiva
      const selectType = document.getElementById('bulkSelectType')?.value;
      let batchIds = [];
      let productIds = [];
      
      if (selectType === 'batches') {
        const checkboxes = document.querySelectorAll('.batch-checkbox:checked');
        batchIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (batchIds.length === 0) {
          showNotification('Selecciona al menos un lote', 'warning');
          return;
        }
      } else {
        const checkboxes = document.querySelectorAll('.product-checkbox:checked');
        productIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (productIds.length === 0) {
          showNotification('Selecciona al menos un producto', 'warning');
          return;
        }
      }
      
      const response = await fetch('/api/printing/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchIds: batchIds.length > 0 ? batchIds : undefined,
          productIds: productIds.length > 0 ? productIds : undefined,
          options: { size: size }
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiquetas_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('PDF generado correctamente', 'success');
        return;
      } else {
        const data = await response.json();
        showNotification(`Error: ${data.error}`, 'error');
        return;
      }
    }
    
    // Para impresión individual
    if (url) {
      window.open(url, '_blank');
      showNotification('Abriendo PDF...', 'success');
    }
  } catch (error) {
    console.error('Error al imprimir:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// Exportar funciones globalmente
window.showPrintModal = showPrintModal;
window.closePrintModal = closePrintModal;
window.updatePrintOptions = updatePrintOptions;
window.updateBulkOptions = updateBulkOptions;
window.previewLabel = previewLabel;
window.printLabel = printLabel;


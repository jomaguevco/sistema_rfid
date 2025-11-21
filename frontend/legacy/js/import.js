// Módulo de importación masiva

let importResults = null;

/**
 * Mostrar modal de importación
 */
function showImportModal(type = 'products') {
  const modal = document.createElement('div');
  modal.id = 'importModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeImportModal()">&times;</span>
      <h2>Importar ${type === 'products' ? 'Productos' : 'Lotes'}</h2>
      
      <div class="import-container">
        <div class="import-zone" id="importZone" 
             ondrop="handleDrop(event)" 
             ondragover="handleDragOver(event)"
             ondragleave="handleDragLeave(event)">
          <div class="import-icon">📁</div>
          <p>Arrastra y suelta tu archivo aquí</p>
          <p class="text-muted">o</p>
          <input type="file" id="importFile" accept=".csv,.xlsx,.xls" style="display:none;" onchange="handleFileSelect(event)">
          <button class="btn btn-primary" onclick="document.getElementById('importFile').click()">
            Seleccionar archivo
          </button>
          <p class="text-muted" style="margin-top: 10px; font-size: 12px;">
            Formatos soportados: CSV, Excel (.xlsx, .xls)<br>
            Tamaño máximo: 10MB
          </p>
        </div>
        
        <div id="filePreview" style="display:none; margin-top: 20px;">
          <h3>Vista previa</h3>
          <div id="previewContent" style="max-height: 300px; overflow: auto; border: 1px solid #ddd; padding: 10px; border-radius: 8px;"></div>
          <div style="margin-top: 15px;">
            <button class="btn btn-success" onclick="processImport('${type}')">Importar</button>
            <button class="btn btn-secondary" onclick="resetImport()">Cancelar</button>
          </div>
        </div>
        
        <div id="importResults" style="display:none; margin-top: 20px;"></div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
        <h4>Descargar Template</h4>
        <p class="text-muted">Descarga un archivo de ejemplo para ver el formato requerido</p>
        <button class="btn btn-info" onclick="downloadTemplate('${type}')">
          📥 Descargar Template CSV
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cerrar al hacer clic fuera
  modal.onclick = function(event) {
    if (event.target === modal) {
      closeImportModal();
    }
  };
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) {
    modal.remove();
  }
  resetImport();
}

function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.style.background = '#e3f2fd';
}

function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.style.background = '';
}

function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.style.background = '';
  
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

async function handleFile(file) {
  const importZone = document.getElementById('importZone');
  const filePreview = document.getElementById('filePreview');
  const previewContent = document.getElementById('previewContent');
  
  // Validar tipo de archivo
  const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
    showNotification('Tipo de archivo no válido. Solo CSV y Excel.', 'error');
    return;
  }
  
  // Validar tamaño
  if (file.size > 10 * 1024 * 1024) {
    showNotification('El archivo es demasiado grande. Máximo 10MB.', 'error');
    return;
  }
  
  importZone.style.display = 'none';
  filePreview.style.display = 'block';
  
  // Mostrar información del archivo
  previewContent.innerHTML = `
    <p><strong>Archivo:</strong> ${file.name}</p>
    <p><strong>Tamaño:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
    <p><strong>Tipo:</strong> ${file.type || 'Desconocido'}</p>
    <p class="text-muted">Preparado para importar. Haz clic en "Importar" para continuar.</p>
  `;
  
  // Guardar archivo para procesamiento
  window.selectedImportFile = file;
}

function resetImport() {
  const importZone = document.getElementById('importZone');
  const filePreview = document.getElementById('filePreview');
  const importResults = document.getElementById('importResults');
  
  if (importZone) importZone.style.display = 'block';
  if (filePreview) filePreview.style.display = 'none';
  if (importResults) importResults.style.display = 'none';
  
  window.selectedImportFile = null;
  importResults = null;
}

async function processImport(type) {
  if (!window.selectedImportFile) {
    showNotification('Por favor selecciona un archivo primero', 'warning');
    return;
  }
  
  const importResultsDiv = document.getElementById('importResults');
  importResultsDiv.style.display = 'block';
  importResultsDiv.innerHTML = '<p>Cargando...</p>';
  
  try {
    const formData = new FormData();
    formData.append('file', window.selectedImportFile);
    
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/import/${type}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      importResults = data.data;
      renderImportResults(data.data, type);
    } else {
      showNotification(`Error: ${data.error}`, 'error');
      importResultsDiv.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
    }
  } catch (error) {
    console.error('Error en importación:', error);
    showNotification(`Error al importar: ${error.message}`, 'error');
    importResultsDiv.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
  }
}

function renderImportResults(results, type) {
  const importResultsDiv = document.getElementById('importResults');
  
  let html = `
    <h3>Resultados de Importación</h3>
    <div class="import-summary">
      <div class="summary-card success">
        <div class="summary-value">${results.success}</div>
        <div class="summary-label">Importados</div>
      </div>
      <div class="summary-card error">
        <div class="summary-value">${results.errors.length}</div>
        <div class="summary-label">Errores</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-value">${results.skipped.length}</div>
        <div class="summary-label">Omitidos</div>
      </div>
      <div class="summary-card info">
        <div class="summary-value">${results.warnings.length}</div>
        <div class="summary-label">Advertencias</div>
      </div>
    </div>
  `;
  
  if (results.errors.length > 0) {
    html += `
      <div style="margin-top: 20px;">
        <h4>Errores</h4>
        <div style="max-height: 200px; overflow: auto; border: 1px solid #fcc; padding: 10px; border-radius: 8px; background: #ffe;">
          ${results.errors.map(e => `
            <p><strong>Fila ${e.row}:</strong> ${e.errors.join(', ')}</p>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (results.warnings.length > 0) {
    html += `
      <div style="margin-top: 20px;">
        <h4>Advertencias</h4>
        <div style="max-height: 200px; overflow: auto; border: 1px solid #ffc; padding: 10px; border-radius: 8px; background: #fff9e6;">
          ${results.warnings.map(w => `
            <p><strong>Fila ${w.row}:</strong> ${w.warning}</p>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (results.created.length > 0) {
    html += `
      <div style="margin-top: 20px;">
        <h4>Elementos Importados (${results.created.length})</h4>
        <div style="max-height: 200px; overflow: auto; border: 1px solid #cfc; padding: 10px; border-radius: 8px; background: #e6ffe6;">
          ${results.created.map(c => `
            <p><strong>Fila ${c.row}:</strong> ${type === 'products' ? c.product.name : `Lote ${c.batch.lot_number}`}</p>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  html += `
    <div style="margin-top: 20px;">
      <button class="btn btn-primary" onclick="closeImportModal(); ${type === 'products' ? 'loadProducts()' : 'loadBatchesView()'}">
        Cerrar y Actualizar
      </button>
    </div>
  `;
  
  importResultsDiv.innerHTML = html;
}

async function downloadTemplate(type) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/import/template/${type}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${type}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showNotification('Template descargado correctamente', 'success');
    } else {
      const data = await response.json();
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error al descargar template:', error);
    showNotification(`Error al descargar template: ${error.message}`, 'error');
  }
}

// Exportar funciones globalmente
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.handleDrop = handleDrop;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleFileSelect = handleFileSelect;
window.processImport = processImport;
window.resetImport = resetImport;
window.downloadTemplate = downloadTemplate;


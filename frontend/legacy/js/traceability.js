// Módulo de trazabilidad completa
let traceabilityData = [];

async function loadTraceabilityView() {
  try {
    showLoading(true);
    
    const type = document.getElementById('traceabilityType')?.value || 'all';
    const productId = document.getElementById('traceabilityProduct')?.value;
    const batchId = document.getElementById('traceabilityBatch')?.value;
    const areaId = document.getElementById('traceabilityArea')?.value;
    const startDate = document.getElementById('traceabilityStartDate')?.value;
    const endDate = document.getElementById('traceabilityEndDate')?.value;
    
    // Mostrar/ocultar filtros según el tipo
    updateTraceabilityFilters(type);
    
    // Cargar datos según el tipo
    let data = [];
    switch(type) {
      case 'product':
        if (productId) {
          data = await apiMedical.getProductHistory(productId, { area_id: areaId, start_date: startDate, end_date: endDate });
        }
        break;
      case 'batch':
        if (batchId) {
          data = await apiMedical.getBatchHistory(batchId, { start_date: startDate, end_date: endDate });
        }
        break;
      case 'area':
        if (areaId) {
          data = await apiMedical.getAreaHistory(areaId, { product_id: productId, start_date: startDate, end_date: endDate });
        }
        break;
      default:
        data = await apiMedical.getAllTraceability({
          product_id: productId || null,
          batch_id: batchId || null,
          area_id: areaId || null,
          start_date: startDate || null,
          end_date: endDate || null
        });
    }
    
    traceabilityData = data;
    renderTraceability(data);
    
  } catch (error) {
    console.error('Error al cargar trazabilidad:', error);
    showNotification(`Error al cargar trazabilidad: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

function updateTraceabilityFilters(type) {
  const productSelect = document.getElementById('traceabilityProduct');
  const batchSelect = document.getElementById('traceabilityBatch');
  const areaSelect = document.getElementById('traceabilityArea');
  
  // Ocultar todos primero
  if (productSelect) productSelect.style.display = 'none';
  if (batchSelect) batchSelect.style.display = 'none';
  if (areaSelect) areaSelect.style.display = 'none';
  
  // Mostrar según el tipo
  switch(type) {
    case 'product':
      if (productSelect) {
        productSelect.style.display = 'inline-block';
        loadProductsForTraceability();
      }
      break;
    case 'batch':
      if (batchSelect) {
        batchSelect.style.display = 'inline-block';
        loadBatchesForTraceability();
      }
      break;
    case 'area':
      if (areaSelect) {
        areaSelect.style.display = 'inline-block';
        loadAreasForTraceability();
      }
      break;
  }
  
  // Siempre mostrar área si hay filtros de fecha
  if (areaSelect && (type === 'all' || type === 'product')) {
    areaSelect.style.display = 'inline-block';
    loadAreasForTraceability();
  }
}

async function loadProductsForTraceability() {
  try {
    const products = await apiMedical.getAllProducts();
    const select = document.getElementById('traceabilityProduct');
    if (select) {
      select.innerHTML = '<option value="">Todos los productos</option>';
      products.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
}

async function loadBatchesForTraceability() {
  try {
    // Cargar todos los lotes (necesitaríamos un endpoint para esto)
    // Por ahora, cargar productos y luego sus lotes
    const products = await apiMedical.getAllProducts();
    const select = document.getElementById('traceabilityBatch');
    if (select) {
      select.innerHTML = '<option value="">Todos los lotes</option>';
      // Cargar lotes de cada producto
      for (const product of products.slice(0, 50)) { // Limitar a 50 productos
        try {
          const batches = await apiMedical.getProductBatches(product.id);
          batches.forEach(batch => {
            const option = document.createElement('option');
            option.value = batch.id;
            option.textContent = `${product.name} - Lote: ${batch.lot_number}`;
            select.appendChild(option);
          });
        } catch (err) {
          console.error(`Error al cargar lotes de ${product.name}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Error al cargar lotes:', error);
  }
}

async function loadAreasForTraceability() {
  try {
    const areas = await apiMedical.getAllAreas();
    const select = document.getElementById('traceabilityArea');
    if (select) {
      select.innerHTML = '<option value="">Todas las áreas</option>';
      areas.forEach(a => {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = a.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error al cargar áreas:', error);
  }
}

function renderTraceability(data) {
  const container = document.getElementById('traceabilityResults');
  if (!container) return;
  
  if (data.length === 0) {
    container.innerHTML = '<p class="text-muted">No se encontraron registros de trazabilidad</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Producto</th>
            <th>Lote</th>
            <th>Área</th>
            <th>Acción</th>
            <th>Stock Anterior</th>
            <th>Stock Nuevo</th>
            <th>Cantidad</th>
            <th>Notas</th>
          </tr>
        </thead>
        <tbody id="traceabilityTableBody"></tbody>
      </table>
    </div>
  `;
  
  const tbody = document.getElementById('traceabilityTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = data.map(record => {
    const actionBadge = record.action === 'remove' 
      ? '<span class="badge badge-danger">Retiro</span>'
      : '<span class="badge badge-success">Ingreso</span>';
    
    const quantity = record.previous_stock - record.new_stock;
    const quantityDisplay = record.action === 'remove' ? `-${Math.abs(quantity)}` : `+${quantity}`;
    const quantityClass = record.action === 'remove' ? 'text-danger' : 'text-success';
    
    return `
      <tr>
        <td>${formatDateTime(record.consumption_date || record.created_at)}</td>
        <td><strong>${escapeHtml(record.product_name || '-')}</strong></td>
        <td>${escapeHtml(record.lot_number || '-')}</td>
        <td>${escapeHtml(record.area_name || '-')}</td>
        <td>${actionBadge}</td>
        <td>${record.previous_stock || 0}</td>
        <td>${record.new_stock || 0}</td>
        <td class="${quantityClass}"><strong>${quantityDisplay}</strong></td>
        <td>${escapeHtml(record.notes || '-')}</td>
      </tr>
    `;
  }).join('');
  
  // Agregar resumen
  const summary = calculateTraceabilitySummary(data);
  container.innerHTML += `
    <div class="summary-card" style="margin-top: 20px;">
      <h4>Resumen</h4>
      <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="metric-card">
          <div class="metric-value">${summary.total_records}</div>
          <div class="metric-label">Total Registros</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${summary.total_removed}</div>
          <div class="metric-label">Total Retirado</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${summary.total_added}</div>
          <div class="metric-label">Total Ingresado</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${summary.unique_products}</div>
          <div class="metric-label">Productos Únicos</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${summary.unique_areas}</div>
          <div class="metric-label">Áreas Únicas</div>
        </div>
      </div>
    </div>
  `;
}

function calculateTraceabilitySummary(data) {
  const summary = {
    total_records: data.length,
    total_removed: 0,
    total_added: 0,
    unique_products: new Set(),
    unique_areas: new Set()
  };
  
  data.forEach(record => {
    const quantity = record.previous_stock - record.new_stock;
    if (record.action === 'remove') {
      summary.total_removed += Math.abs(quantity);
    } else {
      summary.total_added += quantity;
    }
    if (record.product_id) summary.unique_products.add(record.product_id);
    if (record.area_id) summary.unique_areas.add(record.area_id);
  });
  
  summary.unique_products = summary.unique_products.size;
  summary.unique_areas = summary.unique_areas.size;
  
  return summary;
}

function clearTraceabilityFilters() {
  document.getElementById('traceabilityType').value = 'all';
  document.getElementById('traceabilityProduct').value = '';
  document.getElementById('traceabilityBatch').value = '';
  document.getElementById('traceabilityArea').value = '';
  document.getElementById('traceabilityStartDate').value = '';
  document.getElementById('traceabilityEndDate').value = '';
  updateTraceabilityFilters('all');
  loadTraceabilityView();
}

function exportTraceability() {
  if (traceabilityData.length === 0) {
    showNotification('No hay datos para exportar', 'warning');
    return;
  }
  
  // Crear CSV
  const headers = ['Fecha', 'Producto', 'Lote', 'Área', 'Acción', 'Stock Anterior', 'Stock Nuevo', 'Cantidad', 'Notas'];
  const rows = traceabilityData.map(record => {
    const quantity = record.previous_stock - record.new_stock;
    return [
      formatDateTime(record.consumption_date || record.created_at),
      record.product_name || '',
      record.lot_number || '',
      record.area_name || '',
      record.action === 'remove' ? 'Retiro' : 'Ingreso',
      record.previous_stock || 0,
      record.new_stock || 0,
      record.action === 'remove' ? -Math.abs(quantity) : quantity,
      record.notes || ''
    ];
  });
  
  const csv = [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  // Descargar
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `trazabilidad_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification('Trazabilidad exportada correctamente', 'success');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('es-ES');
}

// Funciones de utilidad
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

// Exportar funciones globalmente
window.loadTraceabilityView = loadTraceabilityView;
window.clearTraceabilityFilters = clearTraceabilityFilters;
window.exportTraceability = exportTraceability;


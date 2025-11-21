// Módulo de búsqueda avanzada
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
let savedSearches = JSON.parse(localStorage.getItem('savedSearches') || '[]');

function initAdvancedSearch() {
  const searchContainer = document.getElementById('products-section');
  if (!searchContainer) return;
  
  // Mejorar la barra de búsqueda existente
  const filtersBar = searchContainer.querySelector('.filters-bar');
  if (filtersBar) {
    // Agregar botón de búsqueda avanzada
    const advancedBtn = document.createElement('button');
    advancedBtn.className = 'btn btn-info btn-sm';
    advancedBtn.innerHTML = '🔍 Búsqueda Avanzada';
    advancedBtn.onclick = () => showAdvancedSearchModal();
    filtersBar.appendChild(advancedBtn);
    
    // Agregar botón de búsquedas guardadas
    const savedBtn = document.createElement('button');
    savedBtn.className = 'btn btn-secondary btn-sm';
    savedBtn.innerHTML = '💾 Guardadas';
    savedBtn.onclick = () => showSavedSearchesModal();
    filtersBar.appendChild(savedBtn);
  }
}

function showAdvancedSearchModal() {
  const modal = document.getElementById('advancedSearchModal');
  if (!modal) {
    createAdvancedSearchModal();
    return;
  }
  modal.style.display = 'block';
}

function createAdvancedSearchModal() {
  const modal = document.createElement('div');
  modal.id = 'advancedSearchModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeModal('advancedSearchModal')">&times;</span>
      <h2>Búsqueda Avanzada</h2>
      <form id="advancedSearchForm" onsubmit="executeAdvancedSearch(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Nombre del Producto</label>
            <input type="text" id="searchName" placeholder="Buscar por nombre...">
          </div>
          <div class="form-group">
            <label>Principio Activo</label>
            <input type="text" id="searchActiveIngredient" placeholder="Buscar por principio activo...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Tag RFID</label>
            <input type="text" id="searchRfid" placeholder="Buscar por RFID...">
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select id="searchType">
              <option value="">Todos</option>
              <option value="medicamento">Medicamento</option>
              <option value="insumo">Insumo Médico</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Categoría</label>
            <select id="searchCategory">
              <option value="">Todas</option>
            </select>
          </div>
          <div class="form-group">
            <label>Estado de Vencimiento</label>
            <select id="searchExpiryStatus">
              <option value="">Todos</option>
              <option value="expired">Vencidos</option>
              <option value="expiring_soon">Por vencer (30 días)</option>
              <option value="valid">Vigentes</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Stock Mínimo</label>
            <input type="number" id="searchMinStock" min="0" placeholder="Mínimo">
          </div>
          <div class="form-group">
            <label>Stock Máximo</label>
            <input type="number" id="searchMaxStock" min="0" placeholder="Máximo">
          </div>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="searchLowStock"> Solo productos con stock bajo
          </label>
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="searchRequiresRefrigeration"> Requiere refrigeración
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">🔍 Buscar</button>
          <button type="button" class="btn btn-secondary" onclick="saveCurrentSearch()">💾 Guardar Búsqueda</button>
          <button type="button" class="btn btn-secondary" onclick="resetAdvancedSearch()">🔄 Limpiar</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('advancedSearchModal')">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Cargar categorías en el select
  loadCategoriesForSearch();
}

function loadCategoriesForSearch() {
  if (typeof apiMedical !== 'undefined' && typeof apiMedical.getAllCategories === 'function') {
    apiMedical.getAllCategories().then(categories => {
      const select = document.getElementById('searchCategory');
      if (select) {
        categories.forEach(cat => {
          const option = document.createElement('option');
          option.value = cat.id;
          option.textContent = cat.name;
          select.appendChild(option);
        });
      }
    }).catch(err => console.error('Error al cargar categorías:', err));
  }
}

function executeAdvancedSearch(event) {
  if (event) event.preventDefault();
  
  const filters = {
    search: document.getElementById('searchName')?.value.trim() || '',
    active_ingredient: document.getElementById('searchActiveIngredient')?.value.trim() || '',
    rfid_uid: document.getElementById('searchRfid')?.value.trim() || '',
    product_type: document.getElementById('searchType')?.value || '',
    category_id: document.getElementById('searchCategory')?.value || '',
    expiry_status: document.getElementById('searchExpiryStatus')?.value || '',
    min_stock: document.getElementById('searchMinStock')?.value || '',
    max_stock: document.getElementById('searchMaxStock')?.value || '',
    low_stock: document.getElementById('searchLowStock')?.checked || false,
    requires_refrigeration: document.getElementById('searchRequiresRefrigeration')?.checked || false
  };
  
  // Guardar en historial
  saveSearchToHistory(filters);
  
  // Guardar filtros avanzados globalmente
  window.currentAdvancedFilters = filters;
  
  // Aplicar filtros a la búsqueda principal
  applyFiltersToMainSearch(filters);
  
  // Cerrar modal
  closeModal('advancedSearchModal');
  
  // Ejecutar búsqueda
  if (typeof loadProducts === 'function') {
    loadProducts();
  }
}

function applyFiltersToMainSearch(filters) {
  // Aplicar filtros a los campos principales
  if (filters.search && document.getElementById('searchInput')) {
    document.getElementById('searchInput').value = filters.search;
  }
  if (filters.product_type && document.getElementById('filterType')) {
    document.getElementById('filterType').value = filters.product_type;
  }
  if (filters.category_id && document.getElementById('filterCategory')) {
    document.getElementById('filterCategory').value = filters.category_id;
  }
  if (filters.expiry_status && document.getElementById('filterExpiry')) {
    document.getElementById('filterExpiry').value = filters.expiry_status;
  }
  if (filters.low_stock && document.getElementById('filterStock')) {
    document.getElementById('filterStock').value = 'low';
  }
}

function saveSearchToHistory(filters) {
  const searchEntry = {
    ...filters,
    timestamp: new Date().toISOString()
  };
  
  searchHistory.unshift(searchEntry);
  if (searchHistory.length > 20) {
    searchHistory = searchHistory.slice(0, 20);
  }
  
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

function saveCurrentSearch() {
  const name = prompt('Nombre para esta búsqueda:');
  if (!name) return;
  
  const filters = {
    name: name,
    search: document.getElementById('searchName')?.value.trim() || '',
    active_ingredient: document.getElementById('searchActiveIngredient')?.value.trim() || '',
    rfid_uid: document.getElementById('searchRfid')?.value.trim() || '',
    product_type: document.getElementById('searchType')?.value || '',
    category_id: document.getElementById('searchCategory')?.value || '',
    expiry_status: document.getElementById('searchExpiryStatus')?.value || '',
    min_stock: document.getElementById('searchMinStock')?.value || '',
    max_stock: document.getElementById('searchMaxStock')?.value || '',
    low_stock: document.getElementById('searchLowStock')?.checked || false,
    requires_refrigeration: document.getElementById('searchRequiresRefrigeration')?.checked || false,
    created_at: new Date().toISOString()
  };
  
  savedSearches.push(filters);
  localStorage.setItem('savedSearches', JSON.stringify(savedSearches));
  
  showNotification(`Búsqueda "${name}" guardada correctamente`, 'success');
}

function resetAdvancedSearch() {
  const form = document.getElementById('advancedSearchForm');
  if (form) {
    form.reset();
  }
}

function showSavedSearchesModal() {
  const modal = document.createElement('div');
  modal.id = 'savedSearchesModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  let html = `
    <div class="modal-content">
      <span class="close" onclick="closeModal('savedSearchesModal')">&times;</span>
      <h2>Búsquedas Guardadas</h2>
      <div id="savedSearchesList" style="max-height: 400px; overflow-y: auto;">
  `;
  
  if (savedSearches.length === 0) {
    html += '<p class="text-muted">No hay búsquedas guardadas</p>';
  } else {
    html += '<ul style="list-style: none; padding: 0;">';
    savedSearches.forEach((search, index) => {
      html += `
        <li style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${escapeHtml(search.name)}</strong>
            <small style="display: block; color: #666;">${new Date(search.created_at).toLocaleDateString()}</small>
          </div>
          <div>
            <button class="btn btn-sm btn-primary" onclick="loadSavedSearch(${index})">Usar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSavedSearch(${index})">Eliminar</button>
          </div>
        </li>
      `;
    });
    html += '</ul>';
  }
  
  html += `
      </div>
    </div>
  `;
  
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

function loadSavedSearch(index) {
  const search = savedSearches[index];
  if (!search) return;
  
  // Llenar formulario de búsqueda avanzada
  if (document.getElementById('searchName')) document.getElementById('searchName').value = search.search || '';
  if (document.getElementById('searchActiveIngredient')) document.getElementById('searchActiveIngredient').value = search.active_ingredient || '';
  if (document.getElementById('searchRfid')) document.getElementById('searchRfid').value = search.rfid_uid || '';
  if (document.getElementById('searchType')) document.getElementById('searchType').value = search.product_type || '';
  if (document.getElementById('searchCategory')) document.getElementById('searchCategory').value = search.category_id || '';
  if (document.getElementById('searchExpiryStatus')) document.getElementById('searchExpiryStatus').value = search.expiry_status || '';
  if (document.getElementById('searchMinStock')) document.getElementById('searchMinStock').value = search.min_stock || '';
  if (document.getElementById('searchMaxStock')) document.getElementById('searchMaxStock').value = search.max_stock || '';
  if (document.getElementById('searchLowStock')) document.getElementById('searchLowStock').checked = search.low_stock || false;
  if (document.getElementById('searchRequiresRefrigeration')) document.getElementById('searchRequiresRefrigeration').checked = search.requires_refrigeration || false;
  
  closeModal('savedSearchesModal');
  showAdvancedSearchModal();
}

function deleteSavedSearch(index) {
  if (confirm('¿Eliminar esta búsqueda guardada?')) {
    savedSearches.splice(index, 1);
    localStorage.setItem('savedSearches', JSON.stringify(savedSearches));
    showSavedSearchesModal();
  }
}

// Mejorar la función de búsqueda por RFID
function searchByRfid(rfidUid) {
  if (!rfidUid) return;
  
  // Aplicar filtro de RFID
  if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').value = rfidUid;
  }
  
  // Ejecutar búsqueda
  if (typeof loadProducts === 'function') {
    loadProducts();
  }
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

if (typeof window.closeModal === 'undefined') {
  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
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
window.initAdvancedSearch = initAdvancedSearch;
window.showAdvancedSearchModal = showAdvancedSearchModal;
window.executeAdvancedSearch = executeAdvancedSearch;
window.saveCurrentSearch = saveCurrentSearch;
window.resetAdvancedSearch = resetAdvancedSearch;
window.showSavedSearchesModal = showSavedSearchesModal;
window.loadSavedSearch = loadSavedSearch;
window.deleteSavedSearch = deleteSavedSearch;
window.searchByRfid = searchByRfid;

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdvancedSearch);
} else {
  initAdvancedSearch();
}


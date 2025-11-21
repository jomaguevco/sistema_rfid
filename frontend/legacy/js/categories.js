// Módulo de gestión de categorías médicas
let categories = [];

async function loadCategoriesView() {
  try {
    console.log('🔄 Cargando categorías...');
    showLoading(true);
    
    // Verificar que apiMedical esté disponible
    if (typeof apiMedical === 'undefined' || !apiMedical) {
      throw new Error('apiMedical no está disponible');
    }
    
    categories = await apiMedical.getAllCategories();
    console.log('✓ Categorías cargadas:', categories.length);
    renderCategories();
  } catch (error) {
    console.error('❌ Error al cargar categorías:', error);
    showNotification(`Error al cargar categorías: ${error.message}`, 'error');
    
    // Mostrar mensaje en el contenedor
    const container = document.getElementById('categoriesContent');
    if (container) {
      container.innerHTML = `<p class="text-danger">Error al cargar categorías: ${error.message}</p>`;
    }
  } finally {
    showLoading(false);
  }
}

function renderCategories() {
  const container = document.getElementById('categoriesContent');
  if (!container) return;
  
  if (categories.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay categorías registradas</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Descripción</th>
            <th>Productos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="categoriesTableBody"></tbody>
      </table>
    </div>
  `;
  
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;
  
  // Cargar conteo de productos por categoría
  Promise.all(categories.map(async (cat) => {
    try {
      const products = await apiMedical.getAllProducts({ category_id: cat.id });
      return { ...cat, product_count: products.length };
    } catch (error) {
      return { ...cat, product_count: 0 };
    }
  })).then(categoriesWithCount => {
    tbody.innerHTML = categoriesWithCount.map(cat => `
      <tr>
        <td>${cat.id}</td>
        <td><strong>${escapeHtml(cat.name)}</strong></td>
        <td>${escapeHtml(cat.description || '-')}</td>
        <td><span class="badge badge-info">${cat.product_count}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editCategory(${cat.id})">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory(${cat.id})" ${cat.product_count > 0 ? 'disabled title="No se puede eliminar: tiene productos asociados"' : ''}>🗑️ Eliminar</button>
        </td>
      </tr>
    `).join('');
  });
}

function showCategoryForm(category = null) {
  editingCategoryId = category ? category.id : null;
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('modalCategoryTitle');
  const form = document.getElementById('categoryForm');
  
  if (!modal || !form) {
    console.error('Modal o formulario de categoría no encontrado');
    return;
  }
  
  if (category) {
    title.textContent = 'Editar Categoría';
    document.getElementById('categoryName').value = category.name || '';
    document.getElementById('categoryDescription').value = category.description || '';
  } else {
    title.textContent = 'Nueva Categoría';
    form.reset();
  }
  
  modal.style.display = 'block';
}

async function saveCategory(event) {
  if (event) {
    event.preventDefault();
  }
  
  const name = document.getElementById('categoryName')?.value.trim();
  if (!name) {
    showNotification('El nombre de la categoría es obligatorio', 'error');
    return;
  }
  
  const categoryData = {
    name: name,
    description: document.getElementById('categoryDescription')?.value.trim() || null
  };
  
  try {
    showLoading(true);
    
    if (editingCategoryId) {
      await apiMedical.updateCategory(editingCategoryId, categoryData);
      showNotification('Categoría actualizada correctamente', 'success');
    } else {
      await apiMedical.createCategory(categoryData);
      showNotification('Categoría creada correctamente', 'success');
    }
    
    closeModal('categoryModal');
    editingCategoryId = null;
    await loadCategoriesView();
    
    // Recargar categorías en otros módulos
    if (typeof loadCategories === 'function') {
      await loadCategories();
    }
  } catch (error) {
    console.error('Error al guardar categoría:', error);
    showNotification(`Error: ${error.message || 'Error desconocido al guardar categoría'}`, 'error');
  } finally {
    showLoading(false);
  }
}

async function editCategory(id) {
  try {
    const category = await apiMedical.getCategoryById(id);
    showCategoryForm(category);
  } catch (error) {
    showNotification(`Error al cargar categoría: ${error.message}`, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) return;
  
  try {
    showLoading(true);
    await apiMedical.deleteCategory(id);
    showNotification('Categoría eliminada correctamente', 'success');
    await loadCategoriesView();
    
    // Recargar categorías en otros módulos
    if (typeof loadCategories === 'function') {
      await loadCategories();
    }
  } catch (error) {
    showNotification(`Error al eliminar categoría: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

let editingCategoryId = null;

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
window.loadCategoriesView = loadCategoriesView;
window.showCategoryForm = showCategoryForm;
window.saveCategory = saveCategory;
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;


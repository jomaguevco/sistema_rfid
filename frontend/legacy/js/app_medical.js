// Aplicación principal del sistema médico
let products = [];
// Nota: categories y areas están declaradas en sus respectivos módulos (categories.js y areas.js)
let editingProductId = null;
let pendingRfidRemoval = null;
let socket = null;

// Función para obtener el socket
function getSocket() {
  if (!socket && window.socket) {
    socket = window.socket;
  }
  return socket;
}

// Inicializar Socket.IO
function initSocket() {
  socket = io();
  window.socket = socket;  // Exponer globalmente para otros módulos
  
  socket.on('connect', () => {
    console.log('✓ Conectado al servidor Socket.IO');
    console.log('   Socket ID:', socket.id);
    updateConnectionStatus('Conectado', '#28a745');
  });
  
  socket.on('disconnect', () => {
    console.log('✗ Desconectado del servidor Socket.IO');
    updateConnectionStatus('Desconectado', '#dc3545');
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Error de conexión Socket.IO:', error);
  });
  
  socket.on('stockUpdated', (data) => {
    console.log('📦 Stock actualizado:', data);
    showNotification(`Producto retirado: ${data.product.name} - Stock: ${data.product.quantity || data.product.total_stock}`, 'info');
    if (currentSection === 'products') loadProducts();
    if (currentSection === 'dashboard') refreshDashboard();
  });
  
  socket.on('expiredProductWarning', (data) => {
    showNotification(`⚠️ ALERTA: ${data.message}`, 'error');
  });
  
  socket.on('fifoWarning', (data) => {
    showNotification(`⚠️ ${data.message}`, 'warning');
  });
  
  socket.on('alertsUpdated', (alerts) => {
    updateAlertsBadge(alerts.length);
    if (currentSection === 'alerts') loadAlerts();
    if (currentSection === 'dashboard') refreshDashboard();
  });
  
  socket.on('error', (error) => {
    showNotification(`Error: ${error.message}`, 'error');
  });
  
  // Escuchar detección de RFID (entrada)
  socket.on('rfidEntry', (data) => {
    console.log('📥 RFID detectado (ENTRADA):', data);
    if (typeof handleEntryRFID === 'function') {
      handleEntryRFID(data.rfid_uid);
    } else {
      console.warn('handleEntryRFID no está disponible');
    }
  });
  
  // Escuchar detección de RFID (salida)
  socket.on('rfidExit', (data) => {
    console.log('📤 RFID detectado (SALIDA):', data);
    if (typeof handleExitRFID === 'function') {
      handleExitRFID(data.rfid_uid);
    } else {
      console.warn('handleExitRFID no está disponible');
    }
  });
  
  // Escuchar detección de RFID (genérico - compatibilidad)
  socket.on('rfidDetected', (data) => {
    console.log('📡 ===== EVENTO RFID DETECTADO RECIBIDO =====');
    console.log('   Datos recibidos:', data);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('🔍 Verificando modo asignación:', window.rfidAssignmentMode);
    
    // Normalizar UID
    const rfidUid = (data.rfid_uid || '').toUpperCase().trim();
    if (!rfidUid) {
      console.warn('⚠️ RFID UID vacío o inválido');
      return;
    }
    
    // Si es entrada, manejar con handleEntryRFID
    if (data.action === 'entry' && typeof handleEntryRFID === 'function') {
      handleEntryRFID(rfidUid);
      return;
    }
    
    // Si es salida, manejar con handleExitRFID
    if (data.action === 'remove' && typeof handleExitRFID === 'function') {
      handleExitRFID(rfidUid);
      return;
    }
    
    // Verificar si estamos en modo de asignación RFID
    if (window.rfidAssignmentMode && window.rfidAssignmentMode.active && window.rfidAssignmentMode.batchId) {
      console.log('✅ Modo asignación activo, asignando RFID al lote:', window.rfidAssignmentMode.batchId);
      console.log('   RFID UID:', rfidUid);
      
      // Estamos en modo de asignación, asignar automáticamente
      if (window.assignDetectedRfid && typeof window.assignDetectedRfid === 'function') {
        console.log('   Llamando a assignDetectedRfid...');
        window.assignDetectedRfid(window.rfidAssignmentMode.batchId, rfidUid);
      } else {
        console.error('❌ Función assignDetectedRfid no está disponible en window');
        console.error('   Tipos disponibles:', {
          'window.assignDetectedRfid': typeof window.assignDetectedRfid,
          'window.rfidAssignmentMode': typeof window.rfidAssignmentMode,
          'window.rfidAssignmentMode.active': window.rfidAssignmentMode?.active,
          'window.rfidAssignmentMode.batchId': window.rfidAssignmentMode?.batchId
        });
        // Reintentar después de un pequeño delay por si el script aún no se ha cargado
        setTimeout(() => {
          if (window.assignDetectedRfid && typeof window.assignDetectedRfid === 'function') {
            console.log('🔄 Reintentando asignación después del delay...');
            window.assignDetectedRfid(window.rfidAssignmentMode.batchId, rfidUid);
          } else {
            console.error('❌ Función aún no disponible después del delay');
          }
        }, 200);
      }
    } else {
      console.log('ℹ️ Modo normal: solicitando selección de área');
      // Modo normal: requiere selección de área para retiro
      pendingRemovalData = rfidUid;
      if (typeof showAreaSelectionModal === 'function') {
        showAreaSelectionModal();
      }
    }
  });
  
  // Socket.IO disponible, escuchando eventos RFID...
  console.log('Socket.IO disponible, escuchando eventos RFID...');
}

let currentSection = 'dashboard';

// Navegación entre secciones
function showSection(section) {
  console.log(`📂 Cambiando a sección: ${section}`);
  
  // Ocultar todas las secciones
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });
  
  // Mostrar sección seleccionada
  const targetSection = document.getElementById(`${section}-section`);
  if (!targetSection) {
    console.error(`❌ Sección ${section}-section no encontrada`);
    return;
  }
  
  targetSection.classList.add('active');
  currentSection = section;
  
  // Actualizar navegación activa
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  const navLink = document.querySelector(`[data-section="${section}"]`);
  if (navLink) {
    navLink.classList.add('active');
  }
  
  // Cargar datos según sección
  try {
    switch(section) {
      case 'dashboard':
        if (typeof refreshDashboard === 'function') {
          refreshDashboard().catch(error => {
            console.error('Error al refrescar dashboard:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar dashboard: ${error.message}`, 'error');
            }
          });
        } else {
          console.warn('⚠️ refreshDashboard no está disponible');
        }
        break;
      case 'products':
        if (typeof loadProducts === 'function') {
          loadProducts().catch(error => {
            console.error('Error al cargar productos:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar productos: ${error.message}`, 'error');
            }
          });
        }
        if (typeof loadCategories === 'function') {
          loadCategories().catch(error => {
            console.error('Error al cargar categorías:', error);
            // No mostrar error aquí, solo loguear
          });
        }
        break;
      case 'batches':
        if (typeof loadBatchesView === 'function') {
          loadBatchesView().catch(error => {
            console.error('Error al cargar lotes:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar lotes: ${error.message}`, 'error');
            }
          });
        } else {
          console.warn('⚠️ loadBatchesView no está disponible');
        }
        break;
      case 'categories':
        // Cargar inmediatamente y también con timeout por si acaso
        if (typeof loadCategoriesView === 'function') {
          loadCategoriesView().catch(error => {
            console.error('Error al cargar categorías:', error);
            const container = document.getElementById('categoriesContent');
            if (container) {
              if (error.requiresAuth || error.status === 401) {
                container.innerHTML = '<p class="text-danger">Sesión expirada. Por favor inicia sesión nuevamente.</p>';
              } else {
                container.innerHTML = `<p class="text-danger">Error al cargar categorías: ${error.message}</p>`;
              }
            }
          });
        } else {
          setTimeout(() => {
            if (typeof loadCategoriesView === 'function') {
              loadCategoriesView().catch(error => {
                console.error('Error al cargar categorías:', error);
                const container = document.getElementById('categoriesContent');
                if (container) {
                  container.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
                }
              });
            } else {
              console.error('❌ loadCategoriesView no está disponible');
              const container = document.getElementById('categoriesContent');
              if (container) {
                container.innerHTML = '<p class="text-danger">Error: loadCategoriesView no está disponible. Verifica que categories.js se haya cargado.</p>';
              }
            }
          }, 200);
        }
        break;
      case 'areas':
        // Cargar inmediatamente y también con timeout por si acaso
        if (typeof loadAreasView === 'function') {
          loadAreasView().catch(error => {
            console.error('Error al cargar áreas:', error);
            const tbody = document.getElementById('areasTableBody');
            if (tbody) {
              if (error.requiresAuth || error.status === 401) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Sesión expirada. Por favor inicia sesión nuevamente.</td></tr>';
              } else {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar áreas: ${error.message}</td></tr>`;
              }
            }
          });
        } else {
          setTimeout(() => {
            if (typeof loadAreasView === 'function') {
              loadAreasView().catch(error => {
                console.error('Error al cargar áreas:', error);
                const tbody = document.getElementById('areasTableBody');
                if (tbody) {
                  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
                }
              });
            } else {
              console.error('❌ loadAreasView no está disponible');
              const tbody = document.getElementById('areasTableBody');
              if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error: loadAreasView no está disponible. Verifica que areas.js se haya cargado.</td></tr>';
              }
            }
          }, 200);
        }
        break;
      case 'alerts':
        if (typeof loadAlerts === 'function') {
          loadAlerts();
        } else {
          console.warn('⚠️ loadAlerts no está disponible');
        }
        break;
      case 'predictions':
        if (typeof loadPredictions === 'function') {
          loadPredictions().catch(error => {
            console.error('Error al cargar predicciones:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar predicciones: ${error.message}`, 'error');
            }
          });
        } else {
          console.warn('⚠️ loadPredictions no está disponible');
        }
        if (typeof loadAreas === 'function') {
          loadAreas().catch(error => {
            console.error('Error al cargar áreas para predicciones:', error);
            // No bloquear si falla la carga de áreas
          });
        }
        break;
      case 'traceability':
        if (typeof loadTraceabilityView === 'function') {
          loadTraceabilityView();
        } else {
          console.warn('⚠️ loadTraceabilityView no está disponible');
        }
        break;
      case 'reports':
        if (typeof loadReports === 'function') {
          loadReports();
        } else {
          console.warn('⚠️ loadReports no está disponible');
        }
        break;
      case 'backup':
        if (typeof loadBackupView === 'function') {
          loadBackupView().catch(error => {
            console.error('Error al cargar backup:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar backup: ${error.message}`, 'error');
            }
          });
        } else {
          console.warn('⚠️ loadBackupView no está disponible');
        }
        break;
      case 'suppliers':
        if (typeof loadSuppliersView === 'function') {
          loadSuppliersView();
        } else {
          console.warn('⚠️ loadSuppliersView no está disponible');
        }
        break;
      case 'orders':
        if (typeof loadOrdersView === 'function') {
          loadOrdersView();
        } else {
          console.warn('⚠️ loadOrdersView no está disponible');
        }
        break;
      case 'audit':
        if (typeof loadAuditView === 'function') {
          loadAuditView().catch(error => {
            console.error('Error al cargar auditoría:', error);
            if (error.requiresAuth || error.status === 401) {
              showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
            } else {
              showNotification(`Error al cargar auditoría: ${error.message}`, 'error');
            }
          });
        } else {
          console.warn('⚠️ loadAuditView no está disponible');
        }
        break;
      case 'users':
        if (typeof loadUsersView === 'function') {
          loadUsersView();
        } else {
          console.warn('⚠️ loadUsersView no está disponible');
        }
        break;
      case 'admin':
        if (typeof loadAdminView === 'function') {
          loadAdminView();
        } else {
          console.warn('⚠️ loadAdminView no está disponible');
        }
        break;
      case 'notifications':
        if (typeof loadNotificationsView === 'function') {
          loadNotificationsView();
        } else {
          console.warn('⚠️ loadNotificationsView no está disponible');
        }
        break;
      case 'prescriptions':
        if (typeof loadPrescriptions === 'function') {
          loadPrescriptions();
        } else {
          console.warn('⚠️ loadPrescriptions no está disponible');
        }
        break;
      case 'stock-entry':
        // Sección de entrada de stock - solo mostrar, no requiere carga adicional
        console.log('✓ Sección de entrada de stock activada');
        break;
      case 'stock-exit':
        // Sección de salida de stock - solo mostrar, no requiere carga adicional
        console.log('✓ Sección de salida de stock activada');
        break;
      default:
        console.warn(`⚠️ Sección desconocida: ${section}`);
    }
  } catch (error) {
    console.error(`❌ Error al cargar sección ${section}:`, error);
    
    // Manejar errores de autenticación de manera más elegante
    if (error.requiresAuth || error.status === 401) {
      showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
    } else {
      showNotification(`Error al cargar ${section}: ${error.message}`, 'error');
    }
  }
}

// Exportar función globalmente
window.showSection = showSection;

// Cargar productos
async function loadProducts() {
  try {
    showLoading(true);
    const filters = {
      product_type: document.getElementById('filterType')?.value || '',
      category_id: document.getElementById('filterCategory')?.value || '',
      search: document.getElementById('searchInput')?.value || '',
      expiry_status: document.getElementById('filterExpiry')?.value || '',
      low_stock: document.getElementById('filterStock')?.value === 'low'
    };
    
    // Aplicar filtros avanzados si existen
    const advancedFilters = window.currentAdvancedFilters || {};
    Object.assign(filters, advancedFilters);
    
    products = await apiMedical.getAllProducts(filters);
    renderProducts();
  } catch (error) {
    console.error('Error al cargar productos:', error);
    
    // Manejar errores de autenticación de manera más elegante
    if (error.requiresAuth || error.status === 401) {
      showNotification('Sesión expirada. Por favor inicia sesión nuevamente.', 'error');
      const tbody = document.getElementById('productsTableBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Sesión expirada. Por favor inicia sesión nuevamente.</td></tr>';
      }
    } else {
      showNotification(`Error al cargar productos: ${error.message}`, 'error');
      const tbody = document.getElementById('productsTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error al cargar productos: ${error.message}</td></tr>`;
      }
    }
  } finally {
    showLoading(false);
  }
}

// Renderizar productos
function renderProducts() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay productos registrados</td></tr>';
    return;
  }
  
  products.forEach(product => {
    const row = document.createElement('tr');
    const stock = product.total_stock || 0;
    const stockClass = stock === 0 ? 'stock-zero' : stock <= product.min_stock ? 'stock-low' : '';
    const typeBadge = product.product_type === 'medicamento' ? 'med-badge' : 'insumo-badge';
    
    row.innerHTML = `
      <td>${product.id}</td>
      <td><strong>${escapeHtml(product.name)}</strong></td>
      <td><span class="badge ${typeBadge}">${product.product_type}</span></td>
      <td>${escapeHtml(product.active_ingredient || '-')}</td>
      <td>${escapeHtml(product.concentration || '-')}</td>
      <td>${escapeHtml(product.category_name || '-')}</td>
      <td><span class="stock-badge ${stockClass}">${stock}</span></td>
      <td>${getProductStatusBadgeSync(product)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editProduct(${product.id})">✏️ Editar</button>
        <button class="btn btn-sm btn-info" onclick="viewBatches(${product.id})">📦 Lotes</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">🗑️ Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function getProductStatusBadge(product) {
  try {
    // Obtener lotes del producto para determinar estado
    const batches = await apiMedical.getProductBatches(product.id);
    
    if (!batches || batches.length === 0) {
      return '<span class="badge badge-info">Sin lotes</span>';
    }
    
    const expiredBatches = batches.filter(b => b.is_expired && b.quantity > 0);
    const expiringSoon = batches.filter(b => !b.is_expired && b.days_to_expiry >= 0 && b.days_to_expiry <= 30 && b.quantity > 0);
    
    if (expiredBatches.length > 0) {
      return '<span class="badge badge-danger">Vencido</span>';
    }
    if (expiringSoon.length > 0) {
      return '<span class="badge badge-warning">Por vencer</span>';
    }
    return '<span class="badge badge-success">Vigente</span>';
  } catch (error) {
    return '<span class="badge badge-info">Vigente</span>';
  }
}

// Versión síncrona para usar en renderizado (sin async)
function getProductStatusBadgeSync(product) {
  // Versión simplificada que se puede mejorar cargando lotes por separado
  const stock = product.total_stock || 0;
  if (stock === 0) {
    return '<span class="badge badge-danger">Sin stock</span>';
  }
  if (stock <= product.min_stock) {
    return '<span class="badge badge-warning">Stock bajo</span>';
  }
  return '<span class="badge badge-success">Vigente</span>';
}

// Cargar categorías (para selectores, no para vista completa)
async function loadCategories() {
  try {
    const categoriesList = await apiMedical.getAllCategories();
    const select = document.getElementById('filterCategory');
    const productSelect = document.getElementById('productCategory');
    
    [select, productSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">Seleccionar categoría</option>';
      categoriesList.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        sel.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Error al cargar categorías:', error);
  }
}

// Cargar áreas (para selectores, no para vista completa)
async function loadAreas() {
  try {
    const areasList = await apiMedical.getAllAreas();
    const select = document.getElementById('predictionArea');
    const areaSelect = document.getElementById('areaSelect');
    
    [select, areaSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">Todas las áreas</option>';
      areasList.forEach(area => {
        const option = document.createElement('option');
        option.value = area.id;
        option.textContent = area.name;
        sel.appendChild(option);
      });
    });
  } catch (error) {
    console.error('Error al cargar áreas:', error);
  }
}

// Mostrar formulario de producto
function showProductForm(product = null) {
  editingProductId = product ? product.id : null;
  const modal = document.getElementById('productModal');
  const title = document.getElementById('modalProductTitle');
  const form = document.getElementById('productForm');
  
  if (!modal || !form) {
    console.error('Modal o formulario de producto no encontrado');
    return;
  }
  
  if (product) {
    title.textContent = 'Editar Producto Médico';
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productType').value = product.product_type || 'medicamento';
    document.getElementById('activeIngredient').value = product.active_ingredient || '';
    document.getElementById('concentration').value = product.concentration || '';
    document.getElementById('presentation').value = product.presentation || '';
    document.getElementById('administrationRoute').value = product.administration_route || '';
    document.getElementById('productCategory').value = product.category_id || '';
    document.getElementById('minStock').value = product.min_stock || 5;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('requiresRefrigeration').checked = product.requires_refrigeration || false;
  } else {
    title.textContent = 'Nuevo Producto Médico';
    // Resetear formulario correctamente
    form.reset();
    // Establecer valores por defecto después del reset
    setTimeout(() => {
      document.getElementById('productType').value = 'medicamento';
      document.getElementById('minStock').value = 5;
      document.getElementById('requiresRefrigeration').checked = false;
    }, 10);
  }
  
  modal.style.display = 'block';
}

// Guardar producto
async function saveProduct(event) {
  if (event) {
    event.preventDefault();
  }
  
  // Validaciones
  const name = document.getElementById('productName')?.value.trim();
  if (!name) {
    showNotification('El nombre del producto es obligatorio', 'error');
    return;
  }
  
  const productData = {
    name: name,
    product_type: document.getElementById('productType')?.value || 'medicamento',
    active_ingredient: document.getElementById('activeIngredient')?.value.trim() || null,
    concentration: document.getElementById('concentration')?.value.trim() || null,
    presentation: document.getElementById('presentation')?.value.trim() || null,
    administration_route: document.getElementById('administrationRoute')?.value.trim() || null,
    category_id: document.getElementById('productCategory')?.value || null,
    min_stock: parseInt(document.getElementById('minStock')?.value) || 5,
    description: document.getElementById('productDescription')?.value.trim() || null,
    requires_refrigeration: document.getElementById('requiresRefrigeration')?.checked || false
  };
  
  // Validar stock mínimo
  if (productData.min_stock < 0) {
    showNotification('El stock mínimo no puede ser negativo', 'error');
    return;
  }
  
  try {
    showLoading(true);
    
    if (editingProductId) {
      await apiMedical.updateProduct(editingProductId, productData);
      showNotification('Producto actualizado correctamente', 'success');
    } else {
      await apiMedical.createProduct(productData);
      showNotification('Producto creado correctamente', 'success');
    }
    
    // Cerrar modal y limpiar formulario
    closeModal('productModal');
    editingProductId = null;
    
    // Recargar productos
    if (currentSection === 'products') {
      await loadProducts();
    }
    
    // Recargar dashboard si está activo
    if (currentSection === 'dashboard' && typeof refreshDashboard === 'function') {
      refreshDashboard();
    }
  } catch (error) {
    console.error('Error al guardar producto:', error);
    showNotification(`Error: ${error.message || 'Error desconocido al guardar producto'}`, 'error');
  } finally {
    showLoading(false);
  }
}

// Editar producto
async function editProduct(id) {
  try {
    const product = await apiMedical.getProductById(id);
    showProductForm(product);
  } catch (error) {
    showNotification(`Error al cargar producto: ${error.message}`, 'error');
  }
}

// Eliminar producto
async function deleteProduct(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
  
  try {
    showLoading(true);
    await apiMedical.deleteProduct(id);
    showNotification('Producto eliminado correctamente', 'success');
    await loadProducts();
  } catch (error) {
    showNotification(`Error al eliminar producto: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

// Búsqueda unificada (RFID, barcode, código, nombre)
async function unifiedSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  const query = searchInput.value.trim();
  if (!query) {
    loadProducts();
    return;
  }
  
  try {
    showLoading(true);
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Error en la búsqueda');
    }
    
    const result = await response.json();
    products = result.data || [];
    displayProducts();
    
    if (products.length === 0) {
      showNotification('No se encontraron productos', 'info');
    } else {
      showNotification(`Se encontraron ${products.length} producto(s)`, 'success');
    }
  } catch (error) {
    console.error('Error en búsqueda unificada:', error);
    showNotification('Error al realizar la búsqueda', 'error');
    // Fallback a búsqueda normal
    loadProducts();
  } finally {
    showLoading(false);
  }
}
window.unifiedSearch = unifiedSearch;

// Filtrar productos
function filterProducts() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput?.value.trim();
  
  // Si hay un término de búsqueda, usar búsqueda unificada
  if (query && query.length > 0) {
    unifiedSearch();
  } else {
    loadProducts();
  }
}
window.filterProducts = filterProducts;
window.loadProducts = loadProducts;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
// viewBatches está definida en batches.js, no aquí
window.showProductForm = showProductForm;
window.saveProduct = saveProduct;

// Funciones de utilidad - Exportar globalmente
function showLoading(show) {
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = show ? 'flex' : 'none';
}
window.showLoading = showLoading;

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}
window.showNotification = showNotification;

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}
window.closeModal = closeModal;

function updateConnectionStatus(text, color) {
  const status = document.getElementById('connectionStatus');
  if (status) {
    status.textContent = text;
    status.style.color = color;
  }
}

function updateAlertsBadge(count) {
  const badge = document.getElementById('alertsBadge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación médica...');
  
  // Verificar autenticación después de que todos los scripts estén cargados
  // No bloquear la inicialización, solo verificar y mostrar advertencia si es necesario
  setTimeout(() => {
    if (typeof requireAuth === 'function') {
      const isAuth = requireAuth();
      if (!isAuth) {
        console.warn('⚠️ Usuario no autenticado. Algunas funciones pueden no estar disponibles.');
        // No hacer return aquí, permitir que la aplicación se inicialice
        // La redirección se manejará en las llamadas API cuando sea necesario
      }
    }
  }, 100);
  
  // Mostrar información del usuario
  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    if (user) {
      const userInfo = document.getElementById('userInfo');
      if (userInfo) {
        const roleNames = {
          'admin': 'Administrador',
          'farmaceutico': 'Farmacéutico',
          'enfermero': 'Enfermero',
          'supervisor': 'Supervisor',
          'auditor': 'Auditor'
        };
        userInfo.textContent = `${user.username} (${roleNames[user.role] || user.role})`;
      }
      
      // Mostrar menú de usuarios, backup, auditoría y administración solo para admin
      if (typeof isAdmin === 'function' && isAdmin()) {
        if (document.getElementById('usersNavItem')) {
          document.getElementById('usersNavItem').style.display = 'block';
        }
        if (document.getElementById('backupNavItem')) {
          document.getElementById('backupNavItem').style.display = 'block';
        }
        if (document.getElementById('auditNavItem')) {
          document.getElementById('auditNavItem').style.display = 'block';
        }
        if (document.getElementById('adminNavItem')) {
          document.getElementById('adminNavItem').style.display = 'block';
        }
      }
      
      // Mostrar auditoría también para supervisores y auditores
      if (typeof hasRole === 'function' && (hasRole('supervisor') || hasRole('auditor'))) {
        if (document.getElementById('auditNavItem')) {
          document.getElementById('auditNavItem').style.display = 'block';
        }
      }
    }
  }
  
  // Inicializar Socket.IO
  initSocket();
  
  // Cargar datos iniciales (solo para selectores, no para vistas completas)
  // Las funciones loadCategoriesView y loadAreasView están en sus módulos respectivos
  setTimeout(() => {
    loadCategories();
    loadAreas();
  }, 500);
  
  // Mostrar dashboard por defecto
  showSection('dashboard');
  
  // Event listeners - Esperar a que todos los scripts se carguen
  setTimeout(() => {
    // Botón nuevo producto
    document.getElementById('newProductBtn')?.addEventListener('click', () => {
      editingProductId = null;
      showProductForm();
    });
    
    // Formulario de producto
    const productForm = document.getElementById('productForm');
    if (productForm) {
      // Remover listener anterior si existe
      const newForm = productForm.cloneNode(true);
      productForm.parentNode.replaceChild(newForm, productForm);
      document.getElementById('productForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveProduct(e);
      });
    }
    
    // Formulario de área (si existe)
    const areaForm = document.getElementById('areaForm');
    if (areaForm && typeof saveArea === 'function') {
      const newAreaForm = areaForm.cloneNode(true);
      areaForm.parentNode.replaceChild(newAreaForm, areaForm);
      document.getElementById('areaForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveArea(e);
      });
    }
  }, 100);
  
  // Cerrar modales al hacer clic fuera
  window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  };
  
  console.log('✓ Aplicación inicializada correctamente');
});

// Las funciones de otras secciones están implementadas en sus módulos respectivos:
// - loadBatchesView, viewBatches, showBatchForm, saveBatch -> batches.js
// - loadAlerts, checkAlerts -> alerts.js
// - loadPredictions, generateAllPredictions -> predictions.js
// - loadReports -> reports.js
// - refreshDashboard -> dashboard.js

// Exportar getSocket globalmente
window.getSocket = getSocket;

// Manejo de retiro con área
let pendingRemovalData = null;

async function confirmRemoval() {
  if (!pendingRemovalData) return;
  
  const areaId = document.getElementById('areaSelect').value;
  if (!areaId) {
    showNotification('Debes seleccionar un área', 'warning');
    return;
  }
  
  try {
    showLoading(true);
    await apiMedical.processRemoval(pendingRemovalData, parseInt(areaId));
    showNotification('Retiro procesado correctamente', 'success');
    closeModal('areaSelectionModal');
    pendingRemovalData = null;
    
    // Recargar secciones activas
    if (currentSection === 'dashboard' && typeof refreshDashboard === 'function') {
      refreshDashboard();
    }
    if (currentSection === 'products' && typeof loadProducts === 'function') {
      loadProducts();
    }
  } catch (error) {
    showNotification(`Error al procesar retiro: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}
window.confirmRemoval = confirmRemoval;

function cancelRemoval() {
  pendingRemovalData = null;
  closeModal('areaSelectionModal');
}
window.cancelRemoval = cancelRemoval;

function showAreaSelectionModal() {
  const modal = document.getElementById('areaSelectionModal');
  if (modal) {
    loadAreas().then(() => {
      modal.style.display = 'block';
    });
  }
}
window.showAreaSelectionModal = showAreaSelectionModal;


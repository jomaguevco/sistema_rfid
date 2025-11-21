// Cliente API para Sistema Médico
const API_BASE = '/api';

class MedicalApiClient {
  /**
   * Obtener headers con autenticación
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Intentar obtener token con ambos nombres posibles
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * Manejar respuesta de API
   */
  async handleResponse(response) {
    // Si es 401 (no autorizado), manejar de manera más elegante
    if (response.status === 401 || response.status === 403) {
      // Limpiar credenciales almacenadas
      localStorage.removeItem('authToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Crear un error específico que puede ser manejado por el código que llama
      const error = new Error('Sesión expirada o no autorizado. Por favor inicia sesión nuevamente.');
      error.status = response.status;
      error.requiresAuth = true;
      
      // Solo redirigir si no estamos ya en la página de login
      // Esto permite que los módulos manejen el error de manera más elegante
      if (!window.location.pathname.includes('login.html')) {
        // Esperar un momento antes de redirigir para permitir que el error se maneje
        setTimeout(() => {
          window.location.href = '/login.html';
        }, 100);
      }
      
      throw error;
    }
    
    // Si es 500, intentar obtener más información del error
    if (response.status === 500) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'Error interno del servidor');
      error.status = 500;
      error.details = data.details;
      throw error;
    }
    
    const data = await response.json();
    if (data.success) return data.data;
    throw new Error(data.error || 'Error en la petición');
  }
  // ==================== PRODUCTOS ====================
  async getAllProducts(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.product_type) params.append('product_type', filters.product_type);
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.active_ingredient) params.append('active_ingredient', filters.active_ingredient);
      if (filters.rfid_uid) params.append('rfid_uid', filters.rfid_uid);
      if (filters.expiry_status) params.append('expiry_status', filters.expiry_status);
      if (filters.low_stock) params.append('low_stock', 'true');
      if (filters.min_stock) params.append('min_stock', filters.min_stock);
      if (filters.max_stock) params.append('max_stock', filters.max_stock);
      if (filters.requires_refrigeration !== undefined) params.append('requires_refrigeration', filters.requires_refrigeration);
      
      const url = `${API_BASE}/products${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(productData)
      });
      return await this.handleResponse(response);
      throw new Error(data.error || 'Error al crear producto');
    } catch (error) {
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      const data = await response.json();
      if (data.success) return data.data;
      throw new Error(data.error || 'Error al actualizar producto');
    } catch (error) {
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      const response = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) return true;
      throw new Error(data.error || 'Error al eliminar producto');
    } catch (error) {
      throw error;
    }
  }

  // ==================== LOTES ====================
  async getProductBatches(productId) {
    try {
      const response = await fetch(`${API_BASE}/batches/product/${productId}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener lotes:', error);
      throw error;
    }
  }

  async createBatch(batchData) {
    try {
      const response = await fetch(`${API_BASE}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData)
      });
      const data = await response.json();
      if (data.success) return data.data;
      throw new Error(data.error || 'Error al crear lote');
    } catch (error) {
      throw error;
    }
  }

  // ==================== CATEGORÍAS ====================
  async getAllCategories() {
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error en getAllCategories:', error);
      throw error;
    }
  }

  async getCategoryById(id) {
    try {
      const response = await fetch(`${API_BASE}/categories/${id}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async createCategory(categoryData) {
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(categoryData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async updateCategory(id, categoryData) {
    try {
      const response = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(categoryData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async deleteCategory(id) {
    try {
      const response = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== ÁREAS ====================
  async getAllAreas() {
    try {
      const response = await fetch(`${API_BASE}/areas`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error en getAllAreas:', error);
      throw error;
    }
  }

  async getAreaById(id) {
    try {
      const response = await fetch(`${API_BASE}/areas/${id}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async createArea(areaData) {
    try {
      const response = await fetch(`${API_BASE}/areas`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(areaData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async updateArea(id, areaData) {
    try {
      const response = await fetch(`${API_BASE}/areas/${id}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(areaData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async deleteArea(id) {
    try {
      const response = await fetch(`${API_BASE}/areas/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== ALERTAS ====================
  async getActiveAlerts() {
    try {
      const response = await fetch(`${API_BASE}/alerts`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async checkAlerts() {
    try {
      const response = await fetch(`${API_BASE}/alerts/check`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== DASHBOARD ====================
  async getDashboardStats() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getExpiringProducts(days = 30) {
    try {
      const response = await fetch(`${API_BASE}/dashboard/expiring?days=${days}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getLowStockProducts() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/low-stock`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getProductsByCategory() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/products-by-category`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getConsumptionByArea(days = 30) {
    try {
      const response = await fetch(`${API_BASE}/dashboard/consumption-by-area?days=${days}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getExpiryDistribution() {
    try {
      const response = await fetch(`${API_BASE}/dashboard/expiry-distribution`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== PREDICCIONES ====================
  async getPredictions(productId, areaId = null) {
    try {
      const url = `${API_BASE}/predictions/product/${productId}${areaId ? '?area_id=' + areaId : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async generatePredictions(productId, areaId = null) {
    try {
      const response = await fetch(`${API_BASE}/predictions/product/${productId}/generate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ area_id: areaId })
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getPredictionsByArea(period = 'month') {
    try {
      const response = await fetch(`${API_BASE}/predictions/by-area?period=${period}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async generateAllPredictions(areaId = null) {
    try {
      const response = await fetch(`${API_BASE}/predictions/generate-all`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ area_id: areaId })
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== RETIRO CON ÁREA ====================
  async processRemoval(rfidUid, areaId) {
    try {
      const response = await fetch(`${API_BASE}/removal/process`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ rfid_uid: rfidUid, area_id: areaId })
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== TRAZABILIDAD ====================
  async getAllTraceability(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.product_id) params.append('product_id', filters.product_id);
      if (filters.batch_id) params.append('batch_id', filters.batch_id);
      if (filters.area_id) params.append('area_id', filters.area_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.limit) params.append('limit', filters.limit);
      
      const url = `${API_BASE}/traceability${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getProductHistory(productId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.area_id) params.append('area_id', filters.area_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      const url = `${API_BASE}/traceability/product/${productId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getBatchHistory(batchId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      const url = `${API_BASE}/traceability/batch/${batchId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  async getAreaHistory(areaId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.product_id) params.append('product_id', filters.product_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      const url = `${API_BASE}/traceability/area/${areaId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      throw error;
    }
  }

  // ==================== PROVEEDORES ====================
  
  async getAllSuppliers(includeInactive = false) {
    const params = includeInactive ? '?all=true' : '';
    const response = await fetch(`${API_BASE}/suppliers${params}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async getSupplierById(id) {
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async createSupplier(supplierData) {
    const response = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(supplierData)
    });
    return this.handleResponse(response);
  }
  
  async updateSupplier(id, supplierData) {
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(supplierData)
    });
    return this.handleResponse(response);
  }
  
  async deleteSupplier(id) {
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  // ==================== ÓRDENES DE COMPRA ====================
  
  async getAllOrders(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    const response = await fetch(`${API_BASE}/orders?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async getOrderById(id) {
    const response = await fetch(`${API_BASE}/orders/${id}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async createOrder(orderData) {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(orderData)
    });
    return this.handleResponse(response);
  }
  
  async updateOrderStatus(id, status) {
    const response = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return this.handleResponse(response);
  }
  
  async addOrderItem(orderId, itemData) {
    const response = await fetch(`${API_BASE}/orders/${orderId}/items`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(itemData)
    });
    return this.handleResponse(response);
  }
  
  async updateOrderItem(orderId, itemId, itemData) {
    const response = await fetch(`${API_BASE}/orders/${orderId}/items/${itemId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(itemData)
    });
    return this.handleResponse(response);
  }
  
  async deleteOrderItem(orderId, itemId) {
    const response = await fetch(`${API_BASE}/orders/${orderId}/items/${itemId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async receiveOrder(orderId, receiptData) {
    const response = await fetch(`${API_BASE}/orders/${orderId}/receive`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(receiptData)
    });
    return this.handleResponse(response);
  }
  
  // ==================== RECEPCIONES ====================
  
  async getAllReceipts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.order_id) params.append('order_id', filters.order_id);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.received_by) params.append('received_by', filters.received_by);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const response = await fetch(`${API_BASE}/receipts?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async getReceiptById(id) {
    const response = await fetch(`${API_BASE}/receipts/${id}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async getReceiptsByOrder(orderId) {
    const response = await fetch(`${API_BASE}/receipts/order/${orderId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }
  
  async createReceipt(receiptData) {
    const response = await fetch(`${API_BASE}/receipts`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(receiptData)
    });
    return this.handleResponse(response);
  }
  
  // ==================== ADMINISTRACIÓN ====================
  
  /**
   * Obtener configuraciones del sistema
   */
  async getSystemConfig(category = null) {
    try {
      const url = category 
        ? `${API_BASE}/admin/config?category=${category}`
        : `${API_BASE}/admin/config`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener configuraciones:', error);
      throw error;
    }
  }
  
  /**
   * Obtener configuración por clave
   */
  async getSystemConfigByKey(key) {
    try {
      const response = await fetch(`${API_BASE}/admin/config/${key}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar configuración
   */
  async updateSystemConfig(key, configValue, description) {
    try {
      const response = await fetch(`${API_BASE}/admin/config/${key}`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config_value: configValue, description })
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      throw error;
    }
  }
  
  /**
   * Crear configuración
   */
  async createSystemConfig(configData) {
    try {
      const response = await fetch(`${API_BASE}/admin/config`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al crear configuración:', error);
      throw error;
    }
  }
  
  /**
   * Obtener reportes programados
   */
  async getScheduledReports() {
    try {
      const response = await fetch(`${API_BASE}/admin/scheduled-reports`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener reportes programados:', error);
      throw error;
    }
  }
  
  /**
   * Crear reporte programado
   */
  async createScheduledReport(reportData) {
    try {
      const response = await fetch(`${API_BASE}/admin/scheduled-reports`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reportData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al crear reporte programado:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar reporte programado
   */
  async updateScheduledReport(id, updates) {
    try {
      const response = await fetch(`${API_BASE}/admin/scheduled-reports/${id}`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al actualizar reporte programado:', error);
      throw error;
    }
  }
  
  /**
   * Eliminar reporte programado
   */
  async deleteScheduledReport(id) {
    try {
      const response = await fetch(`${API_BASE}/admin/scheduled-reports/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al eliminar reporte programado:', error);
      throw error;
    }
  }
  
  /**
   * Obtener ejecuciones de un reporte programado
   */
  async getScheduledReportExecutions(reportId, limit = 50) {
    try {
      const response = await fetch(`${API_BASE}/admin/scheduled-reports/${reportId}/executions?limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener ejecuciones:', error);
      throw error;
    }
  }
  
  // ==================== NOTIFICACIONES ====================
  
  /**
   * Enviar email de prueba
   */
  async sendTestEmail(email) {
    try {
      const response = await fetch(`${API_BASE}/notifications/send-test`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al enviar email de prueba:', error);
      throw error;
    }
  }
  
  /**
   * Obtener preferencias de notificaciones
   */
  async getNotificationPreferences() {
    try {
      const response = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener preferencias:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar preferencias de notificaciones
   */
  async updateNotificationPreferences(preferences) {
    try {
      const response = await fetch(`${API_BASE}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al actualizar preferencias:', error);
      throw error;
    }
  }
  
  // ==================== USUARIOS ====================
  
  /**
   * Obtener todos los usuarios
   */
  async getAllUsers() {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  }
  
  /**
   * Obtener usuario por ID
   */
  async getUserById(id) {
    try {
      const response = await fetch(`${API_BASE}/users/${id}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener usuario:', error);
      throw error;
    }
  }
  
  /**
   * Crear usuario
   */
  async createUser(userData) {
    try {
      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw error;
    }
  }
  
  /**
   * Actualizar usuario
   */
  async updateUser(id, userData) {
    try {
      const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw error;
    }
  }
  
  /**
   * Eliminar usuario
   */
  async deleteUser(id) {
    try {
      const response = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      throw error;
    }
  }

  // ==================== AUDITORÍA ====================
  
  /**
   * Obtener logs de auditoría
   */
  async getAuditLogs(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.table_name) params.append('table_name', filters.table_name);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);
      
      const response = await fetch(`${API_BASE}/audit/logs?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener logs de auditoría:', error);
      throw error;
    }
  }
  
  /**
   * Obtener estadísticas de auditoría
   */
  async getAuditStats(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      
      const response = await fetch(`${API_BASE}/audit/stats?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al obtener estadísticas de auditoría:', error);
      throw error;
    }
  }
  
  // ==================== BACKUP ====================
  
  /**
   * Listar backups disponibles
   */
  async listBackups() {
    try {
      const response = await fetch(`${API_BASE}/backup/list`, {
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al listar backups:', error);
      throw error;
    }
  }
  
  /**
   * Crear backup
   */
  async createBackup() {
    try {
      const response = await fetch(`${API_BASE}/backup/create`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al crear backup:', error);
      throw error;
    }
  }
  
  /**
   * Descargar backup
   */
  async downloadBackup(filename) {
    try {
      const response = await fetch(`${API_BASE}/backup/download/${encodeURIComponent(filename)}`, {
        headers: this.getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al descargar backup');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    } catch (error) {
      console.error('Error al descargar backup:', error);
      throw error;
    }
  }
  
  /**
   * Restaurar backup
   */
  async restoreBackup(filename) {
    try {
      const response = await fetch(`${API_BASE}/backup/restore`, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al restaurar backup:', error);
      throw error;
    }
  }
  
  /**
   * Eliminar backup
   */
  async deleteBackup(filename) {
    try {
      const response = await fetch(`${API_BASE}/backup/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error al eliminar backup:', error);
      throw error;
    }
  }
}

// Exportar instancia única
const apiMedical = new MedicalApiClient();
window.apiMedical = apiMedical;


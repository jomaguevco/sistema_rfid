// Módulo de gestión de órdenes de compra

let currentOrderId = null;

/**
 * Cargar vista de órdenes
 */
async function loadOrdersView() {
  const container = document.getElementById('ordersContent');
  if (!container) return;
  
  try {
    const orders = await apiMedical.getAllOrders();
    renderOrders(orders);
  } catch (error) {
    console.error('Error al cargar órdenes:', error);
    container.innerHTML = `<p class="text-danger">Error al cargar órdenes: ${error.message}</p>`;
  }
}

function renderOrders(orders) {
  const container = document.getElementById('ordersContent');
  if (!container) return;
  
  if (orders.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay órdenes de compra registradas</p>';
    return;
  }
  
  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'badge-warning',
      'approved': 'badge-info',
      'received': 'badge-success',
      'cancelled': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };
  
  const getStatusText = (status) => {
    const texts = {
      'pending': 'Pendiente',
      'approved': 'Aprobada',
      'received': 'Recibida',
      'cancelled': 'Cancelada'
    };
    return texts[status] || status;
  };
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Proveedor</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Creada por</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td><strong>${escapeHtml(order.order_number)}</strong></td>
              <td>${escapeHtml(order.supplier_name || '-')}</td>
              <td>${new Date(order.order_date).toLocaleDateString('es-ES')}</td>
              <td>Q ${parseFloat(order.total_amount || 0).toFixed(2)}</td>
              <td><span class="badge ${getStatusBadge(order.status)}">${getStatusText(order.status)}</span></td>
              <td>${escapeHtml(order.created_by_username || '-')}</td>
              <td>
                <button class="btn btn-sm btn-info" onclick="viewOrderDetails(${order.id})">👁️ Ver</button>
                ${order.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="approveOrder(${order.id})">✓ Aprobar</button>` : ''}
                ${order.status === 'approved' ? `<button class="btn btn-sm btn-primary" onclick="receiveOrder(${order.id})">📦 Recibir</button>` : ''}
                ${order.status === 'pending' ? `<button class="btn btn-sm btn-danger" onclick="cancelOrder(${order.id})">✗ Cancelar</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showOrderForm(orderId = null) {
  const modal = document.getElementById('orderModal') || createOrderModal();
  modal.style.display = 'block';
  
  if (orderId) {
    loadOrderForEdit(orderId);
  } else {
    resetOrderForm();
  }
}

function createOrderModal() {
  const modal = document.createElement('div');
  modal.id = 'orderModal';
  modal.className = 'modal';
  modal.style.cssText = 'display: none; z-index: 1000;';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px;">
      <span class="close" onclick="closeModal('orderModal')">&times;</span>
      <h2 id="modalOrderTitle">Nueva Orden de Compra</h2>
      <form id="orderForm" onsubmit="saveOrder(event)">
        <div class="form-row">
          <div class="form-group">
            <label>Proveedor *</label>
            <select id="orderSupplierId" required></select>
          </div>
          <div class="form-group">
            <label>Número de Orden *</label>
            <input type="text" id="orderNumber" required>
          </div>
          <div class="form-group">
            <label>Fecha *</label>
            <input type="date" id="orderDate" required>
          </div>
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="orderNotes" rows="2"></textarea>
        </div>
        <div id="orderItemsContainer">
          <h4>Items de la Orden</h4>
          <div id="orderItemsList"></div>
          <button type="button" class="btn btn-secondary" onclick="addOrderItem()">➕ Agregar Item</button>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-success">Guardar Orden</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('orderModal')">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

async function resetOrderForm() {
  document.getElementById('modalOrderTitle').textContent = 'Nueva Orden de Compra';
  document.getElementById('orderForm').reset();
  document.getElementById('orderDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('orderItemsList').innerHTML = '';
  currentOrderId = null;
  
  // Cargar proveedores
  try {
    const suppliers = await apiMedical.getAllSuppliers();
    const select = document.getElementById('orderSupplierId');
    select.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    suppliers.forEach(supplier => {
      const option = document.createElement('option');
      option.value = supplier.id;
      option.textContent = supplier.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
  }
  
  // Cargar productos
  try {
    const products = await apiMedical.getAllProducts();
    window.orderProducts = products;
  } catch (error) {
    console.error('Error al cargar productos:', error);
  }
  
  addOrderItem();
}

function addOrderItem() {
  const container = document.getElementById('orderItemsList');
  const itemIndex = container.children.length;
  
  const itemDiv = document.createElement('div');
  itemDiv.className = 'order-item';
  itemDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; margin-bottom: 10px; align-items: end;';
  itemDiv.innerHTML = `
    <select class="form-select order-item-product" required>
      <option value="">Seleccionar producto...</option>
    </select>
    <input type="number" class="form-select order-item-quantity" placeholder="Cantidad" min="1" required>
    <input type="number" class="form-select order-item-price" placeholder="Precio unitario" min="0" step="0.01" required>
    <input type="text" class="form-select order-item-notes" placeholder="Notas">
    <button type="button" class="btn btn-sm btn-danger" onclick="removeOrderItem(this)">🗑️</button>
  `;
  
  container.appendChild(itemDiv);
  
  // Llenar productos
  const productSelect = itemDiv.querySelector('.order-item-product');
  if (window.orderProducts) {
    window.orderProducts.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      productSelect.appendChild(option);
    });
  }
}

function removeOrderItem(button) {
  button.closest('.order-item').remove();
}

async function saveOrder(event) {
  event.preventDefault();
  
  const supplierId = document.getElementById('orderSupplierId').value;
  const orderNumber = document.getElementById('orderNumber').value;
  const orderDate = document.getElementById('orderDate').value;
  const notes = document.getElementById('orderNotes').value;
  
  const items = [];
  const itemRows = document.querySelectorAll('.order-item');
  itemRows.forEach(row => {
    const productId = row.querySelector('.order-item-product').value;
    const quantity = row.querySelector('.order-item-quantity').value;
    const unitPrice = row.querySelector('.order-item-price').value;
    const itemNotes = row.querySelector('.order-item-notes').value;
    
    if (productId && quantity && unitPrice) {
      items.push({
        product_id: parseInt(productId),
        quantity: parseInt(quantity),
        unit_price: parseFloat(unitPrice),
        notes: itemNotes || null
      });
    }
  });
  
  if (items.length === 0) {
    showNotification('Debe agregar al menos un item a la orden', 'error');
    return;
  }
  
  try {
    await apiMedical.createOrder({
      supplier_id: parseInt(supplierId),
      order_number: orderNumber,
      order_date: orderDate,
      notes: notes || null,
      items
    });
    showNotification('Orden creada correctamente', 'success');
    closeModal('orderModal');
    loadOrdersView();
  } catch (error) {
    console.error('Error al guardar orden:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function viewOrderDetails(orderId) {
  try {
    const order = await apiMedical.getOrderById(orderId);
    showOrderDetailsModal(order);
  } catch (error) {
    console.error('Error al cargar orden:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

function showOrderDetailsModal(order) {
  const modal = document.createElement('div');
  modal.id = 'orderDetailsModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  const getStatusBadge = (status) => {
    const badges = {
      'pending': 'badge-warning',
      'approved': 'badge-info',
      'received': 'badge-success',
      'cancelled': 'badge-danger'
    };
    return badges[status] || 'badge-secondary';
  };
  
  const getStatusText = (status) => {
    const texts = {
      'pending': 'Pendiente',
      'approved': 'Aprobada',
      'received': 'Recibida',
      'cancelled': 'Cancelada'
    };
    return texts[status] || status;
  };
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <span class="close" onclick="closeModal('orderDetailsModal')">&times;</span>
      <h2>Orden: ${escapeHtml(order.order_number)}</h2>
      <div style="margin: 20px 0;">
        <p><strong>Proveedor:</strong> ${escapeHtml(order.supplier_name || '-')}</p>
        <p><strong>Fecha:</strong> ${new Date(order.order_date).toLocaleDateString('es-ES')}</p>
        <p><strong>Estado:</strong> <span class="badge ${getStatusBadge(order.status)}">${getStatusText(order.status)}</span></p>
        <p><strong>Total:</strong> Q ${parseFloat(order.total_amount || 0).toFixed(2)}</p>
        ${order.notes ? `<p><strong>Notas:</strong> ${escapeHtml(order.notes)}</p>` : ''}
      </div>
      <h4>Items:</h4>
      <table class="products-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Precio Unitario</th>
            <th>Total</th>
            ${order.status === 'received' ? '<th>Recibido</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td>${escapeHtml(item.product_name || '-')}</td>
              <td>${item.quantity}</td>
              <td>Q ${parseFloat(item.unit_price).toFixed(2)}</td>
              <td>Q ${parseFloat(item.total_price).toFixed(2)}</td>
              ${order.status === 'received' ? `<td>${item.received_quantity || 0}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top: 20px;">
        <button onclick="closeModal('orderDetailsModal')" class="btn btn-secondary">Cerrar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = function(event) {
    if (event.target === modal) {
      closeModal('orderDetailsModal');
    }
  };
}

async function approveOrder(orderId) {
  if (!confirm('¿Estás seguro de que deseas aprobar esta orden?')) {
    return;
  }
  
  try {
    await apiMedical.updateOrderStatus(orderId, 'approved');
    showNotification('Orden aprobada correctamente', 'success');
    loadOrdersView();
  } catch (error) {
    console.error('Error al aprobar orden:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function cancelOrder(orderId) {
  if (!confirm('¿Estás seguro de que deseas cancelar esta orden?')) {
    return;
  }
  
  try {
    await apiMedical.updateOrderStatus(orderId, 'cancelled');
    showNotification('Orden cancelada correctamente', 'success');
    loadOrdersView();
  } catch (error) {
    console.error('Error al cancelar orden:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function receiveOrder(orderId) {
  try {
    const order = await apiMedical.getOrderById(orderId);
    showReceiveOrderModal(order);
  } catch (error) {
    console.error('Error al cargar orden:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

function showReceiveOrderModal(order) {
  const modal = document.createElement('div');
  modal.id = 'receiveOrderModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px;">
      <span class="close" onclick="closeModal('receiveOrderModal')">&times;</span>
      <h2>Recibir Orden: ${escapeHtml(order.order_number)}</h2>
      <form id="receiveOrderForm" onsubmit="saveReceiveOrder(event, ${order.id})">
        <div class="form-group">
          <label>Fecha de Recepción *</label>
          <input type="date" id="receiveDate" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Notas</label>
          <textarea id="receiveNotes" rows="3"></textarea>
        </div>
        <h4>Cantidades Recibidas:</h4>
        <div id="receiveItemsList">
          ${order.items.map(item => `
            <div class="form-row" style="margin-bottom: 10px;">
              <div class="form-group" style="flex: 2;">
                <label>${escapeHtml(item.product_name)}</label>
              </div>
              <div class="form-group" style="flex: 1;">
                <label>Recibido (máx: ${item.quantity})</label>
                <input type="number" class="form-select receive-quantity" data-item-id="${item.id}" min="0" max="${item.quantity}" value="${item.quantity}" required>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-success">Registrar Recepción</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal('receiveOrderModal')">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = function(event) {
    if (event.target === modal) {
      closeModal('receiveOrderModal');
    }
  };
}

async function saveReceiveOrder(event, orderId) {
  event.preventDefault();
  
  const receiptDate = document.getElementById('receiveDate').value;
  const notes = document.getElementById('receiveNotes').value;
  
  const items = [];
  document.querySelectorAll('.receive-quantity').forEach(input => {
    items.push({
      item_id: parseInt(input.dataset.itemId),
      received_quantity: parseInt(input.value)
    });
  });
  
  try {
    await apiMedical.receiveOrder(orderId, {
      receipt_date: receiptDate,
      notes: notes || null,
      items
    });
    showNotification('Recepción registrada correctamente', 'success');
    closeModal('receiveOrderModal');
    loadOrdersView();
  } catch (error) {
    console.error('Error al registrar recepción:', error);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function loadOrderForEdit(orderId) {
  // Implementar si es necesario editar órdenes
  showNotification('La edición de órdenes no está disponible', 'info');
}

// Exportar funciones globalmente
window.loadOrdersView = loadOrdersView;
window.showOrderForm = showOrderForm;
window.viewOrderDetails = viewOrderDetails;
window.approveOrder = approveOrder;
window.cancelOrder = cancelOrder;
window.receiveOrder = receiveOrder;
window.addOrderItem = addOrderItem;
window.removeOrderItem = removeOrderItem;
window.saveOrder = saveOrder;
window.saveReceiveOrder = saveReceiveOrder;


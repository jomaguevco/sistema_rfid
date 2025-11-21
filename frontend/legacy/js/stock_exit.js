// Salida de Productos con RFID (Mejorado)

let exitMode = false;
let pendingExit = null;

// Activar modo salida
function activateExitMode() {
    exitMode = true;
    document.getElementById('exitListeningModal').style.display = 'block';
    showNotification('Modo salida activado. Acerca el tag RFID al lector', 'info');
}

// Desactivar modo salida
function deactivateExitMode() {
    exitMode = false;
    document.getElementById('exitListeningModal').style.display = 'none';
    pendingExit = null;
}

// Manejar RFID detectado para salida
async function handleExitRFID(rfidUid) {
    if (!exitMode) return;
    
    console.log('📤 RFID detectado para salida:', rfidUid);
    
    try {
        const token = getAuthToken();
        
        // Buscar producto/lote por RFID
        const productResponse = await fetch(`/api/products/by-rfid/${rfidUid}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!productResponse.ok) {
            showNotification('Producto no encontrado para este RFID', 'error');
            return;
        }
        
        const productResult = await productResponse.json();
        const product = productResult.data;
        
        // Buscar batch
        const batchResponse = await fetch(`/api/batches?rfid_uid=${rfidUid}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!batchResponse.ok) {
            showNotification('Lote no encontrado', 'error');
            return;
        }
        
        const batchResult = await batchResponse.json();
        const batches = batchResult.data || [];
        const batch = batches.find(b => b.rfid_uid === rfidUid);
        
        if (!batch) {
            showNotification('Lote no encontrado para este RFID', 'error');
            return;
        }
        
        // Verificar stock disponible
        if (batch.quantity <= 0) {
            showNotification('Stock insuficiente en este lote', 'error');
            return;
        }
        
        pendingExit = {
            rfid_uid: rfidUid,
            product: product,
            batch: batch
        };
        
        // Si es una caja (units_per_package > 1), preguntar cantidad
        if (product.units_per_package > 1) {
            showQuantityExitModal(product, batch);
        } else {
            // Si es unidad individual, retirar 1
            await processExit(rfidUid, 1);
        }
        
    } catch (error) {
        console.error('Error al procesar salida:', error);
        showNotification('Error al procesar salida', 'error');
    }
}

// Procesar salida
async function processExit(rfidUid, quantity, areaId = null) {
    try {
        const token = getAuthToken();
        
        const response = await fetch('/api/stock/exit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rfid_uid: rfidUid,
                quantity: quantity,
                area_id: areaId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            
            // Si requiere cantidad, mostrar modal
            if (error.requires_quantity) {
                showQuantityExitModal(pendingExit.product, pendingExit.batch);
                return;
            }
            
            throw new Error(error.error || 'Error al retirar stock');
        }
        
        const result = await response.json();
        
        showNotification(
            `✅ Retirado: ${quantity} unidad(es) de ${result.data.product.name}`,
            'success'
        );
        
        // Cerrar modal de escucha
        deactivateExitMode();
        
        // Recargar datos si es necesario
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
        if (typeof loadProducts === 'function') {
            loadProducts();
        }
        
        pendingExit = null;
        
    } catch (error) {
        console.error('Error al procesar salida:', error);
        showNotification(error.message, 'error');
    }
}

// Mostrar modal de cantidad para salida
async function showQuantityExitModal(product, batch) {
    const modal = document.getElementById('quantityExitModal');
    if (!modal) {
        // Si no existe el modal, usar prompt
        const quantityInput = prompt(
            `Este producto es una caja con ${product.units_per_package} unidades.\n` +
            `Stock disponible: ${batch.quantity}\n\n` +
            `¿Cuántas unidades desea retirar?`,
            '1'
        );
        
        if (quantityInput) {
            const quantity = parseInt(quantityInput);
            if (!isNaN(quantity) && quantity > 0) {
                processExit(pendingExit.rfid_uid, quantity);
            }
        }
        return;
    }
    
    document.getElementById('quantityExitProductName').textContent = product.name;
    document.getElementById('quantityExitUnitsPerPackage').textContent = product.units_per_package;
    document.getElementById('quantityExitAvailable').textContent = batch.quantity;
    document.getElementById('quantityExitInput').value = '';
    document.getElementById('quantityExitRfid').value = pendingExit.rfid_uid;
    
    // Cargar áreas en el select
    const areaSelect = document.getElementById('quantityExitArea');
    if (areaSelect && typeof apiMedical !== 'undefined' && apiMedical.getAllAreas) {
        try {
            const areas = await apiMedical.getAllAreas();
            areaSelect.innerHTML = '<option value="">Seleccionar área (opcional)</option>';
            areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.id;
                option.textContent = area.name;
                areaSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar áreas:', error);
        }
    }
    
    modal.style.display = 'block';
}

// Confirmar cantidad salida
async function confirmQuantityExit() {
    const quantityInput = document.getElementById('quantityExitInput');
    const quantity = parseInt(quantityInput.value);
    const rfidUid = document.getElementById('quantityExitRfid').value;
    const areaId = document.getElementById('quantityExitArea')?.value || null;
    
    if (!quantity || quantity <= 0) {
        showNotification('Por favor ingrese una cantidad válida', 'error');
        return;
    }
    
    if (quantity > pendingExit.batch.quantity) {
        showNotification(`Cantidad excede el stock disponible (${pendingExit.batch.quantity})`, 'error');
        return;
    }
    
    const modal = document.getElementById('quantityExitModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    await processExit(rfidUid, quantity, areaId);
}

// Cerrar modal cantidad salida
function closeQuantityExitModal() {
    const modal = document.getElementById('quantityExitModal');
    if (modal) {
        modal.style.display = 'none';
    }
    pendingExit = null;
}

// Función helper para obtener token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Función helper para mostrar notificaciones
function showNotification(message, type = 'info') {
    // Implementar sistema de notificaciones o usar alert temporal
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        console.log('[INFO]', message);
    }
}

// Exportar funciones globalmente
window.handleExitRFID = handleExitRFID;
window.activateExitMode = activateExitMode;
window.deactivateExitMode = deactivateExitMode;
window.processExit = processExit;
window.confirmQuantityExit = confirmQuantityExit;
window.closeQuantityExitModal = closeQuantityExitModal;


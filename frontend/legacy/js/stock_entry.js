// Entrada de Productos con RFID

let entryMode = false;
let pendingEntry = null;

// Activar modo entrada
function activateEntryMode() {
    entryMode = true;
    document.getElementById('entryListeningModal').style.display = 'block';
    showNotification('Modo entrada activado. Acerca el tag RFID al lector', 'info');
}

// Desactivar modo entrada
function deactivateEntryMode() {
    entryMode = false;
    document.getElementById('entryListeningModal').style.display = 'none';
    pendingEntry = null;
}

// Manejar RFID detectado para entrada
async function handleEntryRFID(rfidUid) {
    if (!entryMode) return;
    
    console.log('📥 RFID detectado para entrada:', rfidUid);
    
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
        
        pendingEntry = {
            rfid_uid: rfidUid,
            product: product,
            batch: batch
        };
        
        // Si es una caja (units_per_package > 1), preguntar cantidad
        if (product.units_per_package > 1) {
            showQuantityEntryModal(product, batch, 'entry');
        } else {
            // Si es unidad individual, ingresar 1
            await processEntry(rfidUid, 1);
        }
        
    } catch (error) {
        console.error('Error al procesar entrada:', error);
        showNotification('Error al procesar entrada', 'error');
    }
}

// Procesar entrada
async function processEntry(rfidUid, quantity) {
    try {
        const token = getAuthToken();
        
        const response = await fetch('/api/stock/entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                rfid_uid: rfidUid,
                quantity: quantity
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al ingresar stock');
        }
        
        const result = await response.json();
        
        showNotification(
            `✅ Ingresado: ${quantity} unidad(es) de ${result.data.product.name}`,
            'success'
        );
        
        // Cerrar modal de escucha
        deactivateEntryMode();
        
        // Recargar datos si es necesario
        if (typeof refreshDashboard === 'function') {
            refreshDashboard();
        }
        if (typeof loadProducts === 'function') {
            loadProducts();
        }
        
        pendingEntry = null;
        
    } catch (error) {
        console.error('Error al procesar entrada:', error);
        showNotification(error.message, 'error');
    }
}

// Mostrar modal de cantidad para entrada
function showQuantityEntryModal(product, batch, type) {
    const modal = document.getElementById('quantityEntryModal');
    if (!modal) return;
    
    document.getElementById('quantityEntryProductName').textContent = product.name;
    document.getElementById('quantityEntryUnitsPerPackage').textContent = product.units_per_package;
    document.getElementById('quantityEntryInput').value = '';
    document.getElementById('quantityEntryType').value = type;
    document.getElementById('quantityEntryRfid').value = pendingEntry.rfid_uid;
    
    modal.style.display = 'block';
}

// Confirmar cantidad entrada
async function confirmQuantityEntry() {
    const quantityInput = document.getElementById('quantityEntryInput');
    const quantity = parseInt(quantityInput.value);
    const type = document.getElementById('quantityEntryType').value;
    const rfidUid = document.getElementById('quantityEntryRfid').value;
    
    if (!quantity || quantity <= 0) {
        showNotification('Por favor ingrese una cantidad válida', 'error');
        return;
    }
    
    const modal = document.getElementById('quantityEntryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (type === 'entry') {
        await processEntry(rfidUid, quantity);
    } else {
        // No debería llegar aquí desde quantityEntryModal
        console.warn('Tipo no reconocido en confirmQuantityEntry:', type);
    }
}

// Cerrar modal cantidad
function closeQuantityModal() {
    const modal = document.getElementById('quantityEntryModal');
    if (modal) {
        modal.style.display = 'none';
    }
    pendingEntry = null;
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
window.handleEntryRFID = handleEntryRFID;
window.activateEntryMode = activateEntryMode;
window.deactivateEntryMode = deactivateEntryMode;
window.processEntry = processEntry;
window.confirmQuantityEntry = confirmQuantityEntry;
window.closeQuantityModal = closeQuantityModal;


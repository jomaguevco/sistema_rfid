// Variables globales
let currentPrescription = null;
let socket = null;
let rfidListeningMode = false;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initSocket();
    loadUserInfo();
});

// Verificar autenticación
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        if (data.user && !['admin', 'farmaceutico'].includes(data.user.role)) {
            alert('No tienes permiso para acceder a esta sección');
            window.location.href = '/index_medical.html';
        }
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        window.location.href = '/login.html';
    }
}

// Inicializar Socket.IO
function initSocket() {
    const token = localStorage.getItem('token');
    socket = io({
        auth: {
            token: token
        }
    });
    
    socket.on('connect', () => {
        console.log('✅ Conectado al servidor Socket.IO');
    });
    
    socket.on('rfidExit', (data) => {
        console.log('📡 RFID detectado (salida):', data);
        if (rfidListeningMode && currentPrescription) {
            handleRFIDDetected(data.rfid_uid);
        }
    });
    
    socket.on('rfidEntry', (data) => {
        console.log('📡 RFID detectado (entrada):', data);
        // En modo despacho solo procesamos salidas
    });
    
    socket.on('rfidDetected', (data) => {
        console.log('📡 RFID detectado (genérico):', data);
        if (rfidListeningMode && currentPrescription && data.action === 'remove') {
            handleRFIDDetected(data.rfid_uid);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor Socket.IO');
    });
}

// Cargar información del usuario
function loadUserInfo() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl && user.username) {
        userInfoEl.textContent = `Usuario: ${user.username} (${user.role})`;
    }
}

// Buscar receta
async function searchPrescription() {
    const codeInput = document.getElementById('prescriptionCodeInput');
    const code = codeInput.value.trim();
    
    if (!code) {
        alert('Por favor ingrese un código de receta');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/prescriptions/${code}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Receta no encontrada');
            return;
        }
        
        const result = await response.json();
        currentPrescription = result.data;
        displayPrescription(currentPrescription);
    } catch (error) {
        console.error('Error al buscar receta:', error);
        alert('Error al buscar la receta');
    }
}

// Mostrar información de la receta
function displayPrescription(prescription) {
    document.getElementById('prescriptionCode').textContent = prescription.prescription_code;
    document.getElementById('patientName').textContent = prescription.patient_name;
    document.getElementById('doctorName').textContent = prescription.doctor_name;
    document.getElementById('prescriptionDate').textContent = new Date(prescription.prescription_date).toLocaleDateString('es-ES');
    
    // Mostrar QR si existe
    if (prescription.qr_code) {
        document.getElementById('qrImage').src = prescription.qr_code;
        document.getElementById('prescriptionQR').style.display = 'block';
    }
    
    // Mostrar items
    displayMedications(prescription.items);
    
    // Mostrar sección
    document.getElementById('prescriptionInfo').classList.add('active');
    
    // Verificar si está completa
    checkPrescriptionComplete();
}

// Mostrar medicamentos
function displayMedications(items) {
    const listEl = document.getElementById('medicationsList');
    listEl.innerHTML = '';
    
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'medication-item';
        itemEl.id = `medication-${item.id}`;
        
        const remaining = item.quantity_required - item.quantity_dispensed;
        let statusClass = 'pending';
        let statusText = 'Pendiente';
        
        if (item.quantity_dispensed >= item.quantity_required) {
            statusClass = 'fulfilled';
            statusText = 'Completo';
        } else if (item.quantity_dispensed > 0) {
            statusClass = 'partial';
            statusText = 'Parcial';
        }
        
        itemEl.classList.add(statusClass);
        
        itemEl.innerHTML = `
            <div class="medication-info">
                <div class="medication-name">${item.product_name}</div>
                <div class="medication-details">
                    ${item.active_ingredient || ''} ${item.concentration || ''} - ${item.presentation || ''}
                    ${item.instructions ? `<br><em>${item.instructions}</em>` : ''}
                </div>
            </div>
            <div class="medication-quantity">
                <div class="quantity-status">
                    ${item.quantity_dispensed} / ${item.quantity_required}
                </div>
                <div style="font-size: 12px; color: #718096; margin-top: 5px;">
                    ${remaining > 0 ? `Faltan: ${remaining}` : '✅ Completo'}
                </div>
            </div>
        `;
        
        listEl.appendChild(itemEl);
    });
}

// Activar modo escucha RFID
function activateRFIDListening() {
    if (!currentPrescription) {
        alert('Primero debe buscar una receta');
        return;
    }
    
    rfidListeningMode = true;
    document.getElementById('rfidListening').classList.add('active');
}

// Desactivar modo escucha RFID
function deactivateRFIDListening() {
    rfidListeningMode = false;
    document.getElementById('rfidListening').classList.remove('active');
}

// Manejar RFID detectado
async function handleRFIDDetected(rfidUid) {
    console.log('🔍 Procesando RFID:', rfidUid);
    
    if (!currentPrescription || !currentPrescription.items) {
        return;
    }
    
    // Buscar producto por RFID
    try {
        const token = localStorage.getItem('token');
        const productResponse = await fetch(`/api/products/by-rfid/${rfidUid}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!productResponse.ok) {
            alert('Producto no encontrado para este RFID');
            return;
        }
        
        const productResult = await productResponse.json();
        const product = productResult.data;
        
        // Buscar el producto en los items de la receta
        const prescriptionItem = currentPrescription.items.find(item => 
            item.product_id === product.id
        );
        
        if (!prescriptionItem) {
            alert(`Este producto (${product.name}) no está en la receta`);
            return;
        }
        
        // Verificar si ya está completo
        if (prescriptionItem.quantity_dispensed >= prescriptionItem.quantity_required) {
            alert('Este medicamento ya fue despachado completamente');
            return;
        }
        
        // Calcular cantidad restante
        const remaining = prescriptionItem.quantity_required - prescriptionItem.quantity_dispensed;
        
        // Si es una caja (units_per_package > 1), preguntar cantidad
        let quantityToDispense = 1;
        if (product.units_per_package > 1) {
            const quantityInput = prompt(
                `Este producto es una caja con ${product.units_per_package} unidades.\n` +
                `Cantidad requerida: ${prescriptionItem.quantity_required}\n` +
                `Ya despachado: ${prescriptionItem.quantity_dispensed}\n` +
                `Faltan: ${remaining}\n\n` +
                `¿Cuántas unidades desea despachar?`,
                remaining.toString()
            );
            
            if (!quantityInput) {
                return; // Usuario canceló
            }
            
            quantityToDispense = parseInt(quantityInput);
            
            if (isNaN(quantityToDispense) || quantityToDispense <= 0) {
                alert('Cantidad inválida');
                return;
            }
            
            if (quantityToDispense > remaining) {
                alert(`No puede despachar más de ${remaining} unidades`);
                return;
            }
        } else {
            // Si es unidad individual, usar 1 o la cantidad restante (lo que sea menor)
            quantityToDispense = Math.min(1, remaining);
        }
        
        // Obtener el batch directamente por RFID
        const batchResponse = await fetch(`/api/batches?rfid_uid=${rfidUid}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!batchResponse.ok) {
            alert('Error al obtener información del lote');
            return;
        }
        
        const batchResult = await batchResponse.json();
        const batches = batchResult.data || [];
        
        // Buscar batch con este RFID
        const batch = batches.find(b => b.rfid_uid === rfidUid);
        
        if (!batch) {
            alert('Lote no encontrado para este RFID');
            return;
        }
        
        // Verificar stock disponible
        if (batch.quantity < quantityToDispense) {
            alert(`Stock insuficiente. Disponible: ${batch.quantity}, Requerido: ${quantityToDispense}`);
            return;
        }
        
        // Despachar item
        const fulfillResponse = await fetch(`/api/prescriptions/${currentPrescription.id}/fulfill`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prescription_item_id: prescriptionItem.id,
                batch_id: batch.id,
                quantity: quantityToDispense
            })
        });
        
        if (!fulfillResponse.ok) {
            const error = await fulfillResponse.json();
            alert(error.error || 'Error al despachar medicamento');
            return;
        }
        
        const fulfillResult = await fulfillResponse.json();
        currentPrescription = fulfillResult.data;
        
        // Actualizar visualización
        displayMedications(currentPrescription.items);
        checkPrescriptionComplete();
        
        // Cerrar modal de escucha si está abierto
        deactivateRFIDListening();
        
        alert(`✅ Despachado: ${quantityToDispense} unidad(es) de ${product.name}`);
        
    } catch (error) {
        console.error('Error al procesar RFID:', error);
        let errorMsg = 'Error al procesar el RFID';
        
        if (error.response) {
            try {
                const errorData = await error.response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                errorMsg = error.message || errorMsg;
            }
        } else if (error.message) {
            errorMsg = error.message;
        }
        
        alert(`Error: ${errorMsg}`);
    }
}

// Verificar si la receta está completa
function checkPrescriptionComplete() {
    if (!currentPrescription || !currentPrescription.items) {
        return;
    }
    
    const allComplete = currentPrescription.items.every(item => 
        item.quantity_dispensed >= item.quantity_required
    );
    
    const btnComplete = document.getElementById('btnComplete');
    if (allComplete) {
        btnComplete.classList.add('active');
        btnComplete.disabled = false;
    } else {
        btnComplete.classList.remove('active');
        btnComplete.disabled = true;
    }
}

// Completar receta
async function completePrescription() {
    if (!currentPrescription) {
        return;
    }
    
    const confirmed = confirm('¿Confirmar que el despacho está completo?');
    if (!confirmed) {
        return;
    }
    
    alert('✅ Despacho completado exitosamente');
    
    // Limpiar y resetear
    currentPrescription = null;
    document.getElementById('prescriptionInfo').classList.remove('active');
    document.getElementById('prescriptionCodeInput').value = '';
    deactivateRFIDListening();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}


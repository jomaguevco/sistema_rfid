// Gestión de Recetas (Rol Farmacia)

let prescriptions = [];
let currentPrescription = null;
let allProducts = [];

// Cargar recetas
async function loadPrescriptions() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/prescriptions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar recetas');
        }
        
        const result = await response.json();
        prescriptions = result.data || [];
        displayPrescriptions();
    } catch (error) {
        console.error('Error al cargar recetas:', error);
        showNotification('Error al cargar recetas', 'error');
    }
}

// Mostrar recetas en tabla
function displayPrescriptions() {
    const tbody = document.getElementById('prescriptionsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    prescriptions.forEach(prescription => {
        const row = document.createElement('tr');
        
        const statusClass = {
            'pending': 'badge-warning',
            'partial': 'badge-info',
            'fulfilled': 'badge-success',
            'cancelled': 'badge-danger'
        }[prescription.status] || 'badge-secondary';
        
        row.innerHTML = `
            <td>${prescription.prescription_code}</td>
            <td>${prescription.patient_name}</td>
            <td>${prescription.doctor_name}</td>
            <td>${new Date(prescription.prescription_date).toLocaleDateString('es-ES')}</td>
            <td><span class="badge ${statusClass}">${getStatusText(prescription.status)}</span></td>
            <td>${prescription.items_count || 0}</td>
            <td>
                <button onclick="viewPrescription(${prescription.id})" class="btn btn-sm btn-info">Ver</button>
                <button onclick="printPrescription(${prescription.id})" class="btn btn-sm btn-secondary">Imprimir</button>
                ${prescription.status !== 'fulfilled' ? 
                    `<button onclick="editPrescription(${prescription.id})" class="btn btn-sm btn-warning">Editar</button>` : 
                    ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'partial': 'Parcial',
        'fulfilled': 'Completado',
        'cancelled': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Crear nueva receta
async function createPrescription() {
    const modal = document.getElementById('prescriptionModal');
    if (!modal) return;
    
    currentPrescription = null;
    document.getElementById('prescriptionForm').reset();
    document.getElementById('prescriptionItemsList').innerHTML = '';
    document.getElementById('prescriptionQRDisplay').style.display = 'none';
    
    // Cargar productos
    await loadProductsForPrescription();
    
    modal.style.display = 'block';
}

// Agregar item a receta
function addPrescriptionItem() {
    const productSelect = document.getElementById('prescriptionProductSelect');
    const quantityInput = document.getElementById('prescriptionQuantityInput');
    const instructionsInput = document.getElementById('prescriptionInstructionsInput');
    
    if (!productSelect || !quantityInput) return;
    
    const productId = productSelect.value;
    const quantity = parseInt(quantityInput.value);
    const instructions = instructionsInput.value.trim();
    
    if (!productId || !quantity || quantity <= 0) {
        alert('Por favor seleccione un producto y especifique una cantidad válida');
        return;
    }
    
    const product = allProducts.find(p => p.id === parseInt(productId));
    if (!product) return;
    
    const itemsList = document.getElementById('prescriptionItemsList');
    const itemEl = document.createElement('div');
    itemEl.className = 'prescription-item';
    itemEl.dataset.productId = productId;
    itemEl.innerHTML = `
        <div>
            <strong>${product.name}</strong> - ${product.active_ingredient || ''} ${product.concentration || ''}
            ${instructions ? `<br><em>${instructions}</em>` : ''}
        </div>
        <div>
            <span>Cantidad: ${quantity}</span>
            <button onclick="removePrescriptionItem(this)" class="btn btn-sm btn-danger" style="margin-left: 10px;">Eliminar</button>
        </div>
    `;
    
    itemsList.appendChild(itemEl);
    
    // Limpiar inputs
    productSelect.value = '';
    quantityInput.value = '';
    instructionsInput.value = '';
}

function removePrescriptionItem(button) {
    button.closest('.prescription-item').remove();
}

// Guardar receta
async function savePrescription(event) {
    if (event) {
        event.preventDefault();
    }
    
    const form = document.getElementById('prescriptionForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const items = [];
    
    document.querySelectorAll('.prescription-item').forEach(itemEl => {
        const quantityMatch = itemEl.querySelector('span')?.textContent.match(/\d+/);
        if (quantityMatch) {
            items.push({
                product_id: parseInt(itemEl.dataset.productId),
                quantity_required: parseInt(quantityMatch[0]),
                instructions: itemEl.querySelector('em')?.textContent || ''
            });
        }
    });
    
    if (items.length === 0) {
        alert('Debe agregar al menos un medicamento a la receta');
        return;
    }
    
    const prescriptionData = {
        patient_name: formData.get('patient_name'),
        patient_id: formData.get('patient_id') || null,
        doctor_name: formData.get('doctor_name'),
        doctor_license: formData.get('doctor_license') || null,
        prescription_date: formData.get('prescription_date'),
        notes: formData.get('notes') || null,
        items: items
    };
    
    try {
        showLoading(true);
        const token = getAuthToken();
        const response = await fetch('/api/prescriptions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(prescriptionData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al crear receta');
        }
        
        const result = await response.json();
        
        // Mostrar QR
        const qrCode = result.qr_code || result.data?.qr_code;
        if (qrCode) {
            document.getElementById('prescriptionQRImage').src = qrCode;
            document.getElementById('prescriptionQRDisplay').style.display = 'block';
        }
        
        showNotification('Receta creada exitosamente', 'success');
        
        // Recargar lista
        setTimeout(() => {
            closePrescriptionModal();
            loadPrescriptions();
        }, 2000);
        
    } catch (error) {
        console.error('Error al crear receta:', error);
        showNotification(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Ver receta
async function viewPrescription(id) {
    try {
        const token = getAuthToken();
        const response = await fetch(`/api/prescriptions/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar receta');
        }
        
        const result = await response.json();
        currentPrescription = result.data;
        
        // Mostrar en modal
        displayPrescriptionDetails(currentPrescription);
        
    } catch (error) {
        console.error('Error al ver receta:', error);
        showNotification('Error al cargar receta', 'error');
    }
}

function displayPrescriptionDetails(prescription) {
    // Crear modal para ver detalles
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            <h2>Receta: ${prescription.prescription_code}</h2>
            <div style="margin: 20px 0;">
                <p><strong>Paciente:</strong> ${prescription.patient_name}</p>
                <p><strong>Médico:</strong> ${prescription.doctor_name}</p>
                <p><strong>Fecha:</strong> ${new Date(prescription.prescription_date).toLocaleDateString('es-ES')}</p>
                <p><strong>Estado:</strong> ${getStatusText(prescription.status)}</p>
            </div>
            ${prescription.qr_code ? `<div style="text-align: center;"><img src="${prescription.qr_code}" alt="QR" style="max-width: 200px;"></div>` : ''}
            <div class="form-actions">
                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Imprimir receta
async function printPrescription(id) {
    try {
        const token = getAuthToken();
        const response = await fetch(`/api/prescriptions/${id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar receta');
        }
        
        const result = await response.json();
        const prescription = result.data;
        
        // Abrir ventana de impresión
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Receta ${prescription.prescription_code}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #2c5282; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background: #667eea; color: white; }
                    </style>
                </head>
                <body>
                    <h1>Receta Médica: ${prescription.prescription_code}</h1>
                    <p><strong>Paciente:</strong> ${prescription.patient_name}</p>
                    <p><strong>Médico:</strong> ${prescription.doctor_name}</p>
                    <p><strong>Fecha:</strong> ${new Date(prescription.prescription_date).toLocaleDateString('es-ES')}</p>
                    <h2>Medicamentos:</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Medicamento</th>
                                <th>Cantidad</th>
                                <th>Instrucciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${prescription.items.map(item => `
                                <tr>
                                    <td>${item.product_name}</td>
                                    <td>${item.quantity_required}</td>
                                    <td>${item.instructions || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        console.error('Error al imprimir receta:', error);
        alert('Error al imprimir la receta');
    }
}

// Editar receta
function editPrescription(id) {
    // Por ahora, solo mostrar mensaje
    alert('La edición de recetas estará disponible próximamente. Puede crear una nueva receta.');
}

// Cerrar modal
function closePrescriptionModal() {
    const modal = document.getElementById('prescriptionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Cargar productos para el select
async function loadProductsForPrescription() {
    try {
        const token = getAuthToken();
        const response = await fetch('/api/products?limit=1000', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        const result = await response.json();
        allProducts = result.data || [];
        
        const select = document.getElementById('prescriptionProductSelect');
        if (select) {
            select.innerHTML = '<option value="">Seleccione un producto</option>';
            allProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} - ${product.active_ingredient || ''} ${product.concentration || ''}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showNotification('Error al cargar productos', 'error');
    }
}

// Función helper para mostrar notificaciones
function showNotification(message, type = 'info') {
    // Implementar sistema de notificaciones
    console.log(`[${type.toUpperCase()}] ${message}`);
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        // Fallback a alert
        if (type === 'error') {
            alert('❌ ' + message);
        } else if (type === 'success') {
            alert('✅ ' + message);
        } else {
            alert(message);
        }
    }
}

// Exportar funciones globalmente
window.loadPrescriptions = loadPrescriptions;
window.createPrescription = createPrescription;
window.viewPrescription = viewPrescription;
window.printPrescription = printPrescription;
window.editPrescription = editPrescription;
window.addPrescriptionItem = addPrescriptionItem;
window.removePrescriptionItem = removePrescriptionItem;
window.savePrescription = savePrescription;
window.closePrescriptionModal = closePrescriptionModal;
window.loadProductsForPrescription = loadProductsForPrescription;


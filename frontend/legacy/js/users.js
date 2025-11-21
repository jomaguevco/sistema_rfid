// Módulo de gestión de usuarios

/**
 * Cargar vista de usuarios
 */
async function loadUsersView() {
  const container = document.getElementById('usersContent');
  if (!container) return;
  
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      renderUsersTable(data.data);
    } else {
      container.innerHTML = `<p class="text-danger">Error: ${data.error}</p>`;
    }
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    container.innerHTML = `<p class="text-danger">Error al cargar usuarios: ${error.message}</p>`;
  }
}

/**
 * Renderizar tabla de usuarios
 */
function renderUsersTable(users) {
  const container = document.getElementById('usersContent');
  if (!container) return;
  
  const roleNames = {
    'admin': 'Administrador',
    'farmaceutico': 'Farmacéutico',
    'enfermero': 'Enfermero',
    'supervisor': 'Supervisor',
    'auditor': 'Auditor'
  };
  
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-ES');
  };
  
  container.innerHTML = `
    <div class="table-container">
      <table class="products-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Último Login</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${user.id}</td>
              <td><strong>${escapeHtml(user.username)}</strong></td>
              <td>${escapeHtml(user.email)}</td>
              <td><span class="badge badge-info">${roleNames[user.role] || user.role}</span></td>
              <td>
                ${user.is_active 
                  ? '<span class="badge badge-success">Activo</span>' 
                  : '<span class="badge badge-danger">Inactivo</span>'}
              </td>
              <td>${formatDate(user.last_login)}</td>
              <td>
                <button onclick="editUser(${user.id})" class="btn btn-sm btn-primary">✏️ Editar</button>
                ${user.is_active 
                  ? `<button onclick="toggleUserStatus(${user.id}, false)" class="btn btn-sm btn-warning">🚫 Desactivar</button>`
                  : `<button onclick="toggleUserStatus(${user.id}, true)" class="btn btn-sm btn-success">✅ Activar</button>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Mostrar formulario de usuario
 */
function showUserForm(user = null) {
  const modal = document.createElement('div');
  modal.id = 'userModal';
  modal.className = 'modal';
  modal.style.display = 'block';
  
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeUserModal()">&times;</span>
      <h2>${user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
      <form id="userForm" onsubmit="saveUser(event)">
        <input type="hidden" id="userId" value="${user ? user.id : ''}">
        <div class="form-group">
          <label>Usuario *</label>
          <input type="text" id="userUsername" value="${user ? escapeHtml(user.username) : ''}" required>
        </div>
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="userEmail" value="${user ? escapeHtml(user.email) : ''}" required>
        </div>
        <div class="form-group">
          <label>Rol *</label>
          <select id="userRole" required>
            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Administrador</option>
            <option value="farmaceutico" ${user && user.role === 'farmaceutico' ? 'selected' : ''}>Farmacéutico</option>
            <option value="enfermero" ${user && user.role === 'enfermero' ? 'selected' : ''}>Enfermero</option>
            <option value="supervisor" ${user && user.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="auditor" ${user && user.role === 'auditor' ? 'selected' : ''}>Auditor</option>
          </select>
        </div>
        ${!user ? `
        <div class="form-group">
          <label>Contraseña *</label>
          <input type="password" id="userPassword" required minlength="6">
        </div>
        ` : `
        <div class="form-group">
          <label>Nueva Contraseña (dejar vacío para no cambiar)</label>
          <input type="password" id="userPassword" minlength="6">
        </div>
        `}
        <div class="form-actions">
          <button type="submit" class="btn btn-success">Guardar</button>
          <button type="button" class="btn btn-secondary" onclick="closeUserModal()">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.onclick = function(event) {
    if (event.target === modal) {
      closeUserModal();
    }
  };
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Guardar usuario
 */
async function saveUser(event) {
  event.preventDefault();
  
  const userId = document.getElementById('userId')?.value;
  const username = document.getElementById('userUsername')?.value.trim();
  const email = document.getElementById('userEmail')?.value.trim();
  const role = document.getElementById('userRole')?.value;
  const password = document.getElementById('userPassword')?.value;
  
  if (!username || !email || !role) {
    showNotification('Todos los campos son requeridos', 'error');
    return;
  }
  
  if (!userId && !password) {
    showNotification('La contraseña es requerida para nuevos usuarios', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const token = localStorage.getItem('authToken');
    
    const userData = {
      username,
      email,
      role
    };
    
    if (password) {
      userData.password = password;
    }
    
    let response;
    if (userId) {
      // Actualizar
      response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
    } else {
      // Crear
      response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
    }
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(userId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente', 'success');
      closeUserModal();
      await loadUsersView();
    } else {
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error al guardar usuario:', error);
    showNotification(`Error al guardar usuario: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

/**
 * Editar usuario
 */
async function editUser(id) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`/api/users/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showUserForm(data.data);
    } else {
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error al cargar usuario:', error);
    showNotification(`Error al cargar usuario: ${error.message}`, 'error');
  }
}

/**
 * Cambiar estado de usuario
 */
async function toggleUserStatus(id, activate) {
  const action = activate ? 'activar' : 'desactivar';
  if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} este usuario?`)) {
    return;
  }
  
  try {
    showLoading(true);
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: activate })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification(`Usuario ${action}do correctamente`, 'success');
      await loadUsersView();
    } else {
      showNotification(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
}

// Exportar funciones globalmente
window.loadUsersView = loadUsersView;
window.showUserForm = showUserForm;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;


// Módulo de autenticación del frontend

/**
 * Verificar si el usuario está autenticado
 */
function isAuthenticated() {
  return !!localStorage.getItem('authToken');
}

/**
 * Obtener usuario actual
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Obtener token de autenticación
 */
function getAuthToken() {
  return localStorage.getItem('authToken');
}

/**
 * Cerrar sesión
 */
async function logout() {
  try {
    const token = getAuthToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  }
}

/**
 * Verificar autenticación y redirigir si es necesario
 */
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Verificar si el usuario tiene un rol específico
 */
function hasRole(role) {
  const user = getCurrentUser();
  return user && user.role === role;
}

/**
 * Verificar si el usuario es administrador
 */
function isAdmin() {
  return hasRole('admin');
}

// Exportar funciones globalmente
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.getAuthToken = getAuthToken;
window.logout = logout;
window.requireAuth = requireAuth;
window.hasRole = hasRole;
window.isAdmin = isAdmin;


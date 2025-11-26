import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  HiHome,
  HiCube,
  HiClipboardList,
  HiArrowDown,
  HiArrowUp,
  HiFolder,
  HiOfficeBuilding,
  HiUsers,
  HiUserGroup,
  HiUser,
  HiBeaker,
  HiChartBar,
  HiBell,
  HiShieldCheck,
  HiLogout,
  HiQrcode,
  HiMenu,
  HiX
} from 'react-icons/hi'
import Button from './Button'
import './Layout.css'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, hasRole, canAccess, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Cerrar sidebar al navegar en móvil
  const handleNavigate = (path) => {
    navigate(path)
    setSidebarOpen(false)
  }

  // Si está cargando, mostrar loading
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Cargando...</div>
      </div>
    )
  }

  // Si no hay usuario, el ProtectedRoute debería haber redirigido, pero por seguridad retornar null
  if (!user) {
    return null
  }

  const isActive = (path) => location.pathname === path

  // Menú base para todos los usuarios
  const baseMenuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HiHome },
    { path: '/stock', label: 'Stock', icon: HiCube },
    { path: '/prescriptions', label: 'Recetas', icon: HiClipboardList },
    { path: '/predictions', label: 'Predicciones', icon: HiChartBar },
    { path: '/stock-entry', label: 'Entrada Stock', icon: HiArrowDown },
    { path: '/stock-exit', label: 'Salida Stock', icon: HiArrowUp }
  ]

  // Menú para químicos farmacéuticos y admin (escáner QR)
  const pharmacistMenuItems = [
    { path: '/qr-scanner', label: 'Escanear QR', icon: HiQrcode }
  ]

  // Menú adicional solo para Admin
  const adminMenuItems = [
    { path: '/products', label: 'Catálogo Medicamentos', icon: HiCube },
    { path: '/categories', label: 'Categorías', icon: HiFolder },
    { path: '/areas', label: 'Áreas', icon: HiOfficeBuilding },
    { path: '/users', label: 'Usuarios', icon: HiUsers },
    { path: '/doctors', label: 'Doctores', icon: HiUserGroup },
    { path: '/patients', label: 'Pacientes', icon: HiUser },
    { path: '/pharmacists', label: 'Químicos Farmacéuticos', icon: HiBeaker },
    { path: '/reports', label: 'Reportes', icon: HiChartBar },
    { path: '/alerts', label: 'Alertas', icon: HiBell }
  ]

  // Filtrar items según permisos (solo si user existe)
  const menuItems = user ? baseMenuItems.filter(item => canAccess(item.path)) : []
  const adminItems = user && hasRole('admin') 
    ? adminMenuItems.filter(item => canAccess(item.path))
    : []
  const pharmacistItems = user && (hasRole('farmaceutico') || hasRole('admin'))
    ? pharmacistMenuItems.filter(item => canAccess(item.path))
    : []

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      farmaceutico: 'Químico Farmacéutico',
      medico: 'Médico'
    }
    return labels[role] || role
  }

  return (
    <div className="app-layout">
      {/* Botón hamburguesa para móvil */}
      <button 
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Menú"
      >
        {sidebarOpen ? <HiX /> : <HiMenu />}
      </button>

      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <HiShieldCheck />
          </div>
          <h1>Sistema Hospitalario</h1>
          <p className="sidebar-subtitle">Gestión de Stock</p>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <button
                  className={isActive(item.path) ? 'active' : ''}
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
          {pharmacistItems.length > 0 && (
            <>
              <li className="sidebar-divider">
                <span>Despacho</span>
              </li>
              {pharmacistItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <button
                      className={isActive(item.path) ? 'active' : ''}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </>
          )}
          {adminItems.length > 0 && (
            <>
              <li className="sidebar-divider">
                <span>Administración</span>
              </li>
              {adminItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.path}>
                    <button
                      className={isActive(item.path) ? 'active' : ''}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </>
          )}
        </ul>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <small className="user-role">{getRoleLabel(user?.role)}</small>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => { logout(); setSidebarOpen(false); }}
            className="sidebar-logout"
          >
            <HiLogout />
            Cerrar Sesión
          </Button>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}


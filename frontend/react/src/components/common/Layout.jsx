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
  HiLogout
} from 'react-icons/hi'
import Button from './Button'
import './Layout.css'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, hasRole, canAccess } = useAuth()

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

  // Filtrar items según permisos
  const menuItems = baseMenuItems.filter(item => canAccess(item.path))
  const adminItems = hasRole('admin') 
    ? adminMenuItems.filter(item => canAccess(item.path))
    : []

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      farmaceutico: 'Químico Farmacéutico'
    }
    return labels[role] || role
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
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
                  onClick={() => navigate(item.path)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
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
                      onClick={() => navigate(item.path)}
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
            onClick={logout}
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


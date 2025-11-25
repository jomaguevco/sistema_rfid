import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Stock from './pages/Stock'
import Prescriptions from './pages/Prescriptions'
import QRScanner from './pages/QRScanner'
import StockEntry from './pages/StockEntry'
import StockExit from './pages/StockExit'
import Predictions from './pages/Predictions'
import Categories from './pages/Categories'
import Areas from './pages/Areas'
import Users from './pages/Users'
import Doctors from './pages/Doctors'
import Patients from './pages/Patients'
import Pharmacists from './pages/Pharmacists'
import Reports from './pages/Reports'
import Alerts from './pages/Alerts'
import ProtectedRoute from './components/common/ProtectedRoute'
import Layout from './components/common/Layout'
import DefaultRedirect from './components/common/DefaultRedirect'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DefaultRedirect />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="stock" element={<Stock />} />
                  <Route path="prescriptions" element={<Prescriptions />} />
                  <Route path="qr-scanner" element={<QRScanner />} />
                  <Route path="stock-entry" element={<StockEntry />} />
                  <Route path="stock-exit" element={<StockExit />} />
                  <Route path="predictions" element={<Predictions />} />
                  {/* Rutas solo para Admin */}
                  <Route path="categories" element={<Categories />} />
                  <Route path="areas" element={<Areas />} />
                  <Route path="users" element={<Users />} />
                  <Route path="doctors" element={<Doctors />} />
                  <Route path="patients" element={<Patients />} />
                  <Route path="pharmacists" element={<Pharmacists />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="*" element={<DefaultRedirect />} />
                </Route>
              </Routes>
            </Router>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App


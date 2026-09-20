import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Estabelecimentos from '@/pages/Estabelecimentos';
import Placas from '@/pages/Placas';
import Scans from '@/pages/Scans';
import Configuracoes from '@/pages/Configuracoes';
import QrRedirect from '@/pages/QrRedirect';
import NfcRedirect from '@/pages/NfcRedirect';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public redirects */}
          <Route path="/q/:codigo" element={<QrRedirect />} />
          <Route path="/n/:codigo" element={<NfcRedirect />} />

          {/* Login */}
          <Route path="/login" element={<Login />} />

          {/* Protected admin routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/estabelecimentos"
            element={
              <ProtectedRoute>
                <Layout>
                  <Estabelecimentos />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/placas"
            element={
              <ProtectedRoute>
                <Layout>
                  <Placas />
                </Layout>
              </ProtectedRoute>
            }
          />
          {/* Links antigos continuam funcionando, redirecionando pra página unificada */}
          <Route path="/qr-codes" element={<Navigate to="/placas" replace />} />
          <Route path="/nfc-tags" element={<Navigate to="/placas" replace />} />
          <Route
            path="/scans"
            element={
              <ProtectedRoute>
                <Layout>
                  <Scans />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <Layout>
                  <Configuracoes />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

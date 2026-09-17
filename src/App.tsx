import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Estabelecimentos from '@/pages/Estabelecimentos';
import QrCodes from '@/pages/QrCodes';
import Scans from '@/pages/Scans';
import Configuracoes from '@/pages/Configuracoes';
import QrRedirect from '@/pages/QrRedirect';
import NfcTags from '@/pages/NfcTags';
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
            path="/qr-codes"
            element={
              <ProtectedRoute>
                <Layout>
                  <QrCodes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/nfc-tags"
            element={
              <ProtectedRoute>
                <Layout>
                  <NfcTags />
                </Layout>
              </ProtectedRoute>
            }
          />
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

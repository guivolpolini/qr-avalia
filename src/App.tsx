import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import QrRedirect from '@/pages/QrRedirect';
import NfcRedirect from '@/pages/NfcRedirect';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Estabelecimentos = lazy(() => import('@/pages/Estabelecimentos'));
const Placas = lazy(() => import('@/pages/Placas'));
const Scans = lazy(() => import('@/pages/Scans'));
const GoogleSeo = lazy(() => import('@/pages/GoogleSeo'));
const Configuracoes = lazy(() => import('@/pages/Configuracoes'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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
            path="/google-seo"
            element={
              <ProtectedRoute>
                <Layout>
                  <GoogleSeo />
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
      </Suspense>
    </BrowserRouter>
  </AuthProvider>
  );
}

export default App;

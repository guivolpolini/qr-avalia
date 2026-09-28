import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  QrCode,
  ScanLine,
  Settings,
  LogOut,
  Search,
  QrCode as QrIcon,
  Target,
  Camera,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const desktopNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/estabelecimentos', label: 'Estabelecimentos', icon: Store },
  { to: '/placas', label: 'Placas', icon: QrCode },
  { to: '/scans', label: 'Scans', icon: ScanLine },
  { to: '/google-seo', label: 'Google / SEO', icon: Search },
  { to: '/prospeccao', label: 'Prospecção', icon: Target },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isMoreActive = ['/scans', '/google-seo', '/prospeccao', '/configuracoes'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-slate-200 z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-600 text-white shadow-xs">
            <QrIcon size={20} />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">QR Avalia</p>
            <p className="text-xs text-slate-400 leading-tight">Painel Administrativo</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{user?.email ?? 'admin'}</p>
              <p className="text-xs text-slate-400">Administrador</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="btn-ghost w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar (Estilo iOS App Header) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 text-white shadow-xs">
              <QrIcon size={17} />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 text-sm tracking-tight leading-none">QR Avalia</span>
              <span className="text-[10px] text-slate-400 font-medium">Admin Mobile</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold border border-slate-200">
              {user?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="lg:ml-64 flex-1 pb-24 lg:pb-8 pt-2">
        <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile Bottom Navigation (Estilo Nativo iPhone) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 pb-[env(safe-area-inset-bottom,0px)] shadow-lg">
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {/* 1. Início */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-brand-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <LayoutDashboard size={20} />
            <span className="text-[10px] mt-1">Início</span>
          </NavLink>

          {/* 2. Clientes */}
          <NavLink
            to="/estabelecimentos"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-brand-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <Store size={20} />
            <span className="text-[10px] mt-1">Clientes</span>
          </NavLink>

          {/* 3. Ação Central: Escanear / Ativar */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <NavLink
              to="/placas?scan=true"
              className="flex items-center justify-center w-13 h-13 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-500/35 border-3 border-white active:scale-95 transition-transform"
              title="Escanear ou Ativar Placa"
            >
              <Camera size={22} />
            </NavLink>
            <span className="text-[10px] font-semibold text-brand-600 mt-0.5">Ativar</span>
          </div>

          {/* 4. Placas */}
          <NavLink
            to="/placas"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive && !location.search.includes('scan=true')
                  ? 'text-brand-600 font-semibold'
                  : 'text-slate-400 hover:text-slate-600'
              }`
            }
          >
            <QrCode size={20} />
            <span className="text-[10px] mt-1">Placas</span>
          </NavLink>

          {/* 5. Mais */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              isMoreActive || showMoreMenu ? 'text-brand-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Menu size={20} />
            <span className="text-[10px] mt-1">Mais</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet Móvel "Mais Opções" (Nativo iOS) */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop escurecido */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setShowMoreMenu(false)}
          />

          {/* Sheet deslizante */}
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl z-10 animate-slide-up space-y-4">
            {/* Puxador iOS */}
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Outras Seções</h3>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              <NavLink
                to="/scans"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <ScanLine size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Histórico de Scans</p>
                    <p className="text-xs text-slate-400">Logs detalhados de leituras</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </NavLink>

              <NavLink
                to="/google-seo"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Search size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Google / SEO Local</p>
                    <p className="text-xs text-slate-400">Checklist e reputação de clientes</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </NavLink>

              <NavLink
                to="/prospeccao"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Target size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Prospecção Local</p>
                    <p className="text-xs text-slate-400">Busca de leads e novos clientes</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </NavLink>

              <NavLink
                to="/configuracoes"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Settings size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Configurações</p>
                    <p className="text-xs text-slate-400">Senha e dados da conta</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </NavLink>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-semibold text-sm active:bg-red-100 transition-colors"
              >
                <LogOut size={16} />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

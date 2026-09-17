import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, QrCode, Nfc, ScanLine, Settings, LogOut, QrCode as QrIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/estabelecimentos', label: 'Estabelecimentos', icon: Store },
  { to: '/qr-codes', label: 'QR Codes', icon: QrCode },
  { to: '/nfc-tags', label: 'Tags NFC', icon: Nfc },
  { to: '/scans', label: 'Scans', icon: ScanLine },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r border-slate-200 z-30">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600 text-white">
            <QrIcon size={20} />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">QR Avalia</p>
            <p className="text-xs text-slate-400 leading-tight">Painel Administrativo</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
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
          <button onClick={handleSignOut} className="btn-ghost w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white">
            <QrIcon size={16} />
          </div>
          <span className="font-bold text-slate-900">QR Avalia</span>
        </div>
        <button onClick={handleSignOut} className="text-slate-400 hover:text-red-500">
          <LogOut size={20} />
        </button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around bg-white border-t border-slate-200 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Content */}
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

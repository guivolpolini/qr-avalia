import { useState } from 'react';
import { Settings, User, Mail, Loader2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Configuracoes() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 4000);
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie sua conta e preferências</p>
      </div>

      {/* Account info */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-slate-400" />
          <h2 className="font-bold text-slate-900">Informações da conta</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-100 text-brand-600">
              <User size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Usuário</p>
              <p className="text-sm font-medium text-slate-700">Administrador</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-100 text-brand-600">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs text-slate-400">E-mail</p>
              <p className="text-sm font-medium text-slate-700">{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-bold text-slate-900 mb-1">Alterar senha</h2>
        <p className="text-sm text-slate-500 mb-4">Defina uma nova senha para sua conta</p>

        {error && (
          <div className="flex items-start gap-2.5 mb-4 p-3.5 rounded-lg bg-red-50 text-red-600 text-sm animate-fade-in">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2.5 mb-4 p-3.5 rounded-lg bg-emerald-50 text-emerald-600 text-sm animate-fade-in">
            <Check size={18} />
            <span>Senha alterada com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Nova senha</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder="Mínimo 6 caracteres" required />
          </div>
          <div>
            <label className="label">Confirmar senha</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="Repita a nova senha" required />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

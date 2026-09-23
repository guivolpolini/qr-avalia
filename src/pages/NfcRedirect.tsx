import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Nfc, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = 'loading' | 'redirecting' | 'not_found';

export default function NfcRedirect() {
  const { codigo } = useParams<{ codigo: string }>();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!codigo) {
      setState('not_found');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('direct') === 'false') {
      setState('not_found');
      return;
    }

    (async () => {
      const userAgent = navigator.userAgent;
      const { data: link, error } = await supabase.rpc('resolve_nfc_tag', {
        p_codigo: codigo,
        p_user_agent: userAgent,
        p_ip: '',
      });

      if (error || !link) {
        setState('not_found');
        return;
      }

      setState('redirecting');
      window.location.replace(link);
    })();
  }, [codigo]);

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-6">
            <Nfc size={32} />
          </div>
          {state === 'loading' ? (
            <>
              <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">Verificando Tag NFC...</h1>
              <p className="text-sm text-slate-500">Aguarde um instante</p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4">
                <ExternalLink size={24} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Redirecionando...</h1>
              <p className="text-sm text-slate-500">Você será levado à página de avaliação</p>
              <Loader2 size={20} className="animate-spin text-brand-400 mx-auto mt-4" />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="text-center max-w-sm animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 text-red-500 mb-6">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Tag NFC não disponível</h1>
        <p className="text-sm text-slate-500 mb-6">
          Esta Tag NFC não existe, está desativada ou não possui um estabelecimento associado no momento.
        </p>
        <div className="p-4 rounded-lg bg-white border border-slate-200 text-left">
          <p className="text-xs text-slate-400 mb-1">Código consultado</p>
          <p className="font-mono font-bold text-slate-700">{codigo ?? '—'}</p>
        </div>
        <p className="text-xs text-slate-400 mt-6">
          Se você acredita que isso é um erro, entre em contato com o administrador do sistema.
        </p>
      </div>
    </div>
  );
}

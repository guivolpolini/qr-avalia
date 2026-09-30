import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Nfc, Loader2, AlertTriangle, ExternalLink, WifiOff, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = 'loading' | 'redirecting' | 'network_error' | 'not_found';

export default function NfcRedirect() {
  const { codigo } = useParams<{ codigo: string }>();
  const [state, setState] = useState<State>('loading');
  const [isSlow, setIsSlow] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(1);

  const resolveTag = useCallback(async (attempt = 1) => {
    if (!codigo) {
      setState('not_found');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('direct') === 'false') {
      setState('not_found');
      return;
    }

    setState('loading');
    setRetryAttempt(attempt);

    try {
      const userAgent = navigator.userAgent;

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), 8000)
      );

      const fetchPromise = supabase.rpc('resolve_nfc_tag', {
        p_codigo: codigo,
        p_user_agent: userAgent,
        p_ip: '',
      });

      const { data: link, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        throw error;
      }

      if (!link) {
        // Tag realmente não existe ou está inativa no banco
        setState('not_found');
        return;
      }

      setState('redirecting');
      window.location.replace(link);
    } catch (err: any) {
      console.warn(`Tentativa ${attempt} de resolver Tag NFC falhou:`, err);
      if (attempt < 3) {
        setTimeout(() => {
          resolveTag(attempt + 1);
        }, 1500);
      } else {
        setState('network_error');
      }
    }
  }, [codigo]);

  useEffect(() => {
    resolveTag(1);
  }, [resolveTag]);

  // Alerta dinâmico de conexão lenta se passar de 3 segundos carregando
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (state === 'loading') {
      timer = setTimeout(() => {
        setIsSlow(true);
      }, 3000);
    } else {
      setIsSlow(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [state]);

  if (state === 'loading' || state === 'redirecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-6 shadow-md shadow-brand-500/20">
            <Nfc size={32} />
            {isSlow && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
              </span>
            )}
          </div>

          {state === 'loading' ? (
            <>
              <Loader2 size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                {isSlow ? 'Conectando ao Google...' : 'Verificando Tag NFC...'}
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isSlow ? (
                  <span className="text-amber-800 bg-amber-50 border border-amber-200 py-1 px-3 rounded-lg font-medium inline-block animate-pulse text-xs">
                    Sua conexão parece estar lenta, aguarde...
                  </span>
                ) : (
                  'Aguarde um instante enquanto abrimos a avaliação'
                )}
              </p>
              {retryAttempt > 1 && (
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Reconectando (tentativa {retryAttempt} de 3)...
                </p>
              )}
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-4 border border-emerald-100">
                <ExternalLink size={24} />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">Redirecionando...</h1>
              <p className="text-sm text-slate-500">Você será levado à página de avaliação</p>
              <Loader2 size={20} className="animate-spin text-brand-400 mx-auto mt-4" />
            </>
          )}

          <div className="mt-8">
            <a href="/dashboard" className="text-xs text-slate-400 hover:text-slate-600 underline">
              Cancelar e voltar ao painel
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Falha de conexão / Internet instável
  if (state === 'network_error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mb-6 border border-amber-200 shadow-xs">
            <WifiOff size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sinal de Internet Instável</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Não conseguimos conectar ao Google devido à oscilação da sua conexão 4G/5G ou Wi-Fi.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => resolveTag(1)}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-md shadow-brand-500/20 hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw size={16} />
              Tentar Novamente
            </button>

            <a
              href="/dashboard"
              className="block w-full py-2.5 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 active:scale-95 transition-all text-center"
            >
              Voltar ao Painel
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            Dica: Verifique se sua internet móvel está ativa no celular.
          </p>
        </div>
      </div>
    );
  }

  // not_found (realmente não cadastrado ou inativo)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="text-center max-w-sm animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 mb-6 border border-slate-200">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Tag NFC em Configuração</h1>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Esta Tag NFC ainda não foi vinculada a um estabelecimento ou está temporariamente desativada.
        </p>
        <div className="p-4 rounded-xl bg-white border border-slate-200 text-left shadow-xs">
          <p className="text-xs text-slate-400 mb-1">Código consultado</p>
          <p className="font-mono font-bold text-slate-800 text-base">{codigo ?? '—'}</p>
        </div>

        <div className="mt-6">
          <a
            href="/dashboard"
            className="block w-full py-3 px-4 rounded-xl bg-brand-600 text-white text-sm font-bold shadow-xs hover:bg-brand-700 active:scale-95 transition-all text-center"
          >
            ← Voltar para o Painel
          </a>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Se você é o proprietário desta tag, vincule-a pelo painel administrativo do QR Avalia.
        </p>
      </div>
    </div>
  );
}

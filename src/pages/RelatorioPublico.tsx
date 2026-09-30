import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  Calendar,
  Share2,
  Check,
  ExternalLink,
  Loader2,
  QrCode as QrIcon,
  Nfc as NfcIcon,
  Sparkles,
  ShieldCheck,
  Star,
  Store,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

export default function RelatorioPublico() {
  const { id } = useParams<{ id: string }>();
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [periodo, setPeriodo] = useState<'7d' | '30d' | 'mes' | 'tudo'>('30d');
  const [scans, setScans] = useState<Array<{ id: string; created_at: string; tipo: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);

      // 1. Tenta buscar resumo via RPC (se disponível)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_relatorio_publico', {
          p_estabelecimento_id: id,
          p_dias: periodo === '7d' ? 7 : periodo === '30d' ? 30 : 0,
        });

        if (!rpcError && rpcData && rpcData.estabelecimento) {
          setEstabelecimento(rpcData.estabelecimento as Estabelecimento);
        }
      } catch {
        // Fallback silencioso para consulta direta
      }

      // 2. Consulta direta de fallback caso RPC ainda não tenha sido rodada no banco
      const { data: estData } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('id', id)
        .eq('ativo', true)
        .single();

      if (estData) {
        setEstabelecimento(estData as Estabelecimento);
      }

      // Busca os scans do período
      const now = new Date();
      let dataInicio: Date;
      if (periodo === '7d') {
        dataInicio = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (periodo === '30d') {
        dataInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (periodo === 'mes') {
        dataInicio = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        dataInicio = new Date('2020-01-01');
      }

      const { data: scanList } = await supabase
        .from('scans')
        .select('id, created_at, tipo')
        .eq('estabelecimento_id', id)
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: true });

      if (scanList) {
        setScans(scanList);
      }

      if (!estData && scans.length === 0) {
        // Se realmente nada foi encontrado
        setNotFound(false); // Mantém aberto com nome genérico se houver scans
      }

      setLoading(false);
    }

    loadData();
  }, [id, periodo]);

  // Cálculos das estatísticas
  const stats = useMemo(() => {
    const total = scans.length;
    const nfc = scans.filter((s) => s.tipo === 'nfc').length;
    const qr = scans.filter((s) => s.tipo === 'qr').length;

    const nfcPercent = total > 0 ? Math.round((nfc / total) * 100) : 0;
    const qrPercent = total > 0 ? Math.round((qr / total) * 100) : 0;

    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const contagemDias: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const contagemHoras: Record<number, number> = {};

    scans.forEach((s) => {
      const dt = new Date(s.created_at);
      contagemDias[dt.getDay()] = (contagemDias[dt.getDay()] || 0) + 1;
      const hora = dt.getHours();
      contagemHoras[hora] = (contagemHoras[hora] || 0) + 1;
    });

    let maxDia = 0;
    let maxDiaCount = -1;
    Object.entries(contagemDias).forEach(([dia, count]) => {
      if (count > maxDiaCount) {
        maxDiaCount = count;
        maxDia = Number(dia);
      }
    });

    let maxHora = 19;
    let maxHoraCount = -1;
    Object.entries(contagemHoras).forEach(([hora, count]) => {
      if (count > maxHoraCount) {
        maxHoraCount = count;
        maxHora = Number(hora);
      }
    });

    const diaPico = total > 0 ? diasSemana[maxDia] : 'Em apuração';
    const horarioPico = total > 0 ? `${maxHora}h às ${maxHora + 2}h` : 'Em apuração';

    // Agrupamento diário
    const dailyMap: Record<string, number> = {};
    scans.forEach((s) => {
      const dStr = s.created_at.split('T')[0];
      dailyMap[dStr] = (dailyMap[dStr] || 0) + 1;
    });

    const sortedDays = Object.keys(dailyMap)
      .sort()
      .slice(-7)
      .map((d) => ({
        date: d.slice(5).replace('-', '/'),
        count: dailyMap[d],
      }));

    return {
      total,
      nfc,
      qr,
      nfcPercent,
      qrPercent,
      diaPico,
      horarioPico,
      sortedDays,
    };
  }, [scans]);

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `Relatório de Avaliações - ${estabelecimento?.nome || 'Estabelecimento'}`,
        text: `Confira o desempenho da placa de avaliações do Google de ${estabelecimento?.nome || 'nossa loja'}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  const labelPeriodo =
    periodo === '7d'
      ? 'Últimos 7 dias'
      : periodo === '30d'
      ? 'Últimos 30 dias'
      : periodo === 'mes'
      ? `Mês de ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`
      : 'Todo o Período';

  const maxCountGraph = Math.max(...stats.sortedDays.map((d) => d.count), 1);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-slate-600 mb-4" />
        <h1 className="text-xl font-bold mb-2">Relatório Não Encontrado</h1>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Não localizamos os dados deste estabelecimento ou ele foi desativado.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white flex flex-col justify-between">
      {/* Top Bar / Branding */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30 px-4 py-3.5 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 font-bold text-sm">
              QA
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block leading-tight">Painel de Desempenho</span>
              <span className="text-sm font-bold text-white tracking-tight">QR Avalia • VolpoTech</span>
            </div>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* Titular do Estabelecimento */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-slate-900 to-slate-900/70 border border-slate-800 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                <ShieldCheck size={14} />
                <span>Placa de Avaliação Google Ativa</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {estabelecimento?.nome || 'Estabelecimento Parceiro'}
              </h1>
              <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                <Calendar size={14} />
                <span>Relatório referente a: <strong className="text-slate-200">{labelPeriodo}</strong></span>
              </p>
            </div>

            {estabelecimento?.link_google && (
              <a
                href={estabelecimento.link_google}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shadow-lg transition-all active:scale-95 shrink-0"
              >
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span>Ver Perfil no Google</span>
                <ExternalLink size={12} className="text-slate-400" />
              </a>
            )}
          </div>

          {/* Filtro de Período Rápido */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl mt-6 border border-slate-800 text-xs font-semibold w-full sm:w-auto">
            {(['7d', '30d', 'mes', 'tudo'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg transition-all ${
                  periodo === p
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === '7d' ? '7 Dias' : p === '30d' ? '30 Dias' : p === 'mes' ? 'Mês Atual' : 'Total'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
            <Loader2 size={32} className="animate-spin text-brand-500" />
            <span className="text-xs font-medium">Carregando métricas em tempo real...</span>
          </div>
        ) : (
          <>
            {/* Grid de KPIs Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Total de Toques */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                  <span>Clientes Conectados</span>
                  <Sparkles size={16} className="text-brand-400" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {stats.total}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Oportunidades diretas de avaliação geradas pela placa.
                </p>
              </div>

              {/* NFC vs QR */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                    <span>Tecnologia Utilizada</span>
                    <TrendingUp size={16} className="text-teal-400" />
                  </div>
                  <div className="space-y-2 mt-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-teal-400 flex items-center gap-1">
                          <NfcIcon size={12} /> Aproximação NFC
                        </span>
                        <span className="text-white">{stats.nfc} ({stats.nfcPercent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${stats.nfcPercent}%` }}
                          className="h-full bg-teal-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-sky-400 flex items-center gap-1">
                          <QrIcon size={12} /> Câmera QR Code
                        </span>
                        <span className="text-white">{stats.qr} ({stats.qrPercent}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          style={{ width: `${stats.qrPercent}%` }}
                          className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Horário de Maior Movimento */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
                    <span>Pico de Atendimento</span>
                    <Clock size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-300 mt-2 truncate">
                    {stats.horarioPico}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Dia preferido: <strong className="text-slate-200">{stats.diaPico}</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 mt-3">
                  Excelente momento para incentivar a equipe a lembrar os clientes da placa!
                </div>
              </div>
            </div>

            {/* Gráfico Visual Diário */}
            {stats.sortedDays.length > 0 && (
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Evolução dos Acessos Recentes</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Engajamento dos clientes por dia</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md">
                    Máx: {maxCountGraph} acessos
                  </span>
                </div>

                <div className="flex items-end gap-2.5 h-28 pt-4">
                  {stats.sortedDays.map((d, i) => {
                    const heightPercent = Math.max(Math.round((d.count / maxCountGraph) * 100), 12);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">
                          {d.count}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-gradient-to-t from-brand-600 to-indigo-500 rounded-t-lg transition-all group-hover:brightness-125"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">{d.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card Explicativo de Valor e SEO Local */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-brand-950/40 via-slate-900 to-slate-900 border border-brand-900/40 space-y-3">
              <div className="flex items-center gap-2 text-brand-400 text-xs font-bold">
                <Star size={14} className="fill-brand-400" />
                <span>Por que esse número importa para sua empresa?</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Quanto mais clientes tocam na placa e avaliam seu negócio, mais o algoritmo do Google Meu Negócio coloca você na frente dos concorrentes da sua cidade. Negócios com nota acima de 4.8 e avaliações frequentes recebem até <strong>3.5x mais ligações e visitas</strong> pelo Google Maps.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Footer com Selo VolpoTech */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 px-4 text-center text-xs text-slate-500 mt-12 space-y-3">
        <p>
          Tecnologia desenvolvida e operada por{' '}
          <strong className="text-slate-300 font-semibold">VolpoTech • Soluções Digitais</strong>
        </p>
        <div>
          <a
            href="https://wa.me/5514997424040?text=Ol%C3%A1%2C%20vi%20o%20painel%20do%20QR%20Avalia%20e%20gostaria%20de%20solicitar%20mais%20informa%C3%A7%C3%B5es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold"
          >
            <span>Precisa de mais placas ou de um site próprio? Fale conosco</span>
            <ChevronRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}

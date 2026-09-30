import { useEffect, useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  TrendingUp,
  Clock,
  Sparkles,
  QrCode as QrIcon,
  Nfc as NfcIcon,
  BarChart3,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

export type PeriodoRelatorio = '7d' | '30d' | 'mes' | 'tudo';

interface RelatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  estabelecimento: Estabelecimento | null;
}

interface ScanItem {
  id: string;
  created_at: string;
  tipo: string;
}

export default function RelatorioModal({ isOpen, onClose, estabelecimento }: RelatorioModalProps) {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('30d');
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [scansAnteriores, setScansAnteriores] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !estabelecimento) return;

    async function fetchScans() {
      setLoading(true);
      const now = new Date();
      let dataInicio: Date;
      let dataInicioAnterior: Date;
      let dataFimAnterior: Date;

      if (periodo === '7d') {
        dataInicio = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dataFimAnterior = new Date(dataInicio.getTime());
        dataInicioAnterior = new Date(dataInicio.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (periodo === '30d') {
        dataInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dataFimAnterior = new Date(dataInicio.getTime());
        dataInicioAnterior = new Date(dataInicio.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (periodo === 'mes') {
        dataInicio = new Date(now.getFullYear(), now.getMonth(), 1);
        dataFimAnterior = new Date(dataInicio.getTime());
        dataInicioAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      } else {
        dataInicio = new Date('2020-01-01');
        dataFimAnterior = new Date();
        dataInicioAnterior = new Date('2020-01-01');
      }

      // Busca período atual
      const { data: currentData } = await supabase
        .from('scans')
        .select('id, created_at, tipo')
        .eq('estabelecimento_id', estabelecimento!.id)
        .gte('created_at', dataInicio.toISOString())
        .order('created_at', { ascending: true });

      // Busca período anterior para cálculo de crescimento
      const { data: prevData } = await supabase
        .from('scans')
        .select('id, created_at, tipo')
        .eq('estabelecimento_id', estabelecimento!.id)
        .gte('created_at', dataInicioAnterior.toISOString())
        .lt('created_at', dataFimAnterior.toISOString());

      setScans((currentData ?? []) as ScanItem[]);
      setScansAnteriores((prevData ?? []) as ScanItem[]);
      setLoading(false);
    }

    fetchScans();
  }, [isOpen, estabelecimento, periodo]);

  // Cálculos do período
  const stats = useMemo(() => {
    const total = scans.length;
    const nfc = scans.filter((s) => s.tipo === 'nfc').length;
    const qr = scans.filter((s) => s.tipo === 'qr').length;

    const nfcPercent = total > 0 ? Math.round((nfc / total) * 100) : 0;
    const qrPercent = total > 0 ? Math.round((qr / total) * 100) : 0;

    // Crescimento percentual
    const totalAnterior = scansAnteriores.length;
    let crescimento: number | null = null;
    if (totalAnterior > 0) {
      crescimento = Math.round(((total - totalAnterior) / totalAnterior) * 100);
    } else if (total > 0) {
      crescimento = 100;
    }

    // Dia da semana com maior movimento
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

    const diaMaisMovimentado = total > 0 ? diasSemana[maxDia] : 'Em apuração';
    const horarioPico = total > 0 ? `${maxHora}h às ${maxHora + 2}h` : 'Em apuração';

    // Agrupamento dos últimos 7 dias com contagem diária para mini gráfico
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
      crescimento,
      diaMaisMovimentado,
      horarioPico,
      sortedDays,
    };
  }, [scans, scansAnteriores]);

  if (!isOpen || !estabelecimento) return null;

  const publicReportUrl = `${window.location.origin}/r/${estabelecimento.id}`;

  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date());
  const labelPeriodo =
    periodo === '7d'
      ? 'Últimos 7 dias'
      : periodo === '30d'
      ? 'Últimos 30 dias'
      : periodo === 'mes'
      ? `Mês de ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`
      : 'Todo o Período';

  // Mensagem formatada para o WhatsApp
  const mensagemWhatsApp = `📊 *Relatório de Desempenho — VolpoTech & ${estabelecimento.nome}*
📅 *Período:* ${labelPeriodo}

Olá! Aqui está o resumo de clientes que usaram sua placa de avaliações:

🚀 *${stats.total} clientes interagiram com a sua placa!*
• 📲 *${stats.nfc}* aproximações por NFC (${stats.nfcPercent}%)
• 📷 *${stats.qr}* leituras por QR Code (${stats.qrPercent}%)${
    stats.crescimento !== null
      ? `\n• 📈 *${stats.crescimento >= 0 ? '+' : ''}${stats.crescimento}%* em relação ao período anterior`
      : ''
  }

🕒 *Horário de pico:* ${stats.horarioPico}
📆 *Dia mais movimentado:* ${stats.diaMaisMovimentado}

⭐ *Impacto no Google Maps:*
Cada toque representa um cliente que teve a oportunidade direta de deixar 5 estrelas no seu negócio.

🌐 *Visualizar painel interativo com gráficos:*
${publicReportUrl}

_Dúvidas ou precisa de mais placas? Conte com a VolpoTech!_`;

  // Número do WhatsApp formatado
  const digitosZap = (estabelecimento.whatsapp || estabelecimento.telefone || '').replace(/\D/g, '');
  const zapFinal =
    digitosZap && (digitosZap.startsWith('55') && digitosZap.length >= 12 ? digitosZap : '55' + digitosZap);

  const zapUrl = zapFinal
    ? `https://wa.me/${zapFinal}?text=${encodeURIComponent(mensagemWhatsApp)}`
    : `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`;

  function handleCopyText() {
    navigator.clipboard.writeText(mensagemWhatsApp);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(publicReportUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const maxCountGraph = Math.max(...stats.sortedDays.map((d) => d.count), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 animate-slide-up sm:animate-scale-in max-h-[92vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        {/* Puxador mobile */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Relatório de Desempenho
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-[240px] sm:max-w-xs">
                {estabelecimento.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Seletor de Período */}
          <div className="flex items-center justify-between gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setPeriodo('7d')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                periodo === '7d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriodo('30d')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                periodo === '30d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setPeriodo('mes')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                periodo === 'mes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setPeriodo('tudo')}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                periodo === 'tudo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tudo
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 size={28} className="animate-spin text-brand-600" />
              <span className="text-xs">Calculando estatísticas...</span>
            </div>
          ) : (
            <>
              {/* Cards de Métricas Principais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] font-medium text-slate-500 block">Total de Toques</span>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
                  {stats.crescimento !== null && stats.total > 0 && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-0.5 mt-1 ${
                        stats.crescimento >= 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      <TrendingUp size={11} /> {stats.crescimento >= 0 ? '+' : ''}
                      {stats.crescimento}%
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80">
                  <span className="text-[11px] font-medium text-teal-700 flex items-center gap-1">
                    <NfcIcon size={12} /> NFC
                  </span>
                  <div className="text-xl font-bold text-teal-900 mt-0.5">{stats.nfc}</div>
                  <span className="text-[10px] text-teal-600 font-semibold">{stats.nfcPercent}% do total</span>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/80">
                  <span className="text-[11px] font-medium text-sky-700 flex items-center gap-1">
                    <QrIcon size={12} /> QR Code
                  </span>
                  <div className="text-xl font-bold text-sky-900 mt-0.5">{stats.qr}</div>
                  <span className="text-[10px] text-sky-600 font-semibold">{stats.qrPercent}% do total</span>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
                  <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                    <Clock size={12} /> Pico
                  </span>
                  <div className="text-xs font-bold text-amber-900 mt-1 truncate">{stats.horarioPico}</div>
                  <span className="text-[10px] text-amber-700 font-semibold">{stats.diaMaisMovimentado}</span>
                </div>
              </div>

              {/* Gráfico de Barras Simplificado dos últimos dias */}
              {stats.sortedDays.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Atividade recente (toques por dia)</span>
                    <span className="text-slate-400 font-mono text-[10px]">pico: {maxCountGraph}</span>
                  </div>
                  <div className="flex items-end gap-2 h-16 pt-2">
                    {stats.sortedDays.map((d, i) => {
                      const heightPercent = Math.max(Math.round((d.count / maxCountGraph) * 100), 15);
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <span className="text-[9px] font-bold text-slate-600">{d.count}</span>
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full bg-brand-500 rounded-t-md transition-all hover:bg-brand-600"
                          />
                          <span className="text-[9px] text-slate-400">{d.date}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pré-visualização da mensagem do WhatsApp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-emerald-600" />
                    Mensagem Pronta para o WhatsApp
                  </label>
                  <button
                    onClick={handleCopyText}
                    className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedText ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copiedText ? 'Copiado!' : 'Copiar texto'}
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed max-h-44 overflow-y-auto whitespace-pre-wrap select-all border border-slate-800">
                  {mensagemWhatsApp}
                </div>
              </div>

              {/* Link público */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="truncate mr-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Link do Card Público</span>
                  <span className="text-slate-700 font-mono truncate">{publicReportUrl}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary text-xs px-2.5 py-1.5 cursor-pointer"
                    title="Copiar link"
                  >
                    {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                  <a
                    href={publicReportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 text-brand-600"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            </>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <a
              href={zapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-3 text-sm font-bold flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-md active:scale-98 transition-all"
            >
              <Send size={16} />
              Enviar no WhatsApp do Gerente
            </a>
            <button
              onClick={handleCopyText}
              className="btn-secondary py-3 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedText ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copiedText ? 'Copiado!' : 'Copiar Relatório'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

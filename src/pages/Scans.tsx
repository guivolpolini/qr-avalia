import { useEffect, useState, useCallback } from 'react';
import {
  ScanLine,
  Search,
  Loader2,
  Calendar,
  Globe,
  QrCode as QrIcon,
  Nfc as NfcIcon,
  Clock,
  TrendingUp,
  Store,
  Smartphone,
  Monitor,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ScanRow {
  id: string;
  tipo: string;
  qr_code_id: string | null;
  nfc_tag_id: string | null;
  estabelecimento_id: string | null;
  user_agent: string;
  ip: string;
  created_at: string;
  qr_code?: { codigo: string } | null;
  nfc_tag?: { codigo: string } | null;
  estabelecimento?: { nome: string } | null;
}

type TipoFilter = 'todos' | 'qr' | 'nfc';
type PeriodoFilter = 'todos' | 'hoje' | '7dias' | 'mes';

interface EstOption {
  id: string;
  nome: string;
}

interface ScanMetrics {
  totalHoje: number;
  total7Dias: number;
  totalMes: number;
  totalGeral: number;
  totalQr: number;
  totalNfc: number;
  pctQr: number;
  pctNfc: number;
  topCliente: { nome: string; count: number } | null;
}

export default function Scans() {
  const [items, setItems] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<PeriodoFilter>('todos');
  const [selectedEst, setSelectedEst] = useState<string>('');
  const [estabelecimentos, setEstabelecimentos] = useState<EstOption[]>([]);
  const [metrics, setMetrics] = useState<ScanMetrics>({
    totalHoje: 0,
    total7Dias: 0,
    totalMes: 0,
    totalGeral: 0,
    totalQr: 0,
    totalNfc: 0,
    pctQr: 0,
    pctNfc: 0,
    topCliente: null,
  });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  // Carrega métricas globais ou por estabelecimento e lista de estabelecimentos
  const loadMetricsAndEsts = useCallback(async (estId?: string) => {
    try {
      let scansQuery = supabase.from('scans').select('id, tipo, created_at, estabelecimento_id, estabelecimento:estabelecimento_id(nome)');
      if (estId) {
        scansQuery = scansQuery.eq('estabelecimento_id', estId);
      }

      const [scansRes, estsRes] = await Promise.all([
        scansQuery,
        supabase.from('estabelecimentos').select('id, nome').order('nome'),
      ]);

      if (estsRes.data) {
        setEstabelecimentos(estsRes.data);
      }

      if (scansRes.data) {
        const all = scansRes.data as unknown as ScanRow[];
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const start7Days = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let hoje = 0;
        let d7 = 0;
        let mes = 0;
        let qr = 0;
        let nfc = 0;
        const clientCountMap: Record<string, number> = {};

        all.forEach((s) => {
          const t = new Date(s.created_at).getTime();
          if (t >= startToday) hoje++;
          if (t >= start7Days) d7++;
          if (t >= startMonth) mes++;
          if (s.tipo === 'qr') qr++;
          if (s.tipo === 'nfc') nfc++;

          if (s.estabelecimento?.nome) {
            clientCountMap[s.estabelecimento.nome] = (clientCountMap[s.estabelecimento.nome] || 0) + 1;
          }
        });

        let topCliente: { nome: string; count: number } | null = null;
        Object.entries(clientCountMap).forEach(([nome, count]) => {
          if (!topCliente || count > topCliente.count) {
            topCliente = { nome, count };
          }
        });

        const totalGeral = all.length;
        setMetrics({
          totalHoje: hoje,
          total7Dias: d7,
          totalMes: mes,
          totalGeral,
          totalQr: qr,
          totalNfc: nfc,
          pctQr: totalGeral > 0 ? Math.round((qr / totalGeral) * 100) : 0,
          pctNfc: totalGeral > 0 ? Math.round((nfc / totalGeral) * 100) : 0,
          topCliente,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar métricas de scans:', err);
    }
  }, []);

  useEffect(() => {
    loadMetricsAndEsts(selectedEst);
  }, [loadMetricsAndEsts, selectedEst]);

  // Carrega listagem paginada com filtros
  const load = useCallback(async () => {
    setLoading(true);
    const from = page * perPage;
    const to = from + perPage - 1;

    let countQuery = supabase.from('scans').select('*', { count: 'exact', head: true });
    let dataQuery = supabase
      .from('scans')
      .select('*, qr_code:qr_code_id(codigo), nfc_tag:nfc_tag_id(codigo), estabelecimento:estabelecimento_id(nome)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (tipoFilter !== 'todos') {
      countQuery = countQuery.eq('tipo', tipoFilter);
      dataQuery = dataQuery.eq('tipo', tipoFilter);
    }

    if (selectedEst) {
      countQuery = countQuery.eq('estabelecimento_id', selectedEst);
      dataQuery = dataQuery.eq('estabelecimento_id', selectedEst);
    }

    if (periodoFilter === 'hoje') {
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      countQuery = countQuery.gte('created_at', startToday.toISOString());
      dataQuery = dataQuery.gte('created_at', startToday.toISOString());
    } else if (periodoFilter === '7dias') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      countQuery = countQuery.gte('created_at', d7.toISOString());
      dataQuery = dataQuery.gte('created_at', d7.toISOString());
    } else if (periodoFilter === 'mes') {
      const startMonth = new Date();
      startMonth.setDate(1);
      startMonth.setHours(0, 0, 0, 0);
      countQuery = countQuery.gte('created_at', startMonth.toISOString());
      dataQuery = dataQuery.gte('created_at', startMonth.toISOString());
    }

    const { count } = await countQuery;
    const { data } = await dataQuery;

    setItems((data ?? []) as unknown as ScanRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, tipoFilter, selectedEst, periodoFilter]);

  useEffect(() => {
    setPage(0);
  }, [tipoFilter, selectedEst, periodoFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((s) => {
    const q = search.toLowerCase();
    const codigo = s.tipo === 'nfc' ? s.nfc_tag?.codigo : s.qr_code?.codigo;
    return (
      !search ||
      (codigo?.toLowerCase().includes(q) ?? false) ||
      (s.estabelecimento?.nome?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalPages = Math.ceil(total / perPage);
  const selectedEstNome = estabelecimentos.find((e) => e.id === selectedEst)?.nome;

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderDeviceBadge(ua: string) {
    if (!ua) return <span className="inline-flex items-center gap-1 text-slate-400 text-xs">—</span>;
    if (/iphone|ios|ipad/i.test(ua)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
          <Smartphone size={12} className="text-slate-600" />
          <span>iPhone (iOS)</span>
        </span>
      );
    }
    if (/android/i.test(ua)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          <Smartphone size={12} className="text-emerald-600" />
          <span>Android</span>
        </span>
      );
    }
    if (/mac|windows|linux|cros/i.test(ua)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80">
          <Monitor size={12} className="text-blue-600" />
          <span>Computador</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200/60">
        <Globe size={12} />
        <span>Navegador Web</span>
      </span>
    );
  }

  function getCodigo(s: ScanRow): string {
    if (s.tipo === 'nfc') return s.nfc_tag?.codigo ?? '—';
    return s.qr_code?.codigo ?? '—';
  }

  return (
    <div className="animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Histórico de Scans</h1>
          <p className="text-sm text-slate-500 mt-1">Métricas em tempo real de leituras de QR Codes e Tags NFC</p>
        </div>
        <div className="text-left sm:text-right bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-2xl font-extrabold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500 font-medium">
            {periodoFilter === 'hoje'
              ? '🔥 Scans hoje'
              : periodoFilter === '7dias'
              ? '📈 Scans em 7 dias'
              : periodoFilter === 'mes'
              ? '🗓️ Scans neste mês'
              : 'Scans totais registrados'}
          </p>
        </div>
      </div>

      {/* 1. Tópico 1: Mini-Dashboard de Métricas no Topo (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Card 1: Scans Hoje */}
        <div className="card p-4 bg-white border border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Scans Hoje</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{metrics.totalHoje}</span>
            <span className="text-xs text-slate-400 font-medium">leituras</span>
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-1">Registrados nas últimas 24h</p>
        </div>

        {/* Card 2: Últimos 7 dias */}
        <div className="card p-4 bg-white border border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Últimos 7 Dias</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{metrics.total7Dias}</span>
            <span className="text-xs text-slate-400 font-medium">leituras</span>
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-1">Volume semanal ativo</p>
        </div>

        {/* Card 3: Divisão QR vs NFC */}
        <div className="card p-4 bg-white border border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">QR vs NFC</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <QrIcon size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900">{metrics.totalQr}</span>
            <span className="text-xs text-slate-400 font-medium">QR /</span>
            <span className="text-xl font-black text-slate-900">{metrics.totalNfc}</span>
            <span className="text-xs text-slate-400 font-medium">NFC</span>
          </div>
          <p className="text-[11px] text-purple-600 font-medium mt-1">
            {metrics.pctQr}% QR Code • {metrics.pctNfc}% NFC
          </p>
        </div>

        {/* Card 4: Top Cliente */}
        <div className="card p-4 bg-white border border-slate-200/80 hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Estabelecimento</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Store size={15} />
            </div>
          </div>
          <div className="truncate">
            <span className="text-base font-bold text-slate-900 block truncate" title={metrics.topCliente?.nome || 'Nenhum'}>
              {metrics.topCliente?.nome || 'Sem dados'}
            </span>
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            {metrics.topCliente ? `${metrics.topCliente.count} leituras acumuladas` : 'Aguardando leituras'}
          </p>
        </div>
      </div>

      {/* Barra de Filtros: Pesquisa + Cliente Dropdown */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código de placa ou cliente..."
            className="input pl-10 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              title="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* 2. Tópico 2: Filtro Rápido por Cliente (Dropdown) */}
        <div className="sm:w-64">
          <select
            value={selectedEst}
            onChange={(e) => setSelectedEst(e.target.value)}
            className="input bg-white font-medium text-xs sm:text-sm"
          >
            <option value="">🏢 Todos os Clientes</option>
            {estabelecimentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Barra de Filtros: Período e Tipo de Tecnologia */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        {/* 3. Tópico 3: Filtro por Período */}
        <div className="inline-flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl text-xs flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase px-2 flex items-center gap-1">
            <Calendar size={12} />
            Período:
          </span>
          <button
            onClick={() => setPeriodoFilter('todos')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              periodoFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Todos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                periodoFilter === 'todos' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {metrics.totalGeral}
            </span>
          </button>
          <button
            onClick={() => setPeriodoFilter('hoje')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              periodoFilter === 'hoje' ? 'bg-amber-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Hoje</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                periodoFilter === 'hoje' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {metrics.totalHoje}
            </span>
          </button>
          <button
            onClick={() => setPeriodoFilter('7dias')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              periodoFilter === '7dias' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>7 Dias</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                periodoFilter === '7dias' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {metrics.total7Dias}
            </span>
          </button>
          <button
            onClick={() => setPeriodoFilter('mes')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
              periodoFilter === 'mes' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Este Mês</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                periodoFilter === 'mes' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
              }`}
            >
              {metrics.totalMes}
            </span>
          </button>
        </div>

        {/* Filtro por Tecnologia (QR vs NFC) */}
        <div className="inline-flex bg-slate-100 rounded-xl p-1 text-xs">
          {(['todos', 'qr', 'nfc'] as TipoFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                tipoFilter === t ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t === 'qr' && <QrIcon size={13} />}
              {t === 'nfc' && <NfcIcon size={13} />}
              {t === 'todos' ? 'Todos' : t === 'qr' ? 'QR Code' : 'NFC'}
            </button>
          ))}
        </div>
      </div>

      {/* Banner de Status e Contagem Dinâmica do Período */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-2xl border mb-5 text-sm transition-all shadow-xs ${
          periodoFilter === 'hoje'
            ? 'bg-amber-50/90 border-amber-200/90 text-amber-950'
            : periodoFilter === '7dias'
            ? 'bg-blue-50/90 border-blue-200/90 text-blue-950'
            : periodoFilter === 'mes'
            ? 'bg-purple-50/90 border-purple-200/90 text-purple-950'
            : 'bg-slate-50 border-slate-200/90 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-3 w-3 relative flex-shrink-0">
            {periodoFilter === 'hoje' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                periodoFilter === 'hoje'
                  ? 'bg-amber-500'
                  : periodoFilter === '7dias'
                  ? 'bg-blue-500'
                  : periodoFilter === 'mes'
                  ? 'bg-purple-500'
                  : 'bg-slate-400'
              }`}
            ></span>
          </span>
          <div>
            <span className="font-semibold text-slate-900">
              {periodoFilter === 'hoje' && (
                <>
                  Hoje teve{' '}
                  <span className="text-base font-black text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-lg border border-amber-300/60">
                    {total}
                  </span>{' '}
                  {total === 1 ? 'scan registrado' : 'scans registrados'}
                </>
              )}
              {periodoFilter === '7dias' && (
                <>
                  Últimos 7 dias tiveram{' '}
                  <span className="text-base font-black text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded-lg border border-blue-300/60">
                    {total}
                  </span>{' '}
                  {total === 1 ? 'scan registrado' : 'scans registrados'}
                </>
              )}
              {periodoFilter === 'mes' && (
                <>
                  Este mês teve{' '}
                  <span className="text-base font-black text-purple-900 bg-purple-100/90 px-2 py-0.5 rounded-lg border border-purple-300/60">
                    {total}
                  </span>{' '}
                  {total === 1 ? 'scan registrado' : 'scans registrados'}
                </>
              )}
              {periodoFilter === 'todos' && (
                <>
                  Total acumulado:{' '}
                  <span className="text-base font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-300/60">
                    {total}
                  </span>{' '}
                  {total === 1 ? 'scan registrado' : 'scans registrados'}
                </>
              )}
            </span>
            {selectedEstNome ? (
              <span className="text-xs text-slate-600 block sm:inline sm:ml-1.5 font-medium">
                — Estabelecimento:{' '}
                <strong className="text-slate-900 font-bold underline decoration-slate-300">
                  {selectedEstNome}
                </strong>
              </span>
            ) : (
              <span className="text-xs text-slate-500 block sm:inline sm:ml-1.5 font-medium">
                — em todos os clientes
              </span>
            )}
            {tipoFilter !== 'todos' && (
              <span className="inline-block text-[11px] uppercase font-bold px-1.5 py-0.5 ml-1.5 rounded bg-slate-200/80 text-slate-800">
                via {tipoFilter.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium sm:text-right shrink-0">
          {filtered.length} {filtered.length === 1 ? 'item exibido' : 'itens exibidos'}{' '}
          {totalPages > 1 && `(Pág ${page + 1}/${totalPages})`}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
            <ScanLine size={28} className="text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Nenhum scan encontrado</h3>
          <p className="text-sm text-slate-400">Tente ajustar os filtros de cliente ou período para ver mais resultados</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Tipo</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Placa / Código</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Estabelecimento</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Dispositivo</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Data e Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      {s.tipo === 'nfc' ? (
                        <span className="badge-blue"><NfcIcon size={12} /> NFC</span>
                      ) : (
                        <span className="badge-slate"><QrIcon size={12} /> QR</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                        {getCodigo(s)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Store size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{s.estabelecimento?.nome ?? 'Sem estabelecimento'}</span>
                      </div>
                    </td>
                    {/* 4. Tópico 4: Dispositivo com Ícone */}
                    <td className="px-4 py-3">{renderDeviceBadge(s.user_agent)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500 font-mono">
                      {formatDate(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {s.tipo === 'nfc' ? (
                      <span className="badge-blue"><NfcIcon size={12} /> NFC</span>
                    ) : (
                      <span className="badge-slate"><QrIcon size={12} /> QR</span>
                    )}
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                      {getCodigo(s)}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar size={12} /> {formatDate(s.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 my-1.5">
                  <Store size={14} className="text-slate-400 shrink-0" />
                  <p className="text-sm font-semibold text-slate-800">{s.estabelecimento?.nome ?? 'Sem estabelecimento'}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Dispositivo:</span>
                  {renderDeviceBadge(s.user_agent)}
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs sm:text-sm text-slate-500">
                Página {page + 1} de {totalPages} ({total} scans filtrados)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="btn-secondary text-xs sm:text-sm py-1.5 px-3"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary text-xs sm:text-sm py-1.5 px-3"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Store, QrCode, Nfc, ScanLine, TrendingUp, ArrowRight, Filter, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AreaTrendChart, { type DayData } from '@/components/charts/AreaTrendChart';
import TopRankingChart, { type RankingItem } from '@/components/charts/TopRankingChart';
import DistributionCards from '@/components/charts/DistributionCards';

interface Stats {
  totalEstabelecimentos: number;
  totalQrCodes: number;
  qrAtivos: number;
  totalNfcTags: number;
  totalScans: number;
}

interface ScanData {
  id: string;
  created_at: string;
  tipo: string;
  user_agent: string;
  estabelecimento_id: string | null;
  estabelecimento?: { nome: string } | null;
}

interface EstabelecimentoItem {
  id: string;
  nome: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanData[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<EstabelecimentoItem[]>([]);
  const [selectedEstabelecimento, setSelectedEstabelecimento] = useState<string>('todos');
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(14);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [est, qr, qrAtivos, nfc, sc, recentScans, estList] = await Promise.all([
        supabase.from('estabelecimentos').select('*', { count: 'exact', head: true }),
        supabase.from('qr_codes').select('*', { count: 'exact', head: true }),
        supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('nfc_tags').select('*', { count: 'exact', head: true }),
        supabase.from('scans').select('*', { count: 'exact', head: true }),
        supabase
          .from('scans')
          .select('id, created_at, tipo, user_agent, estabelecimento_id, estabelecimento:estabelecimento_id(nome)')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('estabelecimentos').select('id, nome').eq('ativo', true).order('nome'),
      ]);

      setStats({
        totalEstabelecimentos: est.count ?? 0,
        totalQrCodes: qr.count ?? 0,
        qrAtivos: qrAtivos.count ?? 0,
        totalNfcTags: nfc.count ?? 0,
        totalScans: sc.count ?? 0,
      });

      setScans((recentScans.data ?? []) as unknown as ScanData[]);
      setEstabelecimentos((estList.data ?? []) as EstabelecimentoItem[]);
      setLoading(false);
    }
    load();
  }, []);

  // Scans filtrados pelo estabelecimento selecionado
  const filteredScans = useMemo(() => {
    if (selectedEstabelecimento === 'todos') return scans;
    return scans.filter((s) => s.estabelecimento_id === selectedEstabelecimento);
  }, [scans, selectedEstabelecimento]);

  // Dados para o gráfico de evolução temporal (últimos N dias com quebra QR e NFC)
  const trendData = useMemo(() => {
    const list: DayData[] = [];
    const today = new Date();

    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      const dayScans = filteredScans.filter((s) => {
        if (!s.created_at) return false;
        const scanDate = new Date(s.created_at);
        const sIso = `${scanDate.getFullYear()}-${String(scanDate.getMonth() + 1).padStart(2, '0')}-${String(scanDate.getDate()).padStart(2, '0')}`;
        return sIso === isoDate;
      });

      const qr = dayScans.filter((s) => s.tipo !== 'nfc').length;
      const nfc = dayScans.filter((s) => s.tipo === 'nfc').length;

      list.push({
        date: isoDate,
        label,
        total: dayScans.length,
        qr,
        nfc,
      });
    }
    return list;
  }, [filteredScans, daysRange]);

  // Ranking de estabelecimentos com mais acessos
  const rankingData = useMemo(() => {
    const map = new Map<string, { nome: string; total: number }>();
    scans.forEach((s) => {
      const id = s.estabelecimento_id || 'sem_id';
      const nome = s.estabelecimento?.nome || 'Sem estabelecimento';
      const current = map.get(id) || { nome, total: 0 };
      current.total += 1;
      map.set(id, current);
    });

    const items: RankingItem[] = [];
    map.forEach((val, id) => {
      items.push({ id, nome: val.nome, total: val.total });
    });

    return items.sort((a, b) => b.total - a.total);
  }, [scans]);

  // Distribuição por tecnologia e sistema operacional
  const techDistribution = useMemo(() => {
    let totalQr = 0;
    let totalNfc = 0;
    let mobileIos = 0;
    let mobileAndroid = 0;
    let desktop = 0;
    let outros = 0;

    filteredScans.forEach((s) => {
      if (s.tipo === 'nfc') totalNfc++;
      else totalQr++;

      const ua = (s.user_agent || '').toLowerCase();
      if (/iphone|ipad|ios/.test(ua)) mobileIos++;
      else if (/android/.test(ua)) mobileAndroid++;
      else if (/windows|macintosh|mac os|linux/.test(ua)) desktop++;
      else outros++;
    });

    return {
      totalQr,
      totalNfc,
      dispositivos: { mobileIos, mobileAndroid, desktop, outros },
    };
  }, [filteredScans]);

  const selectedEstNome =
    selectedEstabelecimento === 'todos'
      ? null
      : estabelecimentos.find((e) => e.id === selectedEstabelecimento)?.nome;

  const totalScansFiltrados =
    selectedEstabelecimento === 'todos' ? stats?.totalScans : filteredScans.length;

  const cards = [
    { label: 'Estabelecimentos', value: stats?.totalEstabelecimentos, icon: Store, color: 'bg-brand-50 text-brand-600', to: '/estabelecimentos' },
    { label: 'QR Codes', value: stats?.totalQrCodes, icon: QrCode, color: 'bg-violet-50 text-violet-600', to: '/placas' },
    { label: 'Tags NFC', value: stats?.totalNfcTags, icon: Nfc, color: 'bg-teal-50 text-teal-600', to: '/placas' },
    { label: 'QR Codes Ativos', value: stats?.qrAtivos, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', to: '/placas' },
    {
      label: selectedEstabelecimento === 'todos' ? 'Total de Scans' : 'Scans do Local',
      value: totalScansFiltrados,
      icon: ScanLine,
      color: 'bg-amber-50 text-amber-600',
      to: '/scans',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Cabeçalho com Filtro de Estabelecimento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visão geral e métricas analíticas dos seus QR Codes e Tags NFC
          </p>
        </div>

        {/* Filtro por estabelecimento */}
        <div className="flex items-center gap-2">
          <div className="relative inline-flex items-center">
            <Filter size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <select
              value={selectedEstabelecimento}
              onChange={(e) => setSelectedEstabelecimento(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            >
              <option value="todos">Todos os Estabelecimentos</option>
              {estabelecimentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>

          {selectedEstabelecimento !== 'todos' && (
            <button
              onClick={() => setSelectedEstabelecimento('todos')}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              title="Limpar filtro"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Alerta de filtro ativo */}
      {selectedEstNome && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-brand-50/70 border border-brand-100 text-xs text-brand-900 animate-fade-in">
          <div className="flex items-center gap-2">
            <Store size={15} className="text-brand-600" />
            <span>
              Filtrando gráficos e dados analíticos para:{' '}
              <strong className="font-semibold text-brand-700">{selectedEstNome}</strong>
            </span>
          </div>
          <button
            onClick={() => setSelectedEstabelecimento('todos')}
            className="text-brand-600 hover:text-brand-800 font-semibold underline underline-offset-2"
          >
            Ver todos
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="card p-5 hover:shadow-card-hover hover:border-slate-300 transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`flex items-center justify-center w-11 h-11 rounded-lg ${card.color}`}>
                <card.icon size={22} />
              </div>
              <ArrowRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-slate-900 font-mono">
              {loading ? <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" /> : card.value}
            </p>
            <p className="text-sm text-slate-500 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Gráficos Analíticos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AreaTrendChart
            data={trendData}
            daysRange={daysRange}
            onRangeChange={(days) => setDaysRange(days)}
          />
        </div>
        <div className="lg:col-span-1">
          <TopRankingChart items={rankingData} />
        </div>
      </div>

      {/* Gráfico Donut QR vs NFC e Dispositivos */}
      <DistributionCards
        totalQr={techDistribution.totalQr}
        totalNfc={techDistribution.totalNfc}
        dispositivos={techDistribution.dispositivos}
      />
    </div>
  );
}

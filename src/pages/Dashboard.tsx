import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Store, QrCode, Nfc, ScanLine, TrendingUp, ArrowRight } from 'lucide-react';
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(14);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [est, qr, qrAtivos, nfc, sc, recentScans] = await Promise.all([
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
      ]);

      setStats({
        totalEstabelecimentos: est.count ?? 0,
        totalQrCodes: qr.count ?? 0,
        qrAtivos: qrAtivos.count ?? 0,
        totalNfcTags: nfc.count ?? 0,
        totalScans: sc.count ?? 0,
      });

      setScans((recentScans.data ?? []) as unknown as ScanData[]);
      setLoading(false);
    }
    load();
  }, []);

  // Dados para o gráfico de evolução temporal (últimos N dias)
  const trendData = useMemo(() => {
    const list: DayData[] = [];
    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = scans.filter((s) => s.created_at?.startsWith(isoDate)).length;
      list.push({ date: isoDate, label, total });
    }
    return list;
  }, [scans, daysRange]);

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

    scans.forEach((s) => {
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
  }, [scans]);

  const cards = [
    { label: 'Estabelecimentos', value: stats?.totalEstabelecimentos, icon: Store, color: 'bg-brand-50 text-brand-600', to: '/estabelecimentos' },
    { label: 'QR Codes', value: stats?.totalQrCodes, icon: QrCode, color: 'bg-violet-50 text-violet-600', to: '/placas' },
    { label: 'Tags NFC', value: stats?.totalNfcTags, icon: Nfc, color: 'bg-teal-50 text-teal-600', to: '/placas' },
    { label: 'QR Codes Ativos', value: stats?.qrAtivos, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', to: '/placas' },
    { label: 'Total de Scans', value: stats?.totalScans, icon: ScanLine, color: 'bg-amber-50 text-amber-600', to: '/scans' },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral e métricas analíticas dos seus QR Codes e Tags NFC</p>
      </div>

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
            <p className="text-3xl font-bold text-slate-900">
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

      {/* Distribuição e Dispositivos */}
      <DistributionCards
        totalQr={techDistribution.totalQr}
        totalNfc={techDistribution.totalNfc}
        dispositivos={techDistribution.dispositivos}
      />

      {/* Fluxo e Guia Rápido */}
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Como funciona</h2>
        <p className="text-sm text-slate-500 mb-5">O fluxo dos seus QR Codes e Tags NFC dinâmicos</p>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Imprima ou grave', desc: 'Gere QR Codes para imprimir nas placas ou Tags NFC para gravar no celular. Ambos apontam para URLs do sistema.' },
            { step: '2', title: 'Associe o estabelecimento', desc: 'No painel, vincule cada QR Code ou Tag NFC a um estabelecimento e seu link do Google.' },
            { step: '3', title: 'Troque quando quiser', desc: 'Altere a associação sem reimprimir ou regravar. O QR ou Tag física continua funcionando.' },
          ].map((s) => (
            <div key={s.step} className="relative p-4 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold mb-3">
                {s.step}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

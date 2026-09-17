import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, QrCode, Nfc, ScanLine, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  totalEstabelecimentos: number;
  totalQrCodes: number;
  qrAtivos: number;
  totalNfcTags: number;
  totalScans: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [est, qr, qrAtivos, nfc, sc] = await Promise.all([
        supabase.from('estabelecimentos').select('*', { count: 'exact', head: true }),
        supabase.from('qr_codes').select('*', { count: 'exact', head: true }),
        supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('nfc_tags').select('*', { count: 'exact', head: true }),
        supabase.from('scans').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalEstabelecimentos: est.count ?? 0,
        totalQrCodes: qr.count ?? 0,
        qrAtivos: qrAtivos.count ?? 0,
        totalNfcTags: nfc.count ?? 0,
        totalScans: sc.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: 'Estabelecimentos', value: stats?.totalEstabelecimentos, icon: Store, color: 'bg-brand-50 text-brand-600', to: '/estabelecimentos' },
    { label: 'QR Codes', value: stats?.totalQrCodes, icon: QrCode, color: 'bg-violet-50 text-violet-600', to: '/qr-codes' },
    { label: 'Tags NFC', value: stats?.totalNfcTags, icon: Nfc, color: 'bg-teal-50 text-teal-600', to: '/nfc-tags' },
    { label: 'QR Codes Ativos', value: stats?.qrAtivos, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', to: '/qr-codes' },
    { label: 'Total de Scans', value: stats?.totalScans, icon: ScanLine, color: 'bg-amber-50 text-amber-600', to: '/scans' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral do seu sistema de QR Codes e Tags NFC</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
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

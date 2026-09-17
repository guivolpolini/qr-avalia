import { useEffect, useState } from 'react';
import { ScanLine, Search, Loader2, Calendar, Globe, QrCode, Nfc } from 'lucide-react';
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

export default function Scans() {
  const [items, setItems] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const perPage = 25;

  useEffect(() => {
    setPage(0);
  }, [tipoFilter]);

  useEffect(() => {
    load();
  }, [page, tipoFilter]);

  async function load() {
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

    const { count } = await countQuery;
    const { data } = await dataQuery;

    setItems((data ?? []) as unknown as ScanRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  }

  const filtered = items.filter((s) => {
    const q = search.toLowerCase();
    const codigo = s.tipo === 'nfc' ? s.nfc_tag?.codigo : s.qr_code?.codigo;
    return (
      (codigo?.toLowerCase().includes(q) ?? false) ||
      (s.estabelecimento?.nome?.toLowerCase().includes(q) ?? false)
    );
  });

  const totalPages = Math.ceil(total / perPage);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function parseUA(ua: string): string {
    if (!ua) return 'Desconhecido';
    if (/iphone|ios/i.test(ua)) return 'iPhone';
    if (/android/i.test(ua)) return 'Android';
    if (/mac/i.test(ua)) return 'Mac';
    if (/windows/i.test(ua)) return 'Windows';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Outro';
  }

  function getCodigo(s: ScanRow): string {
    if (s.tipo === 'nfc') return s.nfc_tag?.codigo ?? '—';
    return s.qr_code?.codigo ?? '—';
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scans</h1>
          <p className="text-sm text-slate-500 mt-1">Histórico de acessos a QR Codes e Tags NFC</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-400">Total de scans</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por código ou estabelecimento..."
            className="input pl-10"
          />
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {(['todos', 'qr', 'nfc'] as TipoFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFilter(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tipoFilter === t ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {t === 'qr' && <QrCode size={14} />}
              {t === 'nfc' && <Nfc size={14} />}
              {t === 'todos' ? 'Todos' : t === 'qr' ? 'QR Code' : 'NFC'}
            </button>
          ))}
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
          <h3 className="font-semibold text-slate-700 mb-1">Nenhum scan registrado</h3>
          <p className="text-sm text-slate-400">Os acessos a QR Codes e Tags NFC aparecerão aqui</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Tipo</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Código</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Estabelecimento</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Dispositivo</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      {s.tipo === 'nfc' ? (
                        <span className="badge-blue"><Nfc size={12} /> NFC</span>
                      ) : (
                        <span className="badge-slate"><QrCode size={12} /> QR</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-slate-900">{getCodigo(s)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.estabelecimento?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{parseUA(s.user_agent)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.created_at)}</td>
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
                      <span className="badge-blue"><Nfc size={12} /> NFC</span>
                    ) : (
                      <span className="badge-slate"><QrCode size={12} /> QR</span>
                    )}
                    <span className="font-mono font-semibold text-slate-900">{getCodigo(s)}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12} /> {formatDate(s.created_at)}</span>
                </div>
                <p className="text-sm text-slate-600">{s.estabelecimento?.nome ?? 'Sem estabelecimento'}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Globe size={12} /> {parseUA(s.user_agent)}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Página {page + 1} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-secondary text-sm py-2">
                  Anterior
                </button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="btn-secondary text-sm py-2">
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

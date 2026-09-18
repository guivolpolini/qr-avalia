import { useEffect, useState } from 'react';
import { Plus, Nfc as NfcIcon, Link2, Unlink, X, Loader2, Search, Copy, Check, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

interface NfcTag {
  id: string;
  codigo: string;
  estabelecimento_id: string | null;
  url_dinamica: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  estabelecimento: { nome: string } | null;
  scan_count?: number;
}

type StatusFilter = 'todos' | 'disponivel' | 'associada' | 'desativada';

export default function NfcTags() {
  const [items, setItems] = useState<NfcTag[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [showAssoc, setShowAssoc] = useState<NfcTag | null>(null);
  const [selectedEst, setSelectedEst] = useState<string>('');
  const [assocSaving, setAssocSaving] = useState(false);
  const [showScans, setShowScans] = useState<NfcTag | null>(null);
  const [scans, setScans] = useState<{ created_at: string; user_agent: string }[]>([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  useEffect(() => {
    load();
    loadEstabelecimentos();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('nfc_tags')
      .select('*, estabelecimento:estabelecimento_id(nome)')
      .order('created_at', { ascending: false }) .order('codigo', { ascending: true });

    if (error) {
      console.error('Erro ao carregar NFC tags:', error.message);
      setItems([]);
    } else {
      // Load scan counts
      const tags = data as unknown as NfcTag[];
      const counts: Record<string, number> = {};
      await Promise.all(
        tags.map(async (tag) => {
          const { count } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true })
            .eq('nfc_tag_id', tag.id)
            .eq('tipo', 'nfc');
          counts[tag.id] = count ?? 0;
        })
      );
      setItems(tags.map((t) => ({ ...t, scan_count: counts[t.id] ?? 0 })));
    }
    setLoading(false);
  }

  async function loadEstabelecimentos() {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('ativo', true).order('nome');
    setEstabelecimentos(data ?? []);
  }

  async function handleCreate() {
    setCreating(true);
    // Usa o maior número já usado (não a contagem de linhas), senão excluir
    // uma Tag no meio da sequência faz o próximo lote colidir com um código existente.
    const { data: last } = await supabase
      .from('nfc_tags')
      .select('codigo')
      .order('codigo', { ascending: false })
      .limit(1);
    const lastNum = last?.[0]?.codigo ? parseInt(last[0].codigo.replace(/\D/g, ''), 10) : 0;
    const startNum = (Number.isFinite(lastNum) ? lastNum : 0) + 1;
    const rows = [];
    for (let i = 0; i < batchCount; i++) {
      const num = startNum + i;
      const codigo = `NFC${String(num).padStart(3, '0')}`;
      rows.push({ codigo, url_dinamica: `${baseUrl}/n/${codigo}`, ativo: true });
    }
    const { error } = await supabase.from('nfc_tags').insert(rows);
    setCreating(false);
    if (error) { alert(error.message); return; }
    setShowCreate(false);
    load();
  }

  async function toggleAtivo(tag: NfcTag) {
    await supabase.from('nfc_tags').update({ ativo: !tag.ativo }).eq('id', tag.id);
    load();
  }

  async function desassociar(tag: NfcTag) {
    await supabase.from('nfc_tags').update({ estabelecimento_id: null }).eq('id', tag.id);
    load();
  }

  async function handleDelete(tag: NfcTag) {
    if (!confirm(`Tem certeza que deseja excluir a Tag NFC ${tag.codigo}?`)) return;
    const { error } = await supabase.from('nfc_tags').delete().eq('id', tag.id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function saveAssociacao() {
    if (!showAssoc) return;
    setAssocSaving(true);
    const { error } = await supabase
      .from('nfc_tags')
      .update({ estabelecimento_id: selectedEst || null })
      .eq('id', showAssoc.id);
    setAssocSaving(false);
    if (error) { alert(error.message); return; }
    setShowAssoc(null);
    setSelectedEst('');
    load();
  }

  function openAssoc(tag: NfcTag) {
    setShowAssoc(tag);
    setSelectedEst(tag.estabelecimento_id ?? '');
  }

  function copyUrl(tag: NfcTag) {
    navigator.clipboard.writeText(`${baseUrl}/n/${tag.codigo}`);
    setCopiedId(tag.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function openScans(tag: NfcTag) {
    setShowScans(tag);
    setScansLoading(true);
    const { data } = await supabase
      .from('scans')
      .select('created_at, user_agent')
      .eq('nfc_tag_id', tag.id)
      .eq('tipo', 'nfc')
      .order('created_at', { ascending: false })
      .limit(50);
    setScans(data ?? []);
    setScansLoading(false);
  }

  function getStatus(tag: NfcTag): 'disponivel' | 'associada' | 'desativada' {
    if (!tag.ativo) return 'desativada';
    if (tag.estabelecimento_id) return 'associada';
    return 'disponivel';
  }

  const statusStyles: Record<string, string> = {
    disponivel: 'badge-blue',
    associada: 'badge-green',
    desativada: 'badge-red',
  };

  const statusLabels: Record<string, string> = {
    disponivel: 'Disponível',
    associada: 'Associada',
    desativada: 'Desativada',
  };

  const filtered = items.filter((tag) => {
    const q = search.toLowerCase();
    const matchesSearch =
      tag.codigo.toLowerCase().includes(q) ||
      (tag.estabelecimento?.nome?.toLowerCase().includes(q) ?? false);
    const status = getStatus(tag);
    const matchesStatus = statusFilter === 'todos' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tags NFC</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas Tags NFC dinâmicas</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} />
          Gerar Tags
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código ou estabelecimento..."
            className="input pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="input sm:w-48">
          <option value="todos">Todos os status</option>
          <option value="disponivel">Disponíveis</option>
          <option value="associada">Associadas</option>
          <option value="desativada">Desativadas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
            <NfcIcon size={28} className="text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Nenhuma Tag NFC</h3>
          <p className="text-sm text-slate-400 mb-4">Gere suas primeiras Tags NFC para gravação</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={18} />
            Gerar Tags
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Código</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Estabelecimento</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-center font-semibold text-slate-600 px-4 py-3">Scans</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tag) => {
                  const status = getStatus(tag);
                  return (
                    <tr key={tag.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-900">{tag.codigo}</span>
                      </td>
                      <td className="px-4 py-3">
                        {tag.estabelecimento?.nome ? (
                          <span className="font-medium text-slate-700">{tag.estabelecimento.nome}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusStyles[status]}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            status === 'associada' ? 'bg-emerald-500' :
                            status === 'disponivel' ? 'bg-brand-500' : 'bg-red-500'
                          }`} />
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openScans(tag)} className="text-slate-600 hover:text-brand-600 font-medium">
                          {tag.scan_count ?? 0}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openAssoc(tag)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Associar">
                            <Link2 size={16} />
                          </button>
                          <button onClick={() => copyUrl(tag)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Copiar URL">
                            {copiedId === tag.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                          </button>
                          <button onClick={() => toggleAtivo(tag)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Ativar/Desativar">
                            {tag.ativo ? <Eye size={16} /> : <Eye size={16} className="opacity-40" />}
                          </button>
                          <button onClick={() => handleDelete(tag)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map((tag) => {
              const status = getStatus(tag);
              return (
                <div key={tag.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-semibold text-slate-900">{tag.codigo}</span>
                    <span className={statusStyles[status]}>{statusLabels[status]}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">
                    {tag.estabelecimento?.nome ?? 'Sem estabelecimento'}
                  </p>
                  <div className="flex items-center justify-between">
                    <button onClick={() => openScans(tag)} className="text-xs text-brand-600 font-medium">
                      {tag.scan_count ?? 0} scans
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => openAssoc(tag)} className="p-2 text-slate-400 hover:text-brand-600 rounded-lg">
                        <Link2 size={16} />
                      </button>
                      <button onClick={() => copyUrl(tag)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                        {copiedId === tag.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      </button>
                      <button onClick={() => toggleAtivo(tag)} className="p-2 text-slate-400 hover:text-amber-500 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDelete(tag)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Gerar Tags NFC">
          <p className="text-sm text-slate-500 mb-4">
            Gere Tags NFC com identificadores sequenciais automáticos (NFC001, NFC002, ...). Cada Tag recebe uma URL única para gravação física. A gravação na Tag é feita externamente por celular/app NFC.
          </p>
          <div className="mb-5">
            <label className="label">Quantidade</label>
            <input type="number" min={1} max={500} value={batchCount} onChange={(e) => setBatchCount(Math.max(1, Math.min(500, Number(e.target.value))))} className="input" />
            <p className="text-xs text-slate-400 mt-1.5">
              Serão geradas de NFC{String((items.length) + 1).padStart(3, '0')} a NFC{String((items.length) + batchCount).padStart(3, '0')}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1">
              {creating ? <Loader2 size={18} className="animate-spin" /> : 'Gerar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Associate modal */}
      {showAssoc && (
        <Modal onClose={() => { setShowAssoc(null); setSelectedEst(''); }} title={`Associar ${showAssoc.codigo}`}>
          <p className="text-sm text-slate-500 mb-4">
            Selecione o estabelecimento que esta Tag NFC deve redirecionar.
          </p>
          {estabelecimentos.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 text-amber-700 text-sm mb-4">
              Nenhum estabelecimento ativo. Cadastre um estabelecimento primeiro.
            </div>
          ) : (
            <div className="mb-5">
              <label className="label">Estabelecimento</label>
              <select value={selectedEst} onChange={(e) => setSelectedEst(e.target.value)} className="input">
                <option value="">— Sem associação —</option>
                {estabelecimentos.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setShowAssoc(null); setSelectedEst(''); }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveAssociacao} disabled={assocSaving || estabelecimentos.length === 0} className="btn-primary flex-1">
              {assocSaving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Scans modal */}
      {showScans && (
        <Modal onClose={() => setShowScans(null)} title={`Scans — ${showScans.codigo}`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {showScans.estabelecimento?.nome ?? 'Sem estabelecimento associado'}
            </p>
            <span className="badge-slate">{showScans.scan_count ?? 0} total</span>
          </div>
          {scansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-slate-300" />
            </div>
          ) : scans.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">Nenhum scan registrado</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {scans.map((s, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatDate(s.created_at)}</span>
                  <span className="text-xs text-slate-400">{s.user_agent?.slice(0, 40) || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

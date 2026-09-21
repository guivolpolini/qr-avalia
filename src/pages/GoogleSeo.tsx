import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, X, Search, ExternalLink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento, GoogleSeoStatus } from '@/types/database';

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: 'perfil_criado', label: 'Perfil do Google Business criado' },
  { key: 'endereco_verificado', label: 'Endereço verificado' },
  { key: 'horario_preenchido', label: 'Horário de funcionamento preenchido' },
  { key: 'categoria_correta', label: 'Categoria correta selecionada' },
  { key: 'fotos_adicionadas', label: 'Fotos adicionadas' },
  { key: 'descricao_otimizada', label: 'Descrição otimizada com palavras-chave' },
  { key: 'link_avaliacoes', label: 'Link de avaliações configurado' },
  { key: 'respostas_avaliacoes', label: 'Respostas a avaliações configuradas' },
  { key: 'posts_ativos', label: 'Posts do Google Business ativos' },
  { key: 'maps_embedado', label: 'Google Maps embedado no site' },
];

const emptyChecklist = () =>
  CHECKLIST_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as Record<string, boolean>);

const emptyForm = {
  estabelecimento_id: '',
  url_google_business: '',
  url_google_maps: '',
  url_avaliacoes: '',
  checklist: emptyChecklist(),
  observacoes: '',
};

function progresso(checklist: Record<string, boolean>) {
  const total = CHECKLIST_ITEMS.length;
  const feitos = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 };
}

export default function GoogleSeo() {
  const [items, setItems] = useState<GoogleSeoStatus[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GoogleSeoStatus | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [statusRes, estRes] = await Promise.all([
      supabase
        .from('google_seo_status')
        .select('*, estabelecimento:estabelecimentos(id, nome)')
        .order('updated_at', { ascending: false }),
      supabase.from('estabelecimentos').select('*').order('nome'),
    ]);
    if (statusRes.error) {
      setError(statusRes.error.message);
    } else {
      setItems(statusRes.data ?? []);
    }
    setEstabelecimentos(estRes.data ?? []);
    setLoading(false);
  }

  const estabelecimentosSemRegistro = useMemo(
    () => estabelecimentos.filter((e) => !items.some((i) => i.estabelecimento_id === e.id)),
    [estabelecimentos, items]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(i: GoogleSeoStatus) {
    setEditing(i);
    setForm({
      estabelecimento_id: i.estabelecimento_id,
      url_google_business: i.url_google_business ?? '',
      url_google_maps: i.url_google_maps ?? '',
      url_avaliacoes: i.url_avaliacoes ?? '',
      checklist: { ...emptyChecklist(), ...i.checklist },
      observacoes: i.observacoes ?? '',
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editing) {
      const { error } = await supabase.from('google_seo_status').update(form).eq('id', editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('google_seo_status').insert(form);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setShowModal(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    const { error } = await supabase.from('google_seo_status').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  const filtered = items
    .filter((i) => (i.estabelecimento?.nome ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter((i) => !onlyPending || progresso(i.checklist).pct < 100)
    .sort((a, b) => progresso(a.checklist).pct - progresso(b.checklist).pct);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Google / SEO Local</h1>
          <p className="text-sm text-slate-500 mt-1">Links e checklist de otimização por estabelecimento</p>
        </div>
        <button onClick={openCreate} disabled={estabelecimentosSemRegistro.length === 0 && estabelecimentos.length === 0} className="btn-primary">
          <Plus size={18} />
          Novo registro
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por estabelecimento..."
            className="input pl-10"
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
          />
          Mostrar só quem precisa de atenção
        </label>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-slate-400 text-sm">
          {items.length === 0
            ? 'Nenhum registro ainda. Clique em "Novo registro" para começar a acompanhar um cliente.'
            : 'Nenhum resultado para os filtros aplicados.'}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((i) => {
            const { feitos, total, pct } = progresso(i.checklist);
            const precisaAtencao = pct < 100;
            return (
              <div key={i.id} className="card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {precisaAtencao ? (
                        <AlertCircle size={16} className="text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      )}
                      <h3 className="font-semibold text-slate-900 truncate">
                        {i.estabelecimento?.nome ?? 'Estabelecimento removido'}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {i.url_google_business && (
                        <a href={i.url_google_business} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand-600">
                          Google Business <ExternalLink size={11} />
                        </a>
                      )}
                      {i.url_google_maps && (
                        <a href={i.url_google_maps} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand-600">
                          Google Maps <ExternalLink size={11} />
                        </a>
                      )}
                      {i.url_avaliacoes && (
                        <a href={i.url_avaliacoes} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand-600">
                          Avaliações <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-48">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{feitos}/{total}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(i)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(i.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-lg p-6 animate-scale-in my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar registro' : 'Novo registro'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Cliente *</label>
                <select
                  required
                  disabled={!!editing}
                  value={form.estabelecimento_id}
                  onChange={(e) => setForm({ ...form, estabelecimento_id: e.target.value })}
                  className="input disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione...</option>
                  {(editing ? estabelecimentos : estabelecimentosSemRegistro).map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
                {!editing && estabelecimentosSemRegistro.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Todos os estabelecimentos já têm um registro. Edite um existente na lista.</p>
                )}
              </div>

              <div>
                <label className="label">URL Google Business</label>
                <input type="url" value={form.url_google_business} onChange={(e) => setForm({ ...form, url_google_business: e.target.value })} className="input" placeholder="https://..." />
              </div>
              <div>
                <label className="label">URL Google Maps</label>
                <input type="url" value={form.url_google_maps} onChange={(e) => setForm({ ...form, url_google_maps: e.target.value })} className="input" placeholder="https://..." />
              </div>
              <div>
                <label className="label">URL de avaliações</label>
                <input type="url" value={form.url_avaliacoes} onChange={(e) => setForm({ ...form, url_avaliacoes: e.target.value })} className="input" placeholder="https://..." />
              </div>

              <div>
                <label className="label mb-2 block">Checklist de otimização</label>
                <div className="space-y-2">
                  {CHECKLIST_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.checklist[item.key]}
                        onChange={(e) => setForm({ ...form, checklist: { ...form.checklist, [item.key]: e.target.checked } })}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200"
                      />
                      <span className="text-sm text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Observações</label>
                <textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="input min-h-20" placeholder="Anotações sobre o andamento..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving || !form.estabelecimento_id} className="btn-primary flex-1">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : editing ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

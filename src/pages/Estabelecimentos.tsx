import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Store, X, Search, Phone, MapPin, ExternalLink, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

const emptyForm = {
  nome: '', link_google: '', telefone: '', endereco: '', ativo: true,
  tipo_negocio: '', descricao: '', cardapio: '', cor_marca: '', whatsapp: '', instagram: '', site_com_admin: false,
};

function gerarPromptSite(e: Estabelecimento): string {
  const l: string[] = [];
  const paginas = ['Início', 'Sobre', e.cardapio ? 'Cardápio/Produtos' : null, 'Contato'].filter(Boolean).join(', ');
  l.push(`Site para "${e.nome}"${e.tipo_negocio ? ` (${e.tipo_negocio})` : ''}. Páginas: ${paginas}.`);
  if (e.descricao) l.push(e.descricao);
  if (e.cardapio) l.push(`Cardápio:\n${e.cardapio}`);

  const digitos = (e.whatsapp || '').replace(/\D/g, '');
  const zap = digitos && (digitos.startsWith('55') && digitos.length >= 12 ? digitos : '55' + digitos);

  const contato: string[] = [];
  if (e.endereco) contato.push(`Endereço: ${e.endereco}`);
  if (e.telefone) contato.push(`Tel: ${e.telefone}`);
  if (zap) contato.push(`WhatsApp: https://wa.me/${zap}`);
  if (e.instagram) contato.push(`Instagram: ${e.instagram}`);
  if (e.link_google) contato.push(`Botão "Avaliar no Google" → ${e.link_google}`);
  if (contato.length) l.push(`Contato:\n${contato.join('\n')}`);

  l.push(e.cor_marca ? `Cor principal: ${e.cor_marca}.` : 'Cores neutras combinando com o tipo de negócio.');
  l.push('Design moderno, responsivo, mobile-first. Use só os dados fornecidos; não invente informações.');

  if (e.site_com_admin) {
    l.push('Incluir painel admin com login (rota /admin) para editar cardápio, textos e contato sem mexer no código.');
  }

  return l.join('\n');
}

export default function Estabelecimentos() {
  const [items, setItems] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Estabelecimento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [promptFor, setPromptFor] = useState<Estabelecimento | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('estabelecimentos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function openEdit(e: Estabelecimento) {
    setEditing(e);
    setForm({
      nome: e.nome, link_google: e.link_google, telefone: e.telefone, endereco: e.endereco, ativo: e.ativo,
      tipo_negocio: e.tipo_negocio ?? '', descricao: e.descricao ?? '', cardapio: e.cardapio ?? '',
      cor_marca: e.cor_marca ?? '', whatsapp: e.whatsapp ?? '', instagram: e.instagram ?? '',
      site_com_admin: e.site_com_admin ?? false,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editing) {
      const { error } = await supabase.from('estabelecimentos').update(form).eq('id', editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('estabelecimentos').insert(form);
      if (error) { setError(error.message); setSaving(false); return; }
    }

    setShowModal(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este estabelecimento?')) return;
    const { error } = await supabase.from('estabelecimentos').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function toggleAtivo(e: Estabelecimento) {
    await supabase.from('estabelecimentos').update({ ativo: !e.ativo }).eq('id', e.id);
    load();
  }

  function openPrompt(e: Estabelecimento) {
    setPromptFor(e);
    setCopied(false);
  }

  async function copyPrompt() {
    if (!promptFor) return;
    try {
      await navigator.clipboard.writeText(gerarPromptSite(promptFor));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  }

  const filtered = items.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    e.telefone.includes(search) ||
    e.endereco.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estabelecimentos</h1>
          <p className="text-sm text-slate-500 mt-1">Cadastre e gerencie seus clientes</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          Novo
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou endereço..."
          className="input pl-10 max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
            <Store size={28} className="text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Nenhum estabelecimento</h3>
          <p className="text-sm text-slate-400 mb-4">Comece cadastrando seu primeiro cliente</p>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={18} />
            Cadastrar
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Nome</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Telefone</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Endereço</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{e.nome}</div>
                      <a href={e.link_google} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                        Link do Google <ExternalLink size={11} />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.telefone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.endereco || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAtivo(e)} className={e.ativo ? 'badge-green' : 'badge-red'}>
                        <span className={`w-1.5 h-1.5 rounded-full ${e.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {e.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openPrompt(e)} title="Gerar prompt do site" className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Sparkles size={16} />
                        </button>
                        <button onClick={() => openEdit(e)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{e.nome}</h3>
                    <a href={e.link_google} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 flex items-center gap-1 mt-0.5">
                      Link do Google <ExternalLink size={11} />
                    </a>
                  </div>
                  <span className={e.ativo ? 'badge-green' : 'badge-red'}>
                    {e.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {e.telefone && <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-1"><Phone size={13} /> {e.telefone}</p>}
                {e.endereco && <p className="text-sm text-slate-500 flex items-center gap-1.5"><MapPin size={13} /> {e.endereco}</p>}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button onClick={() => openPrompt(e)} className="btn-secondary flex-1 text-xs"><Sparkles size={14} /> Prompt do site</button>
                  <button onClick={() => openEdit(e)} className="btn-secondary flex-1 text-xs"><Pencil size={14} /> Editar</button>
                  <button onClick={() => handleDelete(e.id)} className="btn-secondary text-red-500 text-xs"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="card w-full max-w-lg p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome do estabelecimento *</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" placeholder="Ex: Ótica G&G" />
              </div>
              <div>
                <label className="label">Link de avaliação do Google *</label>
                <input required type="url" value={form.link_google} onChange={(e) => setForm({ ...form, link_google: e.target.value })} className="input" placeholder="https://g.page/r/..." />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefone</label>
                  <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="input" placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="label">Endereço</label>
                  <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className="input" placeholder="Rua, número, cidade" />
                </div>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200" />
                <span className="text-sm font-medium text-slate-700">Estabelecimento ativo</span>
              </label>

              <details className="pt-1">
                <summary className="text-sm font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand-500" /> Dados para gerar prompt de site (opcional)
                </summary>
                <div className="space-y-4 mt-3">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Tipo de negócio</label>
                      <input value={form.tipo_negocio} onChange={(e) => setForm({ ...form, tipo_negocio: e.target.value })} className="input" placeholder="Ex: pizzaria, ótica, salão" />
                    </div>
                    <div>
                      <label className="label">Cor da marca</label>
                      <input value={form.cor_marca} onChange={(e) => setForm({ ...form, cor_marca: e.target.value })} className="input" placeholder="Ex: vermelho e branco" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Descrição do negócio</label>
                    <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input min-h-20" placeholder="Poucas frases sobre o que o negócio faz e o diferencial dele" />
                  </div>
                  <div>
                    <label className="label">Cardápio / produtos</label>
                    <textarea value={form.cardapio} onChange={(e) => setForm({ ...form, cardapio: e.target.value })} className="input min-h-20" placeholder={'Um item por linha, ex:\nPizza Margherita - R$ 45\nPizza Calabresa - R$ 48'} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">WhatsApp</label>
                      <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input" placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                      <label className="label">Instagram</label>
                      <input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} className="input" placeholder="@seunegocio" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={form.site_com_admin} onChange={(e) => setForm({ ...form, site_com_admin: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-200" />
                    <span className="text-sm font-medium text-slate-700">Este site vai ter painel de administrador</span>
                  </label>
                </div>
              </details>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : editing ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prompt do site */}
      {promptFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setPromptFor(null)}>
          <div className="card w-full max-w-xl p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={18} className="text-brand-500" /> Prompt do site — {promptFor.nome}
              </h2>
              <button onClick={() => setPromptFor(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              Copie e cole no Lovable, Base44 ou ferramenta parecida para gerar o site.
            </p>
            <textarea
              readOnly
              value={gerarPromptSite(promptFor)}
              className="input min-h-64 font-mono text-xs leading-relaxed"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button onClick={copyPrompt} className="btn-primary w-full mt-4">
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copiado!' : 'Copiar prompt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

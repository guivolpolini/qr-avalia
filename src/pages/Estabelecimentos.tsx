import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  X,
  Search,
  Phone,
  MapPin,
  ExternalLink,
  Loader2,
  Sparkles,
  Copy,
  Check,
  BarChart3,
  ShieldCheck,
  QrCode as QrIcon,
  ScanLine,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';
import GoogleReviewGeneratorModal from '@/components/GoogleReviewGeneratorModal';
import RelatorioModal from '@/components/RelatorioModal';

const emptyForm = {
  nome: '', link_google: '', telefone: '', endereco: '', ativo: true,
  tipo_negocio: '', descricao: '', cardapio: '', cor_marca: '', whatsapp: '', instagram: '',
  site_com_admin: false, filtro_estrelas_ativo: false, email_notificacao: '',
  canal_queixas: 'ambos' as 'ambos' | 'email' | 'whatsapp',
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

interface EstStats {
  qrCodes: string[];
  nfcTags: string[];
  totalPlacas: number;
  totalScans: number;
}

export default function Estabelecimentos() {
  const [items, setItems] = useState<Estabelecimento[]>([]);
  const [stats, setStats] = useState<Record<string, EstStats>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLinkGenerator, setShowLinkGenerator] = useState(false);
  const [reportEst, setReportEst] = useState<Estabelecimento | null>(null);
  const [editing, setEditing] = useState<Estabelecimento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [promptFor, setPromptFor] = useState<Estabelecimento | null>(null);
  const [copied, setCopied] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [estRes, qrRes, nfcRes, scansRes] = await Promise.all([
      supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false }),
      supabase.from('qr_codes').select('id, codigo, estabelecimento_id'),
      supabase.from('nfc_tags').select('id, codigo, estabelecimento_id'),
      supabase.from('scans').select('id, estabelecimento_id'),
    ]);

    if (estRes.error) {
      setError(estRes.error.message);
    } else {
      setItems(estRes.data ?? []);
    }

    const newStats: Record<string, EstStats> = {};
    (qrRes.data || []).forEach((q) => {
      if (!q.estabelecimento_id) return;
      if (!newStats[q.estabelecimento_id]) {
        newStats[q.estabelecimento_id] = { qrCodes: [], nfcTags: [], totalPlacas: 0, totalScans: 0 };
      }
      newStats[q.estabelecimento_id].qrCodes.push(q.codigo);
    });

    (nfcRes.data || []).forEach((n) => {
      if (!n.estabelecimento_id) return;
      if (!newStats[n.estabelecimento_id]) {
        newStats[n.estabelecimento_id] = { qrCodes: [], nfcTags: [], totalPlacas: 0, totalScans: 0 };
      }
      newStats[n.estabelecimento_id].nfcTags.push(n.codigo);
    });

    (scansRes.data || []).forEach((s) => {
      if (!s.estabelecimento_id) return;
      if (!newStats[s.estabelecimento_id]) {
        newStats[s.estabelecimento_id] = { qrCodes: [], nfcTags: [], totalPlacas: 0, totalScans: 0 };
      }
      newStats[s.estabelecimento_id].totalScans += 1;
    });

    Object.values(newStats).forEach((s) => {
      s.totalPlacas = s.qrCodes.length + s.nfcTags.length;
    });

    setStats(newStats);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openCreate();
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  function openEdit(e: Estabelecimento) {
    setEditing(e);
    setForm({
      nome: e.nome, link_google: e.link_google, telefone: e.telefone, endereco: e.endereco, ativo: e.ativo,
      tipo_negocio: e.tipo_negocio ?? '', descricao: e.descricao ?? '', cardapio: e.cardapio ?? '',
      cor_marca: e.cor_marca ?? '', whatsapp: e.whatsapp ?? '', instagram: e.instagram ?? '',
      site_com_admin: e.site_com_admin ?? false,
      filtro_estrelas_ativo: e.filtro_estrelas_ativo ?? false,
      email_notificacao: e.email_notificacao ?? '',
      canal_queixas: (e.canal_queixas as 'ambos' | 'email' | 'whatsapp') ?? 'ambos',
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editing) {
        const { error } = await supabase.from('estabelecimentos').update(form).eq('id', editing.id);
        if (error) {
          if (
            error.message.includes('filtro_estrelas_ativo') ||
            error.message.includes('email_notificacao') ||
            error.message.includes('canal_queixas')
          ) {
            const { filtro_estrelas_ativo, email_notificacao, canal_queixas, ...fallbackForm } = form;
            const { error: retryErr } = await supabase.from('estabelecimentos').update(fallbackForm).eq('id', editing.id);
            if (retryErr) { setError(retryErr.message); setSaving(false); return; }
          } else {
            setError(error.message); setSaving(false); return;
          }
        }
      } else {
        const { error } = await supabase.from('estabelecimentos').insert(form);
        if (error) {
          if (
            error.message.includes('filtro_estrelas_ativo') ||
            error.message.includes('email_notificacao') ||
            error.message.includes('canal_queixas')
          ) {
            const { filtro_estrelas_ativo, email_notificacao, canal_queixas, ...fallbackForm } = form;
            const { error: retryErr } = await supabase.from('estabelecimentos').insert(fallbackForm);
            if (retryErr) { setError(retryErr.message); setSaving(false); return; }
          } else {
            setError(error.message); setSaving(false); return;
          }
        }
      }

      setShowModal(false);
      setSaving(false);
      load();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar');
      setSaving(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estabelecimentos</h1>
          <p className="text-sm text-slate-500 mt-1">Cadastre e gerencie seus clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkGenerator(true)}
            className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
            title="Gerar link de avaliação direta com pop-up 5 estrelas"
          >
            <Sparkles size={16} className="text-amber-500" />
            <span>Gerador Google</span>
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus size={18} />
            Novo
          </button>
        </div>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou endereço..."
          className="input pl-10 w-full sm:max-w-md"
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
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Placas & Métricas</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Telefone</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Endereço</th>
                  <th className="text-left font-semibold text-slate-600 px-4 py-3">Status</th>
                  <th className="text-right font-semibold text-slate-600 px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => {
                  const s = stats[e.id];
                  const totalPlacas = s?.totalPlacas || 0;
                  const totalScans = s?.totalScans || 0;
                  const allCodes = [...(s?.qrCodes || []), ...(s?.nfcTags || [])];

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="font-semibold text-slate-900">{e.nome}</div>
                          {e.filtro_estrelas_ativo ? (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200/80"
                              title="Escudo de Reputação 5 Estrelas Ativo (1 a 3★ vai para gerência)"
                            >
                              <ShieldCheck size={11} className="text-amber-600" />
                              Escudo 5★ ({e.canal_queixas === 'email' ? 'E-mail' : e.canal_queixas === 'whatsapp' ? 'Zap' : 'Ambos'})
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600"
                              title="Redireciona diretamente para o Google Maps"
                            >
                              <Zap size={10} className="text-emerald-500" />
                              Google Direto
                            </span>
                          )}
                        </div>
                        <a href={e.link_google} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-0.5">
                          Link do Google <ExternalLink size={11} />
                        </a>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/placas?search=${encodeURIComponent(e.nome)}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold transition-colors ${
                                totalPlacas > 0
                                  ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200/60'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                              title={totalPlacas > 0 ? `Ver placas de ${e.nome}` : 'Nenhuma placa associada'}
                            >
                              <QrIcon size={12} />
                              <span>{totalPlacas > 0 ? `${totalPlacas} placa${totalPlacas > 1 ? 's' : ''}` : '0 placas'}</span>
                            </Link>

                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60"
                              title={`${totalScans} leituras registradas`}
                            >
                              <ScanLine size={12} />
                              <span>{totalScans} scans</span>
                            </span>
                          </div>

                          {allCodes.length > 0 && (
                            <div className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]" title={allCodes.join(', ')}>
                              {allCodes.slice(0, 3).join(', ')}{allCodes.length > 3 ? ` +${allCodes.length - 3}` : ''}
                            </div>
                          )}
                        </div>
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
                          <Link
                            to={`/placas?search=${encodeURIComponent(e.nome)}`}
                            title="Ver e Gerenciar Placas deste cliente"
                            className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <QrIcon size={16} />
                          </Link>
                          <button
                            onClick={() => setReportEst(e)}
                            title="Relatório de Desempenho (WhatsApp & Web)"
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <BarChart3 size={16} />
                          </button>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((e) => {
              const s = stats[e.id];
              const totalPlacas = s?.totalPlacas || 0;
              const totalScans = s?.totalScans || 0;
              const allCodes = [...(s?.qrCodes || []), ...(s?.nfcTags || [])];

              return (
                <div key={e.id} className="card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900">{e.nome}</h3>
                        {e.filtro_estrelas_ativo ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <ShieldCheck size={11} className="text-amber-600" />
                            Escudo 5★ ({e.canal_queixas === 'email' ? 'E-mail' : e.canal_queixas === 'whatsapp' ? 'Zap' : 'Ambos'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            <Zap size={10} className="text-emerald-500" />
                            Google Direto
                          </span>
                        )}
                      </div>
                      <a href={e.link_google} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 flex items-center gap-1 mt-0.5">
                        Link do Google <ExternalLink size={11} />
                      </a>
                    </div>
                    <button onClick={() => toggleAtivo(e)} className={e.ativo ? 'badge-green' : 'badge-red'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${e.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>

                  {e.telefone && <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-1"><Phone size={13} /> {e.telefone}</p>}
                  {e.endereco && <p className="text-sm text-slate-500 flex items-center gap-1.5"><MapPin size={13} /> {e.endereco}</p>}

                  {/* Badges de Placas e Scans no Mobile */}
                  <div className="flex items-center gap-2 flex-wrap my-2.5 py-2 px-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                    <Link
                      to={`/placas?search=${encodeURIComponent(e.nome)}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold text-xs transition-colors ${
                        totalPlacas > 0
                          ? 'bg-brand-50 text-brand-700 border border-brand-200/60'
                          : 'bg-white text-slate-500 border border-slate-200'
                      }`}
                    >
                      <QrIcon size={13} />
                      <span>{totalPlacas > 0 ? `${totalPlacas} placa${totalPlacas > 1 ? 's' : ''}` : '0 placas'}</span>
                    </Link>

                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold text-xs bg-amber-50 text-amber-700 border border-amber-200/60">
                      <ScanLine size={13} />
                      <span>{totalScans} scans</span>
                    </span>

                    {allCodes.length > 0 && (
                      <span className="text-[11px] font-mono text-slate-500 ml-auto truncate max-w-[120px]">
                        {allCodes.slice(0, 2).join(', ')}{allCodes.length > 2 ? '...' : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <Link to={`/placas?search=${encodeURIComponent(e.nome)}`} className="btn-secondary flex-1 text-xs">
                      <QrIcon size={14} className="text-brand-600" /> Placas
                    </Link>
                    <button onClick={() => setReportEst(e)} className="btn-secondary flex-1 text-xs">
                      <BarChart3 size={14} className="text-emerald-600" /> Relatório
                    </button>
                    <button onClick={() => openPrompt(e)} className="btn-secondary flex-1 text-xs">
                      <Sparkles size={14} /> Prompt
                    </button>
                    <button onClick={() => openEdit(e)} className="btn-secondary flex-1 text-xs">
                      <Pencil size={14} /> Editar
                    </button>
                    <button onClick={() => handleDelete(e.id)} className="btn-secondary text-red-500 text-xs">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal / Bottom Sheet */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slide-up sm:animate-scale-in max-h-[88vh] sm:max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border border-slate-100 sm:border-slate-200"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">{editing ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                // Impede que apertar Enter em campos de texto feche o modal ou envie antes da hora
                if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
                  e.preventDefault();
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="label">Nome do estabelecimento *</label>
                <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" placeholder="Ex: Ótica G&G" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Link de avaliação do Google *</label>
                  <button
                    type="button"
                    onClick={() => setShowLinkGenerator(true)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    Gerar pelo Maps
                  </button>
                </div>
                <input
                  required
                  type="url"
                  value={form.link_google}
                  onChange={(e) => setForm({ ...form, link_google: e.target.value })}
                  className="input"
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                />
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

              {/* Escudo de Reputação (Filtro 5 Estrelas) */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-slate-800 space-y-1.5 animate-fade-in">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.filtro_estrelas_ativo}
                    onChange={(e) => setForm({ ...form, filtro_estrelas_ativo: e.target.checked })}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-200"
                  />
                  <span className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-amber-600" />
                    Escudo de Reputação (Filtro 5 Estrelas)
                  </span>
                </label>
                <p className="text-xs text-amber-900/80 leading-relaxed pl-6">
                  Se ativado, clientes que avaliarem de <strong>1 a 3 estrelas</strong> são direcionados para o WhatsApp ou E-mail da gerência em vez de avaliar no Google, blindando a nota do cliente.
                </p>

                {form.filtro_estrelas_ativo && (
                  <div className="pt-2 border-t border-amber-200/80 space-y-3 pl-6">
                    <div>
                      <label className="text-xs font-bold text-amber-950 block mb-1.5">
                        Onde o lojista prefere receber as queixas?
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <label
                          className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            form.canal_queixas === 'ambos'
                              ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                              : 'bg-white border-amber-200 text-slate-600 hover:bg-amber-50/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="canal_queixas"
                            value="ambos"
                            checked={form.canal_queixas === 'ambos'}
                            onChange={() => setForm({ ...form, canal_queixas: 'ambos' })}
                            className="sr-only"
                          />
                          <span>🟢 Ambos</span>
                          <span className="text-[10px] font-normal text-slate-500 mt-0.5">Zap ou E-mail</span>
                        </label>

                        <label
                          className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            form.canal_queixas === 'email'
                              ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                              : 'bg-white border-amber-200 text-slate-600 hover:bg-amber-50/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="canal_queixas"
                            value="email"
                            checked={form.canal_queixas === 'email'}
                            onChange={() => setForm({ ...form, canal_queixas: 'email' })}
                            className="sr-only"
                          />
                          <span>✉️ Só E-mail</span>
                          <span className="text-[10px] font-normal text-slate-500 mt-0.5">Preserva celular</span>
                        </label>

                        <label
                          className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                            form.canal_queixas === 'whatsapp'
                              ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                              : 'bg-white border-amber-200 text-slate-600 hover:bg-amber-50/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="canal_queixas"
                            value="whatsapp"
                            checked={form.canal_queixas === 'whatsapp'}
                            onChange={() => setForm({ ...form, canal_queixas: 'whatsapp' })}
                            className="sr-only"
                          />
                          <span>📲 Só WhatsApp</span>
                          <span className="text-[10px] font-normal text-slate-500 mt-0.5">Mais rápido</span>
                        </label>
                      </div>
                    </div>

                    {(form.canal_queixas === 'ambos' || form.canal_queixas === 'email') && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-amber-950 block">
                          E-mail da Gerência para Receber Queixas
                        </label>
                        <input
                          type="email"
                          required={form.canal_queixas === 'email'}
                          value={form.email_notificacao}
                          onChange={(e) => setForm({ ...form, email_notificacao: e.target.value })}
                          className="input text-xs bg-white"
                          placeholder="gerencia@empresa.com"
                        />
                        <span className="text-[11px] text-amber-800/80 block">
                          {form.canal_queixas === 'email'
                            ? 'O botão do WhatsApp será ocultado. O cliente só poderá enviar por e-mail, preservando seu celular.'
                            : 'O cliente poderá escolher entre falar no WhatsApp ou enviar direto para este e-mail.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

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
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setPromptFor(null)}
        >
          <div
            className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slide-up sm:animate-scale-in max-h-[88vh] sm:max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border border-slate-100 sm:border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
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

      {/* Gerador de Link de Avaliação Google */}
      <GoogleReviewGeneratorModal
        isOpen={showLinkGenerator}
        onClose={() => setShowLinkGenerator(false)}
        initialEstablishmentName={form.nome || (editing ? editing.nome : '')}
        onSelectLink={(link) => {
          setForm((prev) => ({ ...prev, link_google: link }));
          setShowLinkGenerator(false);
        }}
      />

      {/* Relatório de Desempenho (WhatsApp & Web) */}
      <RelatorioModal
        isOpen={!!reportEst}
        onClose={() => setReportEst(null)}
        estabelecimento={reportEst}
      />
    </div>
  );
}

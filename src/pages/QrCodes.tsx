import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Plus, QrCode as QrIcon, Download, Link2, Unlink, X, Loader2, Search, Eye, Copy, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { QrCode as QrType, Estabelecimento } from '@/types/database';

interface QrRow extends QrType {
  estabelecimento: { nome: string; link_google: string } | null;
}

export default function QrCodes() {
  const [items, setItems] = useState<QrRow[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [showAssoc, setShowAssoc] = useState<QrRow | null>(null);
  const [selectedEst, setSelectedEst] = useState<string>('');
  const [assocSaving, setAssocSaving] = useState(false);
  const [showPreview, setShowPreview] = useState<QrRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const baseUrl = window.location.origin;

  useEffect(() => {
    load();
    loadEstabelecimentos();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*, estabelecimento:estabelecimento_id(nome, link_google)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar QR codes:', error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as unknown as QrRow[]);
    }
    setLoading(false);
  }

  async function loadEstabelecimentos() {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('ativo', true).order('nome');
    setEstabelecimentos(data ?? []);
  }

  const generateQrUrl = useCallback((codigo: string) => `${baseUrl}/q/${codigo}`, [baseUrl]);

  // Generate QR data URLs whenever items change
  useEffect(() => {
    if (items.length === 0) return;

    const urls: Record<string, string> = {};
    Promise.all(
      items.map(async (qr) => {
        try {
          const url = await QRCode.toDataURL(generateQrUrl(qr.codigo), {
            width: 512,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          urls[qr.id] = url;
        } catch (err) {
          console.error('Erro ao gerar QR code', qr.codigo, err);
        }
      })
    ).then(() => {
      setQrDataUrls(urls);
    });
  }, [items, generateQrUrl]);

  async function handleCreate() {
    setCreating(true);
    const { count } = await supabase.from('qr_codes').select('*', { count: 'exact', head: true });
    const startNum = (count ?? 0) + 1;
    const rows = [];
    for (let i = 0; i < batchCount; i++) {
      const num = startNum + i;
      rows.push({ codigo: `QR${String(num).padStart(3, '0')}`, ativo: true });
    }
    const { error } = await supabase.from('qr_codes').insert(rows);
    setCreating(false);
    if (error) { alert(error.message); return; }
    setShowCreate(false);
    load();
  }

  async function toggleAtivo(qr: QrRow) {
    await supabase.from('qr_codes').update({ ativo: !qr.ativo }).eq('id', qr.id);
    load();
  }

  async function desassociar(qr: QrRow) {
    await supabase.from('qr_codes').update({ estabelecimento_id: null }).eq('id', qr.id);
    load();
  }

  async function handleDelete(qr: QrRow) {
    if (!confirm(`Tem certeza que deseja excluir o QR Code ${qr.codigo}? Os scans relacionados também serão removidos.`)) return;
    const { error } = await supabase.from('qr_codes').delete().eq('id', qr.id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function saveAssociacao() {
    if (!showAssoc) return;
    setAssocSaving(true);
    const { error } = await supabase
      .from('qr_codes')
      .update({ estabelecimento_id: selectedEst || null })
      .eq('id', showAssoc.id);
    setAssocSaving(false);
    if (error) { alert(error.message); return; }
    setShowAssoc(null);
    setSelectedEst('');
    load();
  }

  function openAssoc(qr: QrRow) {
    setShowAssoc(qr);
    setSelectedEst(qr.estabelecimento_id ?? '');
  }

  function downloadPng(qr: QrRow) {
    const url = qrDataUrls[qr.id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qr.codigo}.png`;
    a.click();
  }

  function copyUrl(qr: QrRow) {
    navigator.clipboard.writeText(generateQrUrl(qr.codigo));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getEstNome(qr: QrRow): string | null {
    return qr.estabelecimento?.nome ?? null;
  }

  const filtered = items.filter((qr) =>
    qr.codigo.toLowerCase().includes(search.toLowerCase()) ||
    (getEstNome(qr)?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QR Codes</h1>
          <p className="text-sm text-slate-500 mt-1">Gere e gerencie seus QR Codes dinâmicos</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} />
          Gerar QR Code
        </button>
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código ou estabelecimento..."
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
            <QrIcon size={28} className="text-slate-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Nenhum QR Code</h3>
          <p className="text-sm text-slate-400 mb-4">Gere seus primeiros QR Codes para imprimir</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={18} />
            Gerar QR Code
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((qr) => (
            <div key={qr.id} className="card p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-lg">{qr.codigo}</span>
                <button onClick={() => toggleAtivo(qr)} className={qr.ativo ? 'badge-green' : 'badge-red'}>
                  <span className={`w-1.5 h-1.5 rounded-full ${qr.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {qr.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              {/* QR preview */}
              <div className="flex justify-center mb-3 bg-white border border-slate-100 rounded-lg p-3">
                {qrDataUrls[qr.id] ? (
                  <img src={qrDataUrls[qr.id]} alt={qr.codigo} className="w-32 h-32" />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-slate-300" />
                  </div>
                )}
              </div>

              {/* Association */}
              <div className="mb-3 min-h-[2.5rem]">
                {getEstNome(qr) ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Link2 size={14} className="text-brand-500 shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{getEstNome(qr)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Unlink size={14} className="shrink-0" />
                    <span>Sem estabelecimento</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openAssoc(qr)} className="btn-secondary text-xs py-2">
                  <Link2 size={14} />
                  Associar
                </button>
                <button onClick={() => downloadPng(qr)} className="btn-secondary text-xs py-2" disabled={!qrDataUrls[qr.id]}>
                  <Download size={14} />
                  PNG
                </button>
                <button onClick={() => setShowPreview(qr)} className="btn-secondary text-xs py-2">
                  <Eye size={14} />
                  Ver
                </button>
                <button onClick={() => copyUrl(qr)} className="btn-secondary text-xs py-2">
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  Copiar
                </button>
              </div>
              {getEstNome(qr) && (
                <button onClick={() => desassociar(qr)} className="w-full mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-1">
                  Desassociar
                </button>
              )}
              <button onClick={() => handleDelete(qr)} className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors py-1.5">
                <Trash2 size={13} />
                Excluir QR Code
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Gerar QR Code">
          <p className="text-sm text-slate-500 mb-4">
            Gere novos QR Codes com identificadores sequenciais automáticos (QR001, QR002, ...). Cada QR apontará para uma URL do sistema que pode ser associada depois.
          </p>
          <div className="mb-5">
            <label className="label">Quantidade</label>
            <input type="number" min={1} max={50} value={batchCount} onChange={(e) => setBatchCount(Math.max(1, Math.min(50, Number(e.target.value))))} className="input" />
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
            Selecione o estabelecimento que este QR Code deve redirecionar.
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

      {/* Preview modal */}
      {showPreview && (
        <Modal onClose={() => setShowPreview(null)} title={showPreview.codigo}>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrls[showPreview.id] ? (
              <img src={qrDataUrls[showPreview.id]} alt={showPreview.codigo} className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-slate-300" />
              </div>
            )}
            <div className="text-center w-full">
              <p className="text-xs text-slate-400 mb-1">URL do QR Code</p>
              <p className="text-sm font-mono text-slate-700 bg-slate-50 rounded-lg px-3 py-2 break-all">
                {generateQrUrl(showPreview.codigo)}
              </p>
              {getEstNome(showPreview) && (
                <p className="text-sm text-slate-600 mt-3">
                  Associado a: <span className="font-semibold text-slate-900">{getEstNome(showPreview)}</span>
                </p>
              )}
            </div>
            <button onClick={() => downloadPng(showPreview)} className="btn-primary w-full" disabled={!qrDataUrls[showPreview.id]}>
              <Download size={18} />
              Baixar PNG
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
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

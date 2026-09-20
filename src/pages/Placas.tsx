import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Plus, QrCode as QrIcon, Nfc as NfcIcon, Download, Link2, Unlink, X,
  Loader2, Search, Eye, Copy, Check, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

type Tipo = 'qr' | 'nfc';
type CreateTipo = 'qr' | 'nfc' | 'ambos';

interface PlacaItem {
  id: string;
  codigo: string;
  estabelecimento_id: string | null;
  ativo: boolean;
  estabelecimento: { nome: string; link_google?: string } | null;
}

export default function Placas() {
  const [view, setView] = useState<Tipo>('qr');
  const [qrItems, setQrItems] = useState<PlacaItem[]>([]);
  const [nfcItems, setNfcItems] = useState<PlacaItem[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createTipo, setCreateTipo] = useState<CreateTipo>('ambos');
  const [batchCount, setBatchCount] = useState(1);
  const [createEst, setCreateEst] = useState('');

  const [showAssoc, setShowAssoc] = useState<PlacaItem | null>(null);
  const [selectedEst, setSelectedEst] = useState('');
  const [assocSaving, setAssocSaving] = useState(false);

  const [showPreview, setShowPreview] = useState<PlacaItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  const baseUrl = window.location.origin;

  useEffect(() => {
    load();
    loadEstabelecimentos();
  }, []);

  async function load() {
    setLoading(true);
    const [qrRes, nfcRes] = await Promise.all([
      supabase.from('qr_codes').select('*, estabelecimento:estabelecimento_id(nome, link_google)').order('codigo'),
      supabase.from('nfc_tags').select('*, estabelecimento:estabelecimento_id(nome)').order('codigo'),
    ]);
    if (qrRes.error) console.error('Erro ao carregar QR codes:', qrRes.error.message);
    if (nfcRes.error) console.error('Erro ao carregar NFC tags:', nfcRes.error.message);
    setQrItems((qrRes.data ?? []) as unknown as PlacaItem[]);
    setNfcItems((nfcRes.data ?? []) as unknown as PlacaItem[]);
    setLoading(false);
  }

  async function loadEstabelecimentos() {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('ativo', true).order('nome');
    setEstabelecimentos(data ?? []);
  }

  const items = view === 'qr' ? qrItems : nfcItems;

  const generateQrUrl = useCallback((codigo: string) => `${baseUrl}/q/${codigo}`, [baseUrl]);
  const generateNfcUrl = useCallback((codigo: string) => `${baseUrl}/n/${codigo}`, [baseUrl]);

  // Gera as imagens de QR só quando a aba QR Codes está visível
  useEffect(() => {
    if (view !== 'qr' || qrItems.length === 0) return;
    const urls: Record<string, string> = {};
    Promise.all(
      qrItems.map(async (qr) => {
        try {
          urls[qr.id] = await QRCode.toDataURL(generateQrUrl(qr.codigo), {
            width: 512,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        } catch (err) {
          console.error('Erro ao gerar QR code', qr.codigo, err);
        }
      })
    ).then(() => setQrDataUrls(urls));
  }, [qrItems, view, generateQrUrl]);

  async function proximoNumero(table: 'qr_codes' | 'nfc_tags') {
    const { data: last } = await supabase.from(table).select('codigo').order('codigo', { ascending: false }).limit(1);
    const lastNum = last?.[0]?.codigo ? parseInt(last[0].codigo.replace(/\D/g, ''), 10) : 0;
    return (Number.isFinite(lastNum) ? lastNum : 0) + 1;
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const estId = createEst || null;

      if (createTipo === 'ambos') {
        // Mesmo número de sequência pros dois, pra ficarem pareados (QR007 + NFC007 = mesma placa física)
        const [nextQr, nextNfc] = await Promise.all([proximoNumero('qr_codes'), proximoNumero('nfc_tags')]);
        const start = Math.max(nextQr, nextNfc);
        const qrRows = [];
        const nfcRows = [];
        for (let i = 0; i < batchCount; i++) {
          const sufixo = String(start + i).padStart(3, '0');
          qrRows.push({ codigo: `QR${sufixo}`, ativo: true, estabelecimento_id: estId });
          nfcRows.push({ codigo: `NFC${sufixo}`, url_dinamica: `${baseUrl}/n/NFC${sufixo}`, ativo: true, estabelecimento_id: estId });
        }
        const [r1, r2] = await Promise.all([
          supabase.from('qr_codes').insert(qrRows),
          supabase.from('nfc_tags').insert(nfcRows),
        ]);
        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;
      } else if (createTipo === 'qr') {
        const start = await proximoNumero('qr_codes');
        const rows = Array.from({ length: batchCount }, (_, i) => ({
          codigo: `QR${String(start + i).padStart(3, '0')}`,
          ativo: true,
          estabelecimento_id: estId,
        }));
        const { error } = await supabase.from('qr_codes').insert(rows);
        if (error) throw error;
      } else {
        const start = await proximoNumero('nfc_tags');
        const rows = Array.from({ length: batchCount }, (_, i) => {
          const codigo = `NFC${String(start + i).padStart(3, '0')}`;
          return { codigo, url_dinamica: `${baseUrl}/n/${codigo}`, ativo: true, estabelecimento_id: estId };
        });
        const { error } = await supabase.from('nfc_tags').insert(rows);
        if (error) throw error;
      }

      setShowCreate(false);
      setCreateEst('');
      setBatchCount(1);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar placas');
    } finally {
      setCreating(false);
    }
  }

  function table() {
    return view === 'qr' ? 'qr_codes' : 'nfc_tags';
  }

  async function toggleAtivo(item: PlacaItem) {
    await supabase.from(table()).update({ ativo: !item.ativo }).eq('id', item.id);
    load();
  }

  async function desassociar(item: PlacaItem) {
    await supabase.from(table()).update({ estabelecimento_id: null }).eq('id', item.id);
    load();
  }

  async function handleDelete(item: PlacaItem) {
    const label = view === 'qr' ? 'QR Code' : 'Tag NFC';
    if (!confirm(`Tem certeza que deseja excluir a ${label} ${item.codigo}?`)) return;
    const { error } = await supabase.from(table()).delete().eq('id', item.id);
    if (error) { alert(error.message); return; }
    load();
  }

  async function saveAssociacao() {
    if (!showAssoc) return;
    setAssocSaving(true);
    const { error } = await supabase.from(table()).update({ estabelecimento_id: selectedEst || null }).eq('id', showAssoc.id);
    setAssocSaving(false);
    if (error) { alert(error.message); return; }
    setShowAssoc(null);
    setSelectedEst('');
    load();
  }

  function openAssoc(item: PlacaItem) {
    setShowAssoc(item);
    setSelectedEst(item.estabelecimento_id ?? '');
  }

  function downloadPng(qr: PlacaItem) {
    const url = qrDataUrls[qr.id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${qr.codigo}.png`;
    a.click();
  }

  function copyUrl(item: PlacaItem) {
    const url = view === 'qr' ? generateQrUrl(item.codigo) : generateNfcUrl(item.codigo);
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = items.filter((item) =>
    item.codigo.toLowerCase().includes(search.toLowerCase()) ||
    (item.estabelecimento?.nome?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placas</h1>
          <p className="text-sm text-slate-500 mt-1">QR Codes e Tags NFC, no mesmo lugar</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={18} />
          Gerar placas
        </button>
      </div>

      {/* Toggle QR Codes / Tags NFC */}
      <div className="inline-flex bg-slate-100 rounded-lg p-1 mb-4">
        <button
          onClick={() => setView('qr')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'qr' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <QrIcon size={16} />
          QR Codes
        </button>
        <button
          onClick={() => setView('nfc')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'nfc' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <NfcIcon size={16} />
          Tags NFC
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
            {view === 'qr' ? <QrIcon size={28} className="text-slate-400" /> : <NfcIcon size={28} className="text-slate-400" />}
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">
            {view === 'qr' ? 'Nenhum QR Code' : 'Nenhuma Tag NFC'}
          </h3>
          <p className="text-sm text-slate-400 mb-4">Gere suas primeiras placas pra imprimir/gravar</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={18} />
            Gerar placas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="card p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-900 text-lg font-mono">{item.codigo}</span>
                <button onClick={() => toggleAtivo(item)} className={item.ativo ? 'badge-green' : 'badge-red'}>
                  <span className={`w-1.5 h-1.5 rounded-full ${item.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <div className="flex justify-center mb-3 bg-white border border-slate-100 rounded-lg p-3 h-[9.5rem] items-center">
                {view === 'qr' ? (
                  qrDataUrls[item.id] ? (
                    <img src={qrDataUrls[item.id]} alt={item.codigo} className="w-32 h-32" />
                  ) : (
                    <Loader2 size={24} className="animate-spin text-slate-300" />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <NfcIcon size={48} strokeWidth={1.2} />
                    <span className="text-xs">Grave essa URL na tag</span>
                  </div>
                )}
              </div>

              <div className="mb-3 min-h-[2.5rem]">
                {item.estabelecimento?.nome ? (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Link2 size={14} className="text-brand-500 shrink-0" />
                    <span className="font-medium text-slate-700 truncate">{item.estabelecimento.nome}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-slate-400">
                    <Unlink size={14} className="shrink-0" />
                    <span>Sem estabelecimento</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openAssoc(item)} className="btn-secondary text-xs py-2">
                  <Link2 size={14} />
                  Associar
                </button>
                {view === 'qr' ? (
                  <button onClick={() => downloadPng(item)} className="btn-secondary text-xs py-2" disabled={!qrDataUrls[item.id]}>
                    <Download size={14} />
                    PNG
                  </button>
                ) : (
                  <button onClick={() => setShowPreview(item)} className="btn-secondary text-xs py-2">
                    <Eye size={14} />
                    Ver URL
                  </button>
                )}
                {view === 'qr' && (
                  <button onClick={() => setShowPreview(item)} className="btn-secondary text-xs py-2">
                    <Eye size={14} />
                    Ver
                  </button>
                )}
                <button onClick={() => copyUrl(item)} className="btn-secondary text-xs py-2">
                  {copiedId === item.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  Copiar
                </button>
              </div>
              {item.estabelecimento?.nome && (
                <button onClick={() => desassociar(item)} className="w-full mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-1">
                  Desassociar
                </button>
              )}
              <button onClick={() => handleDelete(item)} className="w-full mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors py-1.5">
                <Trash2 size={13} />
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Gerar placas">
          <p className="text-sm text-slate-500 mb-4">
            Escolha o tipo de placa. "Ambos" cria um QR Code e uma Tag NFC pareados (mesmo número) pra virarem a mesma placa física.
          </p>

          <div className="mb-4">
            <label className="label">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(['ambos', 'qr', 'nfc'] as CreateTipo[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setCreateTipo(t)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    createTipo === t
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {t === 'ambos' ? 'Ambos' : t === 'qr' ? 'QR Code' : 'Tag NFC'}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Quantidade</label>
            <input
              type="number"
              min={1}
              max={200}
              value={batchCount}
              onChange={(e) => setBatchCount(Math.max(1, Math.min(200, Number(e.target.value))))}
              className="input"
            />
          </div>

          <div className="mb-5">
            <label className="label">Estabelecimento (opcional)</label>
            <select value={createEst} onChange={(e) => setCreateEst(e.target.value)} className="input">
              <option value="">— Configurar depois —</option>
              {estabelecimentos.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Se você já sabe pra qual estabelecimento é, associa direto aqui e economiza um passo.
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
          <p className="text-sm text-slate-500 mb-4">Selecione o estabelecimento que esta placa deve redirecionar.</p>
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
            {view === 'qr' ? (
              qrDataUrls[showPreview.id] ? (
                <img src={qrDataUrls[showPreview.id]} alt={showPreview.codigo} className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center">
                  <Loader2 size={28} className="animate-spin text-slate-300" />
                </div>
              )
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-slate-300">
                <NfcIcon size={80} strokeWidth={1} />
              </div>
            )}
            <div className="text-center w-full">
              <p className="text-xs text-slate-400 mb-1">URL desta placa</p>
              <p className="text-sm font-mono text-slate-700 bg-slate-50 rounded-lg px-3 py-2 break-all">
                {view === 'qr' ? generateQrUrl(showPreview.codigo) : generateNfcUrl(showPreview.codigo)}
              </p>
              {showPreview.estabelecimento?.nome && (
                <p className="text-sm text-slate-600 mt-3">
                  Associado a: <span className="font-semibold text-slate-900">{showPreview.estabelecimento.nome}</span>
                </p>
              )}
            </div>
            {view === 'qr' && (
              <button onClick={() => downloadPng(showPreview)} className="btn-primary w-full" disabled={!qrDataUrls[showPreview.id]}>
                <Download size={18} />
                Baixar PNG
              </button>
            )}
          </div>
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

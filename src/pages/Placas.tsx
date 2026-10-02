import { useEffect, useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Plus, QrCode as QrIcon, Nfc as NfcIcon, Download, Link2, Unlink, X,
  Loader2, Search, Eye, Copy, Check, Trash2, Printer, Camera, ExternalLink,
  Package, Layers, Store, AlertCircle, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';
import PrintModal from '@/components/PrintModal';

const ActivatePlacaModal = lazy(() => import('@/components/ActivatePlacaModal'));

type Tipo = 'kits' | 'qr' | 'nfc';
type CreateTipo = 'qr' | 'nfc' | 'ambos';
type StatusFilter = 'todos' | 'instaladas' | 'estoque';

interface PlacaItem {
  id: string;
  codigo: string;
  estabelecimento_id: string | null;
  ativo: boolean;
  estabelecimento: { nome: string; link_google?: string } | null;
}

interface PhysicalKit {
  id: string;
  numero: string;
  qr: PlacaItem | null;
  nfc: PlacaItem | null;
  estabelecimentoNome: string | null;
  estabelecimentoId: string | null;
  status: 'estoque' | 'instalado' | 'misto';
}

export default function Placas() {
  const [view, setView] = useState<Tipo>('kits');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [qrItems, setQrItems] = useState<PlacaItem[]>([]);
  const [nfcItems, setNfcItems] = useState<PlacaItem[]>([]);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createTipo, setCreateTipo] = useState<CreateTipo>('ambos');
  const [batchCount, setBatchCount] = useState(1);
  const [createEst, setCreateEst] = useState('');

  const [showAssoc, setShowAssoc] = useState<PlacaItem | null>(null);
  const [showAssocKit, setShowAssocKit] = useState<PhysicalKit | null>(null);
  const [selectedEst, setSelectedEst] = useState('');
  const [assocSaving, setAssocSaving] = useState(false);

  const [showPreview, setShowPreview] = useState<PlacaItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printPlacaId, setPrintPlacaId] = useState<string | undefined>(undefined);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const baseUrl = window.location.origin;

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== search) {
      setSearch(q);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('action') === 'activate') {
      setShowActivateModal(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // Gera as imagens de QR em alta resolução para visualização e impressão
  useEffect(() => {
    const todosItens = [...qrItems, ...nfcItems];
    if (todosItens.length === 0) return;
    const urls: Record<string, string> = {};
    Promise.all(
      todosItens.map(async (item) => {
        try {
          const targetUrl = item.codigo.startsWith('NFC') ? generateNfcUrl(item.codigo) : generateQrUrl(item.codigo);
          urls[item.id] = await QRCode.toDataURL(targetUrl, {
            width: 512,
            margin: 2,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        } catch (err) {
          console.error('Erro ao gerar QR code', item.codigo, err);
        }
      })
    ).then(() => setQrDataUrls((prev) => ({ ...prev, ...urls })));
  }, [qrItems, nfcItems, generateQrUrl, generateNfcUrl]);

  async function proximoNumeroNumerico(table: 'qr_codes' | 'nfc_tags') {
    const { data } = await supabase.from(table).select('codigo');
    if (!data || data.length === 0) return 1;
    const max = data.reduce((acc, curr) => {
      const num = parseInt((curr.codigo || '').replace(/\D/g, ''), 10);
      return Number.isFinite(num) && num > acc ? num : acc;
    }, 0);
    return max + 1;
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const estId = createEst || null;

      // 1. Tenta gerar via RPC atômica no banco de dados
      const { data: rpcResult, error: rpcError } = await supabase.rpc('gerar_placas_lote', {
        p_tipo: createTipo,
        p_quantidade: batchCount,
        p_estabelecimento_id: estId,
        p_base_url: baseUrl,
      });

      // Se a RPC funcionou, finaliza com sucesso
      if (!rpcError && rpcResult?.sucesso) {
        setShowCreate(false);
        setCreateEst('');
        setBatchCount(1);
        await load();
        return;
      }

      // 2. Fallback caso a RPC ainda não esteja instalada no Supabase remoto
      if (createTipo === 'ambos') {
        const [nextQr, nextNfc] = await Promise.all([
          proximoNumeroNumerico('qr_codes'),
          proximoNumeroNumerico('nfc_tags'),
        ]);
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
        const start = await proximoNumeroNumerico('qr_codes');
        const rows = Array.from({ length: batchCount }, (_, i) => ({
          codigo: `QR${String(start + i).padStart(3, '0')}`,
          ativo: true,
          estabelecimento_id: estId,
        }));
        const { error } = await supabase.from('qr_codes').insert(rows);
        if (error) throw error;
      } else {
        const start = await proximoNumeroNumerico('nfc_tags');
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
      await load();
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
    const estId = selectedEst || null;
    const { error } = await supabase.from(table()).update({ estabelecimento_id: estId }).eq('id', showAssoc.id);

    // Sincroniza também o par correspondente (se QR001 -> NFC001, ou vice-versa)
    const numMatch = showAssoc.codigo.match(/\d+/);
    if (numMatch) {
      const counterpart = view === 'qr' ? `NFC${numMatch[0]}` : `QR${numMatch[0]}`;
      const otherTable = view === 'qr' ? 'nfc_tags' : 'qr_codes';
      await supabase.from(otherTable).update({ estabelecimento_id: estId }).ilike('codigo', counterpart);
    }

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

  function openAssocKit(kit: PhysicalKit) {
    setShowAssocKit(kit);
    setSelectedEst(kit.estabelecimentoId ?? '');
  }

  async function saveAssociacaoKit() {
    if (!showAssocKit) return;
    setAssocSaving(true);
    const estId = selectedEst || null;
    const promises = [];
    if (showAssocKit.qr) {
      promises.push(supabase.from('qr_codes').update({ estabelecimento_id: estId }).eq('id', showAssocKit.qr.id));
    }
    if (showAssocKit.nfc) {
      promises.push(supabase.from('nfc_tags').update({ estabelecimento_id: estId }).eq('id', showAssocKit.nfc.id));
    }
    const results = await Promise.all(promises);
    setAssocSaving(false);
    const err = results.find((r) => r.error);
    if (err?.error) {
      alert(err.error.message);
      return;
    }
    setShowAssocKit(null);
    setSelectedEst('');
    load();
  }

  async function desassociarKit(kit: PhysicalKit) {
    if (!confirm(`Deseja desassociar o Kit #${kit.numero}? O QR Code e a Tag NFC voltarão para o estoque livre.`)) return;
    const promises = [];
    if (kit.qr) promises.push(supabase.from('qr_codes').update({ estabelecimento_id: null }).eq('id', kit.qr.id));
    if (kit.nfc) promises.push(supabase.from('nfc_tags').update({ estabelecimento_id: null }).eq('id', kit.nfc.id));
    await Promise.all(promises);
    load();
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
    const url = item.codigo.startsWith('NFC') ? generateNfcUrl(item.codigo) : generateQrUrl(item.codigo);
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Métricas de Estoque e Inventário
  const totalQr = qrItems.length;
  const freeQr = qrItems.filter((q) => !q.estabelecimento_id).length;
  const installedQr = qrItems.filter((q) => !!q.estabelecimento_id).length;

  const totalNfc = nfcItems.length;
  const freeNfc = nfcItems.filter((n) => !n.estabelecimento_id).length;
  const installedNfc = nfcItems.filter((n) => !!n.estabelecimento_id).length;

  const totalPlacasGeral = totalQr + totalNfc;

  // Agrupamento de Kits Físicos (QR + NFC pareados pelo mesmo número)
  const physicalKits = useMemo(() => {
    const kitMap = new Map<string, { qr: PlacaItem | null; nfc: PlacaItem | null }>();
    qrItems.forEach((q) => {
      const num = q.codigo.replace(/\D/g, '') || q.codigo;
      if (!kitMap.has(num)) kitMap.set(num, { qr: null, nfc: null });
      kitMap.get(num)!.qr = q;
    });
    nfcItems.forEach((n) => {
      const num = n.codigo.replace(/\D/g, '') || n.codigo;
      if (!kitMap.has(num)) kitMap.set(num, { qr: null, nfc: null });
      kitMap.get(num)!.nfc = n;
    });

    return Array.from(kitMap.entries())
      .map(([num, pair]) => {
        const qrEst = pair.qr?.estabelecimento_id;
        const nfcEst = pair.nfc?.estabelecimento_id;
        const qrEstName = pair.qr?.estabelecimento?.nome;
        const nfcEstName = pair.nfc?.estabelecimento?.nome;

        let status: 'estoque' | 'instalado' | 'misto' = 'estoque';
        if (qrEst && nfcEst && qrEst === nfcEst) {
          status = 'instalado';
        } else if (qrEst || nfcEst) {
          status = 'misto';
        } else {
          status = 'estoque';
        }

        return {
          id: num,
          numero: num,
          qr: pair.qr,
          nfc: pair.nfc,
          estabelecimentoId: qrEst || nfcEst || null,
          estabelecimentoNome: qrEstName || nfcEstName || null,
          status,
        };
      })
      .sort((a, b) => parseInt(a.numero, 10) - parseInt(b.numero, 10));
  }, [qrItems, nfcItems]);

  const totalKits = physicalKits.length;
  const kitsEstoque = physicalKits.filter((k) => k.status === 'estoque').length;
  const kitsInstalados = physicalKits.filter((k) => k.status === 'instalado').length;
  const kitsMistos = physicalKits.filter((k) => k.status === 'misto').length;

  const filteredKits = useMemo(() => {
    return physicalKits.filter((kit) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        kit.numero.includes(q) ||
        (kit.qr?.codigo?.toLowerCase().includes(q) ?? false) ||
        (kit.nfc?.codigo?.toLowerCase().includes(q) ?? false) ||
        (kit.estabelecimentoNome?.toLowerCase().includes(q) ?? false);
      if (!matchesSearch) return false;

      if (statusFilter === 'instaladas') return kit.status === 'instalado';
      if (statusFilter === 'estoque') return kit.status === 'estoque';
      return true;
    });
  }, [physicalKits, search, statusFilter]);

  const rawItems = view === 'qr' ? qrItems : nfcItems;
  const filteredRawItems = useMemo(() => {
    return rawItems.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        item.codigo.toLowerCase().includes(q) ||
        (item.estabelecimento?.nome?.toLowerCase().includes(q) ?? false);
      if (!matchesSearch) return false;

      if (statusFilter === 'instaladas') return item.estabelecimento_id !== null;
      if (statusFilter === 'estoque') return item.estabelecimento_id === null;
      return true;
    });
  }, [rawItems, search, statusFilter]);

  return (
    <div className="animate-fade-in">
      {/* Barra de Ações do Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Placas & Estoque</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de kits físicos, estoque livre e placas em clientes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setShowActivateModal(true)}
            className="btn-primary bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
            title="Escanear QR Code com a câmera para ativar ou vincular"
          >
            <Camera size={18} />
            <span>Ativar / Scanner</span>
          </button>
          <button
            onClick={() => {
              setPrintPlacaId(undefined);
              setShowPrintModal(true);
            }}
            className="btn-secondary"
            disabled={rawItems.length === 0}
            title="Imprimir gabarito ou salvar em PDF"
          >
            <Printer size={18} />
            Imprimir / PDF
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-secondary">
            <Plus size={18} />
            Gerar em lote
          </button>
        </div>
      </div>

      {/* Top KPI Summary / Gestão de Estoque */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Card 1: Em Estoque */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'estoque' ? 'todos' : 'estoque')}
          className={`card p-4 cursor-pointer transition-all border ${
            statusFilter === 'estoque'
              ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300 shadow-xs'
              : 'hover:border-slate-300 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Em Estoque (Livres)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{kitsEstoque}</span>
            <span className="text-xs text-slate-400 font-medium">kits físicos</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">Prontos para ativar e entregar</p>
        </div>

        {/* Card 2: Instaladas */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'instaladas' ? 'todos' : 'instaladas')}
          className={`card p-4 cursor-pointer transition-all border ${
            statusFilter === 'instaladas'
              ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300 shadow-xs'
              : 'hover:border-slate-300 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Instaladas em Clientes</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{kitsInstalados}</span>
            <span className="text-xs text-slate-400 font-medium">kits ativos</span>
          </div>
          <p className="text-[11px] text-blue-600 font-semibold mt-1">Em operação nos comércios</p>
        </div>

        {/* Card 3: Total de Kits Físicos */}
        <div
          onClick={() => { setView('kits'); setStatusFilter('todos'); }}
          className={`card p-4 cursor-pointer transition-all border ${
            view === 'kits' && statusFilter === 'todos'
              ? 'ring-2 ring-brand-500 bg-brand-50/40 border-brand-300 shadow-xs'
              : 'hover:border-slate-300 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Kits Físicos</span>
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Layers size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{totalKits}</span>
            <span className="text-xs text-slate-400 font-medium">pares físicos</span>
          </div>
          <p className="text-[11px] text-brand-600 font-semibold mt-1">Pares QR + NFC vinculados</p>
        </div>

        {/* Card 4: Total de Placas Individuais */}
        <div className="card p-4 bg-white border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total de Registros</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <QrIcon size={15} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{totalPlacasGeral}</span>
            <span className="text-xs text-slate-400 font-medium">placas ({totalQr} QR + {totalNfc} NFC)</span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {kitsMistos > 0 ? `⚠️ ${kitsMistos} kits com status divergente` : '✓ 100% integradas'}
          </p>
        </div>
      </div>

      {/* Toolbar: Seletor de Modo e Filtro de Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        {/* Toggle Kits / QR Codes / Tags NFC */}
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setView('kits')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              view === 'kits' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>Kits Físicos (Pares)</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700">{totalKits}</span>
          </button>
          <button
            onClick={() => setView('qr')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              view === 'qr' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrIcon size={14} />
            <span>QR Codes</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700">{totalQr}</span>
          </button>
          <button
            onClick={() => setView('nfc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              view === 'nfc' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <NfcIcon size={14} />
            <span>Tags NFC</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700">{totalNfc}</span>
          </button>
        </div>

        {/* Status Filter Pills */}
        <div className="inline-flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Filtro:</span>
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'todos' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('instaladas')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'instaladas' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🏢 Instaladas ({view === 'kits' ? kitsInstalados : (view === 'qr' ? installedQr : installedNfc)})
          </button>
          <button
            onClick={() => setStatusFilter('estoque')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              statusFilter === 'estoque' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📦 Em Estoque ({view === 'kits' ? kitsEstoque : (view === 'qr' ? freeQr : freeNfc)})
          </button>
        </div>
      </div>

      {/* Campo de Busca */}
      <div className="mb-5 relative flex items-center max-w-md">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, número ou cliente..."
          className="input pl-10 pr-9 w-full"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              searchParams.delete('search');
              setSearchParams(searchParams, { replace: true });
            }}
            className="absolute right-3 p-1 text-slate-400 hover:text-slate-600"
            title="Limpar busca"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-slate-300" />
        </div>
      ) : view === 'kits' ? (
        // Grid de Kits Físicos
        filteredKits.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
              <Layers size={28} className="text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Nenhum kit físico encontrado</h3>
            <p className="text-sm text-slate-400 mb-4">Tente mudar o filtro ou gere novos kits pareados</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={18} />
              Gerar placas
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredKits.map((kit) => (
              <div key={kit.id} className="card p-4 hover:shadow-card-hover transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-slate-900 text-lg font-mono">Kit #{kit.numero}</span>
                    {kit.status === 'instalado' ? (
                      <span className="badge-green">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Instalado
                      </span>
                    ) : kit.status === 'estoque' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Package size={11} />
                        Em Estoque
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertCircle size={11} />
                        Misto
                      </span>
                    )}
                  </div>

                  {/* Componentes físicos do Kit (QR Code + NFC) */}
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 mb-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                          <QrIcon size={14} />
                        </div>
                        <span className="font-mono font-bold text-slate-800">{kit.qr?.codigo || `QR${kit.numero}`}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {kit.qr ? (kit.qr.ativo ? '✓ Ativo' : 'Inativo') : 'Não cadastrado'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          <NfcIcon size={14} />
                        </div>
                        <span className="font-mono font-bold text-slate-800">{kit.nfc?.codigo || `NFC${kit.numero}`}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {kit.nfc ? (kit.nfc.ativo ? '✓ Ativo' : 'Inativo') : 'Não cadastrado'}
                      </span>
                    </div>
                  </div>

                  {/* Informação do Cliente */}
                  <div className="mb-4 min-h-[2.5rem]">
                    {kit.estabelecimentoNome ? (
                      <div className="flex items-start gap-1.5 text-sm">
                        <Store size={15} className="text-brand-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block leading-tight">{kit.estabelecimentoNome}</span>
                          <span className="text-[11px] text-slate-400">Cliente associado</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Package size={15} className="shrink-0 text-emerald-500" />
                        <span className="text-xs font-medium text-slate-500">Disponível em estoque para venda</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações do Kit */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openAssocKit(kit)} className="btn-primary text-xs py-2">
                      <Link2 size={14} />
                      {kit.estabelecimentoNome ? 'Trocar Cliente' : 'Associar Kit'}
                    </button>
                    <button
                      onClick={() => {
                        if (kit.qr) setPrintPlacaId(kit.qr.id);
                        setShowPrintModal(true);
                      }}
                      className="btn-secondary text-xs py-2"
                      title="Imprimir gabarito da placa física"
                    >
                      <Printer size={14} />
                      Gabarito
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                    {kit.qr && (
                      <button onClick={() => setShowPreview(kit.qr)} className="hover:text-brand-600 flex items-center gap-1">
                        <Eye size={12} /> Ver QR
                      </button>
                    )}
                    {kit.nfc && (
                      <button onClick={() => setShowPreview(kit.nfc)} className="hover:text-brand-600 flex items-center gap-1">
                        <ExternalLink size={12} /> URL NFC
                      </button>
                    )}
                    {kit.estabelecimentoNome && (
                      <button onClick={() => desassociarKit(kit)} className="hover:text-red-600 transition-colors">
                        Desassociar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Grid Individual (QR Codes ou Tags NFC)
        filteredRawItems.length === 0 ? (
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
            {filteredRawItems.map((item) => (
              <div key={item.id} className="card p-4 hover:shadow-card-hover transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-900 text-lg font-mono">{item.codigo}</span>
                  <div className="flex items-center gap-1.5">
                    {item.estabelecimento_id ? (
                      <span className="badge-green text-[10px]">Instalada</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Package size={10} />
                        Estoque
                      </span>
                    )}
                    <button onClick={() => toggleAtivo(item)} className={item.ativo ? 'badge-green' : 'badge-red'}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
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
                      <Package size={14} className="shrink-0 text-emerald-500" />
                      <span className="text-xs font-medium text-slate-500">Em estoque (Livre)</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => openAssoc(item)} className="btn-secondary text-xs py-2">
                    <Link2 size={14} />
                    Associar
                  </button>
                  <button
                    onClick={() => {
                      setPrintPlacaId(item.id);
                      setShowPrintModal(true);
                    }}
                    className="btn-secondary text-xs py-2"
                    title="Gabarito de impressão e PDF"
                  >
                    <Printer size={14} />
                    Gabarito
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
        )
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

      {/* Modal de Associação de Kit Físico (QR + NFC pareados) */}
      {showAssocKit && (
        <Modal
          onClose={() => { setShowAssocKit(null); setSelectedEst(''); }}
          title={`Associar Kit #${showAssocKit.numero}`}
        >
          <div className="space-y-3 mb-5">
            <p className="text-sm text-slate-500">
              Esta ação associa tanto o <strong>QR Code ({showAssocKit.qr?.codigo || `QR${showAssocKit.numero}`})</strong> quanto a <strong>Tag NFC ({showAssocKit.nfc?.codigo || `NFC${showAssocKit.numero}`})</strong> ao mesmo cliente de uma só vez.
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="font-semibold text-slate-800">Par Físico:</span>
              <span className="font-mono font-bold text-brand-700">
                {showAssocKit.qr?.codigo || `QR${showAssocKit.numero}`} + {showAssocKit.nfc?.codigo || `NFC${showAssocKit.numero}`}
              </span>
            </div>

            {estabelecimentos.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 text-amber-700 text-sm">
                Nenhum estabelecimento ativo. Cadastre um estabelecimento primeiro.
              </div>
            ) : (
              <div>
                <label className="label">Estabelecimento de Destino</label>
                <select
                  value={selectedEst}
                  onChange={(e) => setSelectedEst(e.target.value)}
                  className="input"
                >
                  <option value="">— Deixar em Estoque Livre (Sem Associação) —</option>
                  {estabelecimentos.map((e) => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setShowAssocKit(null); setSelectedEst(''); }} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={saveAssociacaoKit}
              disabled={assocSaving || estabelecimentos.length === 0}
              className="btn-primary flex-1"
            >
              {assocSaving ? <Loader2 size={18} className="animate-spin" /> : 'Salvar Kit'}
            </button>
          </div>
        </Modal>
      )}

      {/* Associate modal individual */}
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
            {showPreview.codigo.startsWith('QR') ? (
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
                {showPreview.codigo.startsWith('QR') ? generateQrUrl(showPreview.codigo) : generateNfcUrl(showPreview.codigo)}
              </p>
              {showPreview.estabelecimento?.nome && (
                <p className="text-sm text-slate-600 mt-3">
                  Associado a: <span className="font-semibold text-slate-900">{showPreview.estabelecimento.nome}</span>
                </p>
              )}
            </div>
            {showPreview.codigo.startsWith('QR') ? (
              <button onClick={() => downloadPng(showPreview)} className="btn-primary w-full" disabled={!qrDataUrls[showPreview.id]}>
                <Download size={18} />
                Baixar PNG
              </button>
            ) : (
              <div className="space-y-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => copyUrl(showPreview)}
                  className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedId === showPreview.id ? <Check size={16} /> : <Copy size={16} />}
                  {copiedId === showPreview.id ? 'URL Copiada!' : 'Copiar URL para Gravar na Tag'}
                </button>
                <a
                  href={generateNfcUrl(showPreview.codigo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 text-slate-700"
                >
                  <ExternalLink size={16} />
                  Testar Redirecionamento da Tag
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de Impressão e PDF */}
      {showPrintModal && (
        <PrintModal
          placas={(view === 'kits' ? (physicalKits.map((k) => k.qr).filter(Boolean) as PlacaItem[]) : rawItems).map((p) => ({
            id: p.id,
            codigo: p.codigo,
            estabelecimentoNome: p.estabelecimento?.nome,
            qrDataUrl: qrDataUrls[p.id],
          }))}
          initialPlacaId={printPlacaId}
          onClose={() => {
            setShowPrintModal(false);
            setPrintPlacaId(undefined);
          }}
        />
      )}

      {/* Modal de Ativação / Scanner */}
      {showActivateModal && (
        <Suspense fallback={null}>
          <ActivatePlacaModal
            isOpen={showActivateModal}
            onClose={() => setShowActivateModal(false)}
            onSuccess={() => load()}
          />
        </Suspense>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl animate-slide-up sm:animate-scale-in max-h-[88vh] sm:max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 border border-slate-100 sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
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

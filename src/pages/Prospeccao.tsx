import { useState, useEffect, useCallback } from 'react';
import {
  Target, Search, MapPin, Phone, Globe, Star, MessageCircle, ExternalLink,
  Instagram, Import, CheckSquare, Square, RefreshCw, Copy, Check,
  AlertCircle, Loader2, X, ChevronDown, Filter, Wifi, WifiOff,
  Trash2, StickyNote, Users,
} from 'lucide-react';
import { checkScraperAvailable, scrapeGoogleMaps, normalizeResult } from '@/lib/googleMapsService';
import { geocode } from '@/lib/geocodeService';
import {
  getProspects, importProspects, updateProspectStatus,
  saveProspectMessage, deleteProspect,
} from '@/lib/prospectsService';
import { generateMessage, buildWhatsAppUrl, getApproachType } from '@/lib/messageGenerator';
import type { Prospect, ProspectStatus } from '@/types/database';

// ── Constantes ──────────────────────────────────────────────────────
const CATEGORY_SUGGESTIONS = [
  'pet shop', 'barbearia', 'restaurante', 'clínica odontológica', 'academia',
  'loja de roupas', 'salão de beleza', 'padaria', 'farmácia', 'pizzaria',
  'hamburgueria', 'clínica veterinária', 'escola de idiomas', 'lavanderia',
];

const LOCATION_SUGGESTIONS = [
  'São Caetano do Sul - SP', 'Santo André - SP', 'São Bernardo do Campo - SP',
  'São Paulo - SP', 'Guarulhos - SP', 'Campinas - SP', 'Ribeirão Preto - SP',
];

const STATUS_LABELS: Record<ProspectStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  interessado: 'Interessado',
  cliente: 'Cliente',
  nao_interessado: 'Não interessado',
};

const STATUS_COLORS: Record<ProspectStatus, string> = {
  novo: 'bg-slate-100 text-slate-700',
  contatado: 'bg-blue-100 text-blue-700',
  interessado: 'bg-amber-100 text-amber-700',
  cliente: 'bg-green-100 text-green-700',
  nao_interessado: 'bg-red-100 text-red-700',
};

// ── Sub-componentes pequenos ─────────────────────────────────────────

function ScraperStatus({ available }: { available: boolean | null }) {
  if (available === null) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
      available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {available ? <Wifi size={12} /> : <WifiOff size={12} />}
      {available ? 'Scraper ativo' : 'Scraper offline'}
    </div>
  );
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className="flex items-center gap-1 text-amber-500 text-sm font-medium">
      <Star size={13} fill="currentColor" />
      {rating.toFixed(1)}
    </span>
  );
}

// ── Modal WhatsApp ───────────────────────────────────────────────────

interface WhatsAppModalProps {
  prospect: Prospect;
  onClose: () => void;
  onSaved: (id: string, msg: string) => void;
}

function WhatsAppModal({ prospect, onClose, onSaved }: WhatsAppModalProps) {
  const [variant, setVariant] = useState(0);
  const [message, setMessage] = useState(() => generateMessage(prospect, 0));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const approachType = getApproachType(prospect);
  const approachLabel = approachType === 'sem_site' ? 'Sem site' : approachType === 'com_site' ? 'Com site' : 'Geral';

  const waUrl = buildWhatsAppUrl(prospect.phone, message);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    setVariant(v => {
      const next = v + 1;
      setMessage(generateMessage(prospect, next));
      return next;
    });
  }

  async function handleOpenWhatsApp() {
    if (!waUrl) return;
    setSaving(true);
    try {
      await saveProspectMessage(prospect.id, message);
      onSaved(prospect.id, message);
    } catch { /* non-blocking */ }
    setSaving(false);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">{prospect.business_name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block ${
              approachType === 'sem_site' ? 'bg-orange-100 text-orange-700' :
              approachType === 'com_site' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              Abordagem: {approachLabel}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Mensagem editável */}
        <div className="p-6">
          <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
            Mensagem
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3
                       resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                       leading-relaxed"
            placeholder="Mensagem gerada aparecerá aqui..."
          />
          <p className="text-xs text-slate-400 mt-1">{message.length} caracteres · Editável antes de enviar</p>
        </div>

        {/* Telefone */}
        {prospect.phone ? (
          <div className="px-6 pb-2">
            <span className="text-xs text-slate-500">Número: </span>
            <span className="text-sm font-medium text-slate-700">{prospect.phone}</span>
          </div>
        ) : (
          <div className="px-6 pb-2 flex items-center gap-1.5 text-amber-600 text-xs">
            <AlertCircle size={13} />
            Telefone não encontrado — você precisará inserir manualmente no WhatsApp
          </div>
        )}

        {/* Ações */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleRegenerate}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600
                       bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            Regenerar
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600
                       bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={handleOpenWhatsApp}
            disabled={!waUrl || saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
                       text-white bg-[#25D366] hover:bg-[#1da851] rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
            {prospect.phone ? 'Abrir WhatsApp' : 'Copiar e abrir WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de resultado de busca ───────────────────────────────────────

interface SearchResultCardProps {
  item: ReturnType<typeof normalizeResult>;
  selected: boolean;
  onToggle: () => void;
}

function SearchResultCard({ item, selected, onToggle }: SearchResultCardProps) {
  const hasSite = item.website && item.website.trim() !== '';

  return (
    <div
      onClick={onToggle}
      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
        selected
          ? 'border-brand-500 bg-brand-50'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Checkbox */}
      <div className="absolute top-3 right-3 text-brand-600">
        {selected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
      </div>

      {/* Badge sem site — destaque */}
      {!hasSite && (
        <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide
                         bg-orange-500 text-white px-2 py-0.5 rounded-full">
          Sem site
        </span>
      )}

      <div className={`${!hasSite ? 'mt-6' : ''}`}>
        <h4 className="font-semibold text-slate-900 text-sm pr-6 leading-tight">{item.business_name}</h4>
        {item.category && (
          <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>
        )}
      </div>

      <div className="mt-3 space-y-1">
        {item.address && (
          <p className="flex items-start gap-1.5 text-xs text-slate-600">
            <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
            <span className="line-clamp-2">{item.address}</span>
          </p>
        )}
        {item.phone && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Phone size={11} className="shrink-0 text-slate-400" />
            {item.phone}
          </p>
        )}
        {hasSite && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
            <Globe size={11} className="shrink-0 text-slate-400" />
            <span className="truncate">{item.website}</span>
          </p>
        )}
        {item.instagram && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Instagram size={11} className="shrink-0 text-slate-400" />
            {item.instagram}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <StarRating rating={item.rating} />
        {item.review_count > 0 && (
          <span className="text-xs text-slate-400">{item.review_count.toLocaleString('pt-BR')} avaliações</span>
        )}
        {item.google_maps_url && (
          <a
            href={item.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-slate-400 hover:text-brand-600 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── Card de Lead (prospect salvo) ────────────────────────────────────

interface LeadCardProps {
  prospect: Prospect;
  onWhatsApp: (p: Prospect) => void;
  onStatusChange: (id: string, status: ProspectStatus) => void;
  onDelete: (id: string) => void;
}

function LeadCard({ prospect, onWhatsApp, onStatusChange, onDelete }: LeadCardProps) {
  const hasSite = prospect.website && prospect.website.trim() !== '';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-900 text-sm">{prospect.business_name}</h4>
            {!hasSite && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                Sem site
              </span>
            )}
          </div>
          {prospect.category && <p className="text-xs text-slate-500 mt-0.5">{prospect.category}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onWhatsApp(prospect)}
            title="Gerar mensagem WhatsApp"
            className="p-1.5 text-slate-400 hover:text-[#25D366] transition-colors rounded-lg hover:bg-slate-50"
          >
            <MessageCircle size={16} />
          </button>
          <button
            onClick={() => onDelete(prospect.id)}
            title="Remover lead"
            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {prospect.phone && (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <Phone size={11} className="text-slate-400" /> {prospect.phone}
          </p>
        )}
        {prospect.address && (
          <p className="flex items-start gap-1.5 text-xs text-slate-600">
            <MapPin size={11} className="mt-0.5 shrink-0 text-slate-400" />
            <span className="line-clamp-1">{prospect.address}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <StarRating rating={prospect.rating} />
        {/* Status selector */}
        <select
          value={prospect.status}
          onChange={e => onStatusChange(prospect.id, e.target.value as ProspectStatus)}
          onClick={e => e.stopPropagation()}
          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer
                       focus:ring-2 focus:ring-brand-500 ${STATUS_COLORS[prospect.status]}`}
        >
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {prospect.ultima_mensagem && (
        <div className="mt-2 p-2 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
            <StickyNote size={11} /> Última mensagem
          </p>
          <p className="text-xs text-slate-600 line-clamp-2">{prospect.ultima_mensagem}</p>
        </div>
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────

type Tab = 'busca' | 'leads';

export default function Prospeccao() {
  // Tabs
  const [tab, setTab] = useState<Tab>('busca');

  // Scraper status
  const [scraperOk, setScraperOk] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Busca
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [filterMinRating, setFilterMinRating] = useState('0');
  const [filterSemSite, setFilterSemSite] = useState(false);
  const [filterComTelefone, setFilterComTelefone] = useState(false);
  const [maxResults, setMaxResults] = useState('30');
  const [showFilters, setShowFilters] = useState(false);

  // Resultados da busca
  const [searchResults, setSearchResults] = useState<ReturnType<typeof normalizeResult>[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Leads
  const [leads, setLeads] = useState<Prospect[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [filterLeadStatus, setFilterLeadStatus] = useState<ProspectStatus | 'todos'>('todos');
  const [filterLeadSemSite, setFilterLeadSemSite] = useState(false);
  const [importingIds, setImportingIds] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Modal WhatsApp
  const [waProspect, setWaProspect] = useState<Prospect | null>(null);

  // ── Verificar scraper ao montar ────────────────────────────────────
  useEffect(() => {
    checkScraper();
  }, []);

  async function checkScraper() {
    setCheckingStatus(true);
    const ok = await checkScraperAvailable();
    setScraperOk(ok);
    setCheckingStatus(false);
  }

  // ── Carregar leads ─────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadsError(null);
    try {
      const data = await getProspects({
        status: filterLeadStatus === 'todos' ? undefined : filterLeadStatus,
        semSite: filterLeadSemSite || undefined,
      });
      setLeads(data);
    } catch (err) {
      setLeadsError(err instanceof Error ? err.message : 'Erro ao carregar leads');
    }
    setLoadingLeads(false);
  }, [filterLeadStatus, filterLeadSemSite]);

  useEffect(() => {
    if (tab === 'leads') loadLeads();
  }, [tab, loadLeads]);

  // ── Busca no Google Maps ───────────────────────────────────────────
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || !location.trim()) return;
    if (!scraperOk) {
      setSearchError('Scraper offline. Inicie o Docker e o Google Maps Scraper Kit primeiro.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelected(new Set());
    setImportResult(null);

    try {
      // Geocodifica localização
      setSearchProgress('Buscando coordenadas...');
      const geo = await geocode(location);
      if (!geo) throw new Error(`Não foi possível encontrar "${location}". Tente uma cidade diferente.`);

      const results = await scrapeGoogleMaps(
        {
          keyword: `${keyword} ${location}`,
          lat: geo.lat,
          lng: geo.lng,
          depth: 5,
          maxResults: Math.min(parseInt(maxResults, 10) || 30, 100),
        },
        msg => setSearchProgress(msg),
      );

      // Aplica filtros locais
      let filtered = results;
      if (filterSemSite) filtered = filtered.filter(r => !r.website || r.website.trim() === '');
      if (filterComTelefone) filtered = filtered.filter(r => r.phone && r.phone.trim() !== '');
      if (parseFloat(filterMinRating) > 0) {
        filtered = filtered.filter(r => (r.rating ?? 0) >= parseFloat(filterMinRating));
      }

      setSearchResults(filtered);
      if (filtered.length === 0) setSearchError('Nenhum resultado encontrado para os filtros aplicados.');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Erro durante a busca');
    }

    setSearching(false);
    setSearchProgress('');
  }

  // ── Seleção ────────────────────────────────────────────────────────
  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(searchResults.map((_, i) => i)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Importar selecionados ──────────────────────────────────────────
  async function handleImport() {
    if (selected.size === 0) return;
    setImportingIds(true);
    setImportResult(null);

    const toImport = Array.from(selected).map(i => searchResults[i]);

    try {
      const result = await importProspects(toImport);
      const parts: string[] = [];
      if (result.imported > 0) parts.push(`${result.imported} importado(s)`);
      if (result.skipped > 0) parts.push(`${result.skipped} já existia(m)`);
      if (result.errors > 0) parts.push(`${result.errors} erro(s)`);
      setImportResult(parts.join(' · '));
      clearSelection();
    } catch (err) {
      setImportResult(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`);
    }

    setImportingIds(false);
  }

  // ── Ações de lead ──────────────────────────────────────────────────
  async function handleStatusChange(id: string, status: ProspectStatus) {
    try {
      await updateProspectStatus(id, status);
      setLeads(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch { /* silently */ }
  }

  async function handleDeleteLead(id: string) {
    if (!confirm('Remover este lead?')) return;
    try {
      await deleteProspect(id);
      setLeads(prev => prev.filter(p => p.id !== id));
    } catch { /* silently */ }
  }

  function handleMessageSaved(id: string, msg: string) {
    setLeads(prev => prev.map(p => p.id === id
      ? { ...p, ultima_mensagem: msg, ultima_mensagem_em: new Date().toISOString() }
      : p
    ));
  }

  // Resultados filtrados do lado do cliente para sugestões de keywords
  const filteredResults = searchResults;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target size={24} className="text-brand-600" />
            Prospecção
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Encontre potenciais clientes no Google Maps e gerencie seus leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checkingStatus ? (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          ) : (
            <ScraperStatus available={scraperOk} />
          )}
          <button
            onClick={checkScraper}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Verificar status do scraper"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Aviso scraper offline */}
      {scraperOk === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? (
              <>
                <p className="font-semibold text-sm text-amber-900 mb-1">
                  Ambiente de Nuvem (Vercel)
                </p>
                <p className="text-amber-800 leading-relaxed">
                  O Google Maps Scraper roda localmente no Docker da sua máquina para extrair dados sem custos de proxy.
                  Para realizar novas buscas, abra o endereço local:
                </p>
                <div className="my-2 p-2 bg-amber-100/70 rounded-lg font-mono text-amber-950 font-medium">
                  <a href="http://127.0.0.1:5173/prospeccao" target="_blank" rel="noreferrer" className="underline hover:text-amber-700">
                    http://127.0.0.1:5173/prospeccao
                  </a>
                </div>
                <p className="text-amber-700">
                  💡 <strong>Na Vercel:</strong> você pode gerenciar todos os leads importados, editar textos e disparar mensagens na aba <strong>"Meus Leads"</strong>.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-amber-800 text-sm">Google Maps Scraper offline</p>
                <p className="text-amber-700 mt-1">
                  Para usar a busca, inicie o scraper localmente:
                </p>
                <ol className="text-amber-700 mt-2 space-y-1 list-decimal list-inside">
                  <li>Instale o <a href="https://www.docker.com/products/docker-desktop" target="_blank" rel="noopener noreferrer" className="underline">Docker Desktop</a></li>
                  <li>Inicie o container: <code className="bg-amber-100 px-1 rounded">docker compose -f c:\Users\guilherme\google-maps-scraper-kit\docker-compose.yml up -d</code></li>
                  <li>Verifique: <code className="bg-amber-100 px-1 rounded">curl http://localhost:8080/api/v1/jobs</code></li>
                </ol>
                <p className="text-amber-600 mt-2">
                  Você ainda pode gerenciar leads já importados na aba "Meus Leads".
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {(['busca', 'leads'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'busca' ? (
              <span className="flex items-center gap-1.5"><Search size={14} /> Buscar</span>
            ) : (
              <span className="flex items-center gap-2">
                <Users size={14} /> Meus Leads
                {leads.length > 0 && tab !== 'leads' && (
                  <span className="bg-brand-100 text-brand-700 text-xs px-1.5 py-0.5 rounded-full">
                    {leads.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA BUSCA ──────────────────────────────────────────────── */}
      {tab === 'busca' && (
        <div className="space-y-5">
          {/* Formulário de busca */}
          <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* O que procurar */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  O que procurar?
                </label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="pet shop, barbearia, restaurante..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                {/* Sugestões */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {CATEGORY_SUGGESTIONS.slice(0, 6).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setKeyword(s)}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600
                                 hover:bg-brand-100 hover:text-brand-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Localização */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Localização
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="São Caetano do Sul - SP"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {LOCATION_SUGGESTIONS.slice(0, 4).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLocation(s)}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600
                                 hover:bg-brand-100 hover:text-brand-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filtros avançados */}
            <div>
              <button
                type="button"
                onClick={() => setShowFilters(v => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Filter size={13} />
                Filtros avançados
                <ChevronDown size={13} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Máx. resultados
                    </label>
                    <select
                      value={maxResults}
                      onChange={e => setMaxResults(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="50">50</option>
                      <option value="100">100 (mais lento)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Avaliação mínima
                    </label>
                    <select
                      value={filterMinRating}
                      onChange={e => setFilterMinRating(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2
                                 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="0">Qualquer</option>
                      <option value="3">≥ 3.0 ⭐</option>
                      <option value="3.5">≥ 3.5 ⭐</option>
                      <option value="4">≥ 4.0 ⭐</option>
                      <option value="4.5">≥ 4.5 ⭐</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 justify-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterSemSite}
                        onChange={e => setFilterSemSite(e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        🎯 Somente sem site
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterComTelefone}
                        onChange={e => setFilterComTelefone(e.target.checked)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-xs text-slate-700">Somente com telefone</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">
                Pesquisa iniciada manualmente · Rate limits aplicam-se
              </p>
              <button
                type="submit"
                disabled={searching || !keyword.trim() || !location.trim() || scraperOk === false}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium
                           rounded-lg hover:bg-brand-700 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <><Loader2 size={15} className="animate-spin" /> Buscando...</>
                ) : (
                  <><Search size={15} /> Buscar no Google Maps</>
                )}
              </button>
            </div>

            {/* Progresso */}
            {searching && searchProgress && (
              <p className="text-xs text-brand-600 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {searchProgress}
              </p>
            )}
          </form>

          {/* Erro */}
          {searchError && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {searchError}
            </div>
          )}

          {/* Resultados */}
          {filteredResults.length > 0 && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-700">
                    {filteredResults.length} resultado(s)
                    {filteredResults.filter(r => !r.website || r.website.trim() === '').length > 0 && (
                      <span className="ml-2 text-orange-600 font-semibold">
                        · {filteredResults.filter(r => !r.website || r.website.trim() === '').length} sem site
                      </span>
                    )}
                  </p>
                  <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">
                    Selecionar todos
                  </button>
                  {selected.size > 0 && (
                    <button onClick={clearSelection} className="text-xs text-slate-500 hover:underline">
                      Limpar ({selected.size})
                    </button>
                  )}
                </div>

                {/* Import */}
                <div className="flex items-center gap-2">
                  {importResult && (
                    <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                      {importResult}
                    </span>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={selected.size === 0 || importingIds}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                               bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importingIds ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Import size={14} />
                    )}
                    Importar {selected.size > 0 ? `(${selected.size})` : 'selecionados'}
                  </button>
                </div>
              </div>

              {/* Grid de resultados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredResults.map((item, idx) => (
                  <SearchResultCard
                    key={idx}
                    item={item}
                    selected={selected.has(idx)}
                    onToggle={() => toggleSelect(idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA LEADS ──────────────────────────────────────────────── */}
      {tab === 'leads' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={filterLeadStatus}
              onChange={e => setFilterLeadStatus(e.target.value as ProspectStatus | 'todos')}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2
                         focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterLeadSemSite}
                onChange={e => setFilterLeadSemSite(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">🎯 Sem site</span>
            </label>
            <button
              onClick={loadLeads}
              className="ml-auto flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700
                         px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={13} />
              Atualizar
            </button>
          </div>

          {/* Erro */}
          {leadsError && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {leadsError}
            </div>
          )}

          {/* Loading */}
          {loadingLeads && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-brand-400" />
            </div>
          )}

          {/* Lista de leads */}
          {!loadingLeads && leads.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum lead ainda</p>
              <p className="text-sm mt-1">Busque no Google Maps e importe estabelecimentos</p>
              <button
                onClick={() => setTab('busca')}
                className="mt-4 text-sm text-brand-600 hover:underline"
              >
                Ir para Busca →
              </button>
            </div>
          )}

          {!loadingLeads && leads.length > 0 && (
            <>
              <p className="text-sm text-slate-500">{leads.length} lead(s)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {leads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    prospect={lead}
                    onWhatsApp={setWaProspect}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteLead}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal WhatsApp */}
      {waProspect && (
        <WhatsAppModal
          prospect={waProspect}
          onClose={() => setWaProspect(null)}
          onSaved={handleMessageSaved}
        />
      )}
    </div>
  );
}

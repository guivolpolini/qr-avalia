import { useState } from 'react';
import {
  X,
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { generateGoogleReviewLink, type GeneratedReviewLink } from '@/lib/googleReviewLinkGenerator';

interface GoogleReviewGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLink?: (link: string) => void;
  initialInput?: string;
  initialEstablishmentName?: string;
}

export default function GoogleReviewGeneratorModal({
  isOpen,
  onClose,
  onSelectLink,
  initialInput = '',
  initialEstablishmentName = '',
}: GoogleReviewGeneratorModalProps) {
  const [inputUrl, setInputUrl] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedReviewLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateGoogleReviewLink(inputUrl.trim());
      if (res) {
        setResult(res);
      } else {
        setError(
          'Não conseguimos extrair o Place ID deste link. Cole o link de compartilhamento do Google Maps (ex: maps.app.goo.gl/... ou google.com/maps/place/...).'
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar link.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result?.reviewUrl) return;
    navigator.clipboard.writeText(result.reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleApply() {
    if (!result?.reviewUrl) return;
    if (onSelectLink) {
      onSelectLink(result.reviewUrl);
    }
    onClose();
  }

  const mapsSearchUrl = inputUrl.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(inputUrl.trim())}`
    : initialEstablishmentName.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(initialEstablishmentName.trim())}`
    : 'https://www.google.com/maps';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 animate-slide-up sm:animate-scale-in max-h-[92vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        {/* Puxador mobile */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Gerador de Link de Avaliação Google
              </h2>
              <p className="text-xs text-slate-400">
                Gera o link direto que abre o pop-up de 5 estrelas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Formulário de Input */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Cole o Link do Google Maps da Empresa
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... ou google.com/maps/place/..."
                  className="input text-sm py-3 pr-24"
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !inputUrl.trim()}
                  className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : 'Gerar'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Aceita links do app, navegador ou Place ID</span>
              <a
                href={mapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
              >
                <Search size={12} />
                Buscar no Maps
              </a>
            </div>
          </form>

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">{error}</p>
                <p className="text-[11px] text-red-600">
                  Dica: Abra a empresa no aplicativo Google Maps no celular, toque em <strong>Compartilhar</strong> ➔ <strong>Copiar link</strong> e cole aqui.
                </p>
              </div>
            </div>
          )}

          {/* Resultado Gerado com Sucesso */}
          {result && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4 animate-scale-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Link de 5 Estrelas Gerado!</span>
                </div>
                <div className="flex items-center gap-0.5 text-amber-500">
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                  <Star size={13} fill="currentColor" />
                </div>
              </div>

              {/* Caixa com a URL */}
              <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Link Direto de Avaliação:
                </span>
                <p className="font-mono text-xs text-slate-800 break-all select-all font-medium">
                  {result.reviewUrl}
                </p>
                {result.placeId && (
                  <p className="text-[10px] text-slate-400">
                    Google Place ID: <span className="font-mono font-semibold">{result.placeId}</span>
                  </p>
                )}
              </div>

              {/* Ações */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={result.reviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  Testar Pop-up
                </a>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>

              {onSelectLink && (
                <button
                  type="button"
                  onClick={handleApply}
                  className="btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Check size={16} />
                  Aplicar este Link no Estabelecimento
                </button>
              )}
            </div>
          )}

          {/* Dica / Passo a Passo Visual */}
          {!result && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <LinkIcon size={14} className="text-brand-600" />
                Como pegar o link de qualquer loja em 10 segundos:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Abra o <strong>Google Maps</strong> (no celular ou PC).</li>
                <li>Pesquise o nome da empresa do seu cliente.</li>
                <li>Toque no botão <strong>Compartilhar</strong> e clique em <strong>Copiar link</strong>.</li>
                <li>Cole aqui em cima e clique em <strong>Gerar</strong>!</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

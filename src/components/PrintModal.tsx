import { useState } from 'react';
import { X, Printer, Star, Smartphone, Settings2, CheckSquare, Square } from 'lucide-react';

export type TemplateTipo = 'mesa' | 'quadrada' | 'a4';

export interface PlacaParaImpressao {
  id: string;
  codigo: string;
  estabelecimentoNome?: string;
  qrDataUrl?: string;
}

interface PrintModalProps {
  placas: PlacaParaImpressao[];
  initialPlacaId?: string;
  onClose: () => void;
}

export default function PrintModal({ placas, initialPlacaId, onClose }: PrintModalProps) {
  const [template, setTemplate] = useState<TemplateTipo>('mesa');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialPlacaId ? [initialPlacaId] : placas.map((p) => p.id)
  );
  const [showEstNome, setShowEstNome] = useState(true);
  const [showCodigo, setShowCodigo] = useState(true);
  const [showNfcHint, setShowNfcHint] = useState(true);
  const [customMsg, setCustomMsg] = useState('Sua avaliação é muito importante para nós!');

  const placasSelecionadas = placas.filter((p) => selectedIds.includes(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === placas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(placas.map((p) => p.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ── Modal interativo na tela (oculto no @media print via no-print) ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm no-print animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Printer size={22} className="text-brand-600" />
                Gabarito de Impressão e PDF
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha o modelo gráfico, personalize as opções e imprima ou salve em PDF em alta resolução.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} disabled={placasSelecionadas.length === 0} className="btn-primary py-2 px-4 shadow">
                <Printer size={16} />
                Imprimir / Salvar PDF
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body: 2 colunas (Controles à esquerda, Pré-visualização à direita) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Controles */}
            <div className="lg:col-span-4 p-5 border-r border-slate-200 overflow-y-auto space-y-5 bg-slate-50/30">
              {/* Modelo */}
              <div>
                <label className="label flex items-center gap-1.5 mb-2">
                  <Settings2 size={16} className="text-brand-600" />
                  Modelo de Placa
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplate('mesa')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      template === 'mesa'
                        ? 'border-brand-600 bg-brand-50/80 text-brand-900 ring-2 ring-brand-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-0.5">Display Mesa</div>
                    <div className="text-[10px] text-slate-500">10 x 15 cm</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplate('quadrada')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      template === 'quadrada'
                        ? 'border-brand-600 bg-brand-50/80 text-brand-900 ring-2 ring-brand-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-0.5">Quadrada</div>
                    <div className="text-[10px] text-slate-500">10 x 10 cm</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplate('a4')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      template === 'a4'
                        ? 'border-brand-600 bg-brand-50/80 text-brand-900 ring-2 ring-brand-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-0.5">Folha A4</div>
                    <div className="text-[10px] text-slate-500">6 por folha</div>
                  </button>
                </div>
              </div>

              {/* Mensagem e Opções */}
              <div>
                <label className="label">Mensagem de Incentivo</label>
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Ex: Sua avaliação é muito importante!"
                  className="input text-xs"
                />
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showEstNome}
                    onChange={(e) => setShowEstNome(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 border-slate-300"
                  />
                  Exibir nome do estabelecimento
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showNfcHint}
                    onChange={(e) => setShowNfcHint(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 border-slate-300"
                  />
                  Exibir chamada de aproximação NFC
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showCodigo}
                    onChange={(e) => setShowCodigo(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 border-slate-300"
                  />
                  Exibir identificador da placa (ex: QR001)
                </label>
              </div>

              {/* Seleção de Placas */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Placas a Imprimir ({selectedIds.length}/{placas.length})
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] text-brand-600 hover:underline font-medium"
                  >
                    {selectedIds.length === placas.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {placas.map((placa) => {
                    const isSelected = selectedIds.includes(placa.id);
                    return (
                      <div
                        key={placa.id}
                        onClick={() => toggleSelect(placa.id)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                          isSelected ? 'bg-white border-brand-300 shadow-xs' : 'bg-slate-100/60 border-transparent text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare size={15} className="text-brand-600 shrink-0" />
                          ) : (
                            <Square size={15} className="text-slate-400 shrink-0" />
                          )}
                          <span className="font-mono font-bold text-slate-800">{placa.codigo}</span>
                          <span className="truncate text-slate-500">{placa.estabelecimentoNome || 'Sem estabelecimento'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Pré-visualização na Tela */}
            <div className="lg:col-span-8 p-6 bg-slate-200/60 overflow-y-auto flex flex-col items-center justify-start">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 self-start">
                Pré-visualização ({placasSelecionadas.length} {placasSelecionadas.length === 1 ? 'placa' : 'placas'})
              </div>

              {placasSelecionadas.length === 0 ? (
                <div className="my-auto text-center text-slate-400 text-sm">
                  Selecione ao menos uma placa para visualizar e imprimir.
                </div>
              ) : (
                <div className="w-full flex flex-wrap justify-center gap-6">
                  {placasSelecionadas.map((placa) => (
                    <PlacaArte
                      key={placa.id}
                      placa={placa}
                      template={template}
                      showEstNome={showEstNome}
                      showCodigo={showCodigo}
                      showNfcHint={showNfcHint}
                      customMsg={customMsg}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Estrutura exclusiva de impressão (@media print) ── */}
      <div className="hidden print-only">
        <div className={template === 'a4' ? 'grid grid-cols-2 gap-4' : 'space-y-8'}>
          {placasSelecionadas.map((placa) => (
            <div key={`print-${placa.id}`} className={template === 'a4' ? 'break-inside-avoid' : 'break-after-page'}>
              <PlacaArte
                placa={placa}
                template={template}
                showEstNome={showEstNome}
                showCodigo={showCodigo}
                showNfcHint={showNfcHint}
                customMsg={customMsg}
                isPrintOutput
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

interface PlacaArteProps {
  placa: PlacaParaImpressao;
  template: TemplateTipo;
  showEstNome: boolean;
  showCodigo: boolean;
  showNfcHint: boolean;
  customMsg: string;
  isPrintOutput?: boolean;
}

function PlacaArte({
  placa,
  template,
  showEstNome,
  showCodigo,
  showNfcHint,
  customMsg,
  isPrintOutput = false,
}: PlacaArteProps) {
  const isA4 = template === 'a4';
  const isQuadrada = template === 'quadrada';

  // Dimensões estilizadas para preview e para impressão física
  const sizeClasses = isQuadrada
    ? 'w-[280px] h-[280px] sm:w-[320px] sm:h-[320px]'
    : isA4
    ? 'w-[260px] h-[330px]'
    : 'w-[290px] h-[410px] sm:w-[320px] sm:h-[450px]';

  return (
    <div
      className={`relative bg-white rounded-2xl border border-slate-300 shadow-md flex flex-col items-center justify-between p-6 text-center select-none ${sizeClasses} ${
        isPrintOutput ? 'shadow-none border-dashed border-slate-400' : ''
      }`}
      style={{
        pageBreakInside: 'avoid',
      }}
    >
      {/* Guias de corte para folha A4 */}
      {isA4 && isPrintOutput && (
        <div className="absolute inset-0 border border-dashed border-slate-400 pointer-events-none rounded-none" />
      )}

      {/* Topo: Logo Google & Estrelas */}
      <div className="w-full flex flex-col items-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 mb-2">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="text-[11px] font-bold text-slate-700 tracking-tight">Avaliações do Google</span>
        </div>

        <div className="flex items-center gap-0.5 text-amber-400 mb-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={isQuadrada ? 14 : 16} fill="currentColor" strokeWidth={0} />
          ))}
        </div>

        <h3 className={`font-extrabold text-slate-900 leading-snug ${isQuadrada ? 'text-xs' : 'text-sm'}`}>
          Sua opinião vale muito!
        </h3>
        {customMsg && (
          <p className="text-[10px] text-slate-500 max-w-[220px] mt-0.5 line-clamp-1">{customMsg}</p>
        )}
      </div>

      {/* Centro: QR Code em Alta Resolução */}
      <div className="relative my-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
        {placa.qrDataUrl ? (
          <img
            src={placa.qrDataUrl}
            alt={placa.codigo}
            className={isQuadrada ? 'w-24 h-24 sm:w-28 sm:h-28' : 'w-32 h-32 sm:w-36 sm:h-36'}
          />
        ) : (
          <div className="w-32 h-32 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
            Gerando QR...
          </div>
        )}
      </div>

      {/* Base: NFC & Identificação */}
      <div className="w-full flex flex-col items-center">
        {showNfcHint && (
          <div className="flex items-center gap-1.5 text-slate-700 mb-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-full">
            <Smartphone size={13} className="text-brand-600" />
            <span className="text-[10px] font-semibold">Aponte a câmera ou aproxime (NFC)</span>
          </div>
        )}

        {showEstNome && placa.estabelecimentoNome && (
          <p className="font-bold text-slate-900 text-xs truncate max-w-[240px]">
            {placa.estabelecimentoNome}
          </p>
        )}

        {showCodigo && (
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">
            {placa.codigo}
          </span>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Store,
  QrCode as QrIcon,
  Plus,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Link2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

interface ActivatePlacaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialCode?: string;
}

type Step = 'scan' | 'confirm' | 'success';

interface FoundPlaca {
  id: string;
  codigo: string;
  ativo: boolean;
  estabelecimento_id: string | null;
  estabelecimento?: { id: string; nome: string; link_google?: string } | null;
}

function extrairCodigo(raw: string): string {
  const clean = raw.trim();
  const match = clean.match(/\/(q|n)\/([^/?#]+)/i);
  if (match && match[2]) {
    return match[2].toUpperCase();
  }
  return clean.toUpperCase();
}

export default function ActivatePlacaModal({ isOpen, onClose, onSuccess, initialCode }: ActivatePlacaModalProps) {
  const [step, setStep] = useState<Step>('scan');
  const [manualCode, setManualCode] = useState(initialCode || '');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Placa identificada
  const [placa, setPlaca] = useState<FoundPlaca | null>(null);
  const [isNewPlaca, setIsNewPlaca] = useState(false);

  // Estabelecimentos
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [selectedEstId, setSelectedEstId] = useState('');
  const [showNewEstForm, setShowNewEstForm] = useState(false);
  const [newEstNome, setNewEstNome] = useState('');
  const [newEstLink, setNewEstLink] = useState('');
  const [newEstWhats, setNewEstWhats] = useState('');

  // NFC associada opcional
  const [vincularNfcJunto, setVincularNfcJunto] = useState(true);
  const [matchingNfcCode, setMatchingNfcCode] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'interactive-qr-reader';

  // Carrega estabelecimentos ao abrir
  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('estabelecimentos')
      .select('*')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => {
        setEstabelecimentos(data || []);
      });
  }, [isOpen]);

  // Se veio com initialCode
  useEffect(() => {
    if (isOpen && initialCode) {
      handleLookupCode(initialCode);
    }
  }, [isOpen, initialCode]);

  // Desliga câmera de forma segura
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Erro ao parar câmera:', err);
      } finally {
        html5QrCodeRef.current = null;
        setCameraActive(false);
      }
    }
  }, []);

  // Inicia câmera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      await stopCamera();
      const qrScanner = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          const code = extrairCodigo(decodedText);
          if (code) {
            await stopCamera();
            handleLookupCode(code);
          }
        },
        () => {
          // Erro normal de frame sem QR
        }
      );
      setCameraActive(true);
    } catch (err: any) {
      console.error('Falha ao iniciar câmera:', err);
      setCameraError(
        err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError'
          ? 'Permissão de câmera negada. Digite o código da placa abaixo.'
          : 'Não foi possível acessar a câmera. Digite o código manualmente.'
      );
      setCameraActive(false);
    }
  }, [stopCamera]);

  // Gerencia ciclo de vida da câmera ao abrir/fechar modal
  useEffect(() => {
    if (isOpen && step === 'scan' && !initialCode) {
      // Pequeno timeout para dar tempo do elemento DOM ser montado
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, step, initialCode, startCamera, stopCamera]);

  // Busca placa no Supabase
  async function handleLookupCode(rawCode: string) {
    const code = extrairCodigo(rawCode);
    if (!code) return;

    setSearching(true);
    setCameraError(null);

    try {
      // 1. Procura na tabela qr_codes
      const { data: existing, error } = await supabase
        .from('qr_codes')
        .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
        .eq('codigo', code)
        .maybeSingle();

      if (error) throw error;

      // 2. Procura se existe uma NFC correspondente (ex: se o QR é QR001, busca NFC001)
      const numMatch = code.match(/\d+/);
      let nfcCodeCandidate: string | null = null;
      if (numMatch) {
        nfcCodeCandidate = `NFC${numMatch[0]}`;
        const { data: nfcTag } = await supabase
          .from('nfc_tags')
          .select('codigo')
          .eq('codigo', nfcCodeCandidate)
          .maybeSingle();
        setMatchingNfcCode(nfcTag ? nfcCodeCandidate : null);
      } else {
        setMatchingNfcCode(null);
      }

      if (existing) {
        setPlaca(existing as unknown as FoundPlaca);
        setIsNewPlaca(false);
        setSelectedEstId(existing.estabelecimento_id || '');
      } else {
        // Placa nova, não cadastrada ainda
        setPlaca({
          id: '',
          codigo: code,
          ativo: true,
          estabelecimento_id: null,
          estabelecimento: null,
        });
        setIsNewPlaca(true);
        setSelectedEstId('');
      }

      setStep('confirm');
    } catch (err: any) {
      console.error('Erro ao consultar placa:', err);
      setCameraError('Erro ao consultar o código no banco. Tente novamente.');
    } finally {
      setSearching(false);
    }
  }

  // Salvar ativação
  async function handleSaveActivation() {
    if (!placa) return;
    setSaving(true);

    try {
      let finalEstId = selectedEstId;

      // Se optou por criar novo estabelecimento inline
      if (showNewEstForm) {
        if (!newEstNome.trim() || !newEstLink.trim()) {
          alert('Preencha pelo menos o Nome e o Link do Google do novo estabelecimento.');
          setSaving(false);
          return;
        }

        const { data: newEst, error: estErr } = await supabase
          .from('estabelecimentos')
          .insert({
            nome: newEstNome.trim(),
            link_google: newEstLink.trim(),
            telefone: newEstWhats.trim(),
            ativo: true,
          })
          .select()
          .single();

        if (estErr || !newEst) throw estErr;
        finalEstId = newEst.id;
      }

      if (!finalEstId) {
        alert('Selecione ou cadastre um estabelecimento para vincular a placa.');
        setSaving(false);
        return;
      }

      // Atualiza ou insere a placa QR
      if (isNewPlaca) {
        const { data: inserted, error: insertErr } = await supabase
          .from('qr_codes')
          .insert({
            codigo: placa.codigo,
            estabelecimento_id: finalEstId,
            ativo: true,
          })
          .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
          .single();

        if (insertErr) throw insertErr;
        setPlaca(inserted as unknown as FoundPlaca);
      } else {
        const { error: updateErr } = await supabase
          .from('qr_codes')
          .update({
            estabelecimento_id: finalEstId,
            ativo: true,
          })
          .eq('id', placa.id);

        if (updateErr) throw updateErr;

        // Atualiza estado local para tela de sucesso
        const estObj = estabelecimentos.find((e) => e.id === finalEstId);
        setPlaca((prev) =>
          prev
            ? {
                ...prev,
                estabelecimento_id: finalEstId,
                estabelecimento: estObj ? { id: estObj.id, nome: estObj.nome, link_google: estObj.link_google } : null,
              }
            : null
        );
      }

      // Se houver NFC correspondente e o usuário quiser vincular junto
      if (matchingNfcCode && vincularNfcJunto) {
        await supabase
          .from('nfc_tags')
          .update({
            estabelecimento_id: finalEstId,
            ativo: true,
          })
          .eq('codigo', matchingNfcCode);
      }

      if (onSuccess) onSuccess();
      setStep('success');
    } catch (err: any) {
      console.error('Erro ao ativar placa:', err);
      alert(`Erro ao ativar placa: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setStep('scan');
    setManualCode('');
    setPlaca(null);
    setIsNewPlaca(false);
    setSelectedEstId('');
    setShowNewEstForm(false);
    setNewEstNome('');
    setNewEstLink('');
    setNewEstWhats('');
  }

  if (!isOpen) return null;

  const publicTestUrl = placa?.codigo ? `${window.location.origin}/q/${placa.codigo}` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={() => {
          stopCamera();
          onClose();
        }}
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 animate-slide-up sm:animate-scale-in max-h-[92vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]">
        {/* Puxador para mobile */}
        <div className="sm:hidden pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {step === 'scan' && 'Escanear ou Identificar Placa'}
                {step === 'confirm' && 'Vincular ao Estabelecimento'}
                {step === 'success' && 'Placa Ativada com Sucesso!'}
              </h2>
              <p className="text-xs text-slate-400">
                {step === 'scan' && 'Aponte para o QR Code da placa'}
                {step === 'confirm' && `Código identificado: ${placa?.codigo}`}
                {step === 'success' && 'Pronta para uso na mesa do cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body com Scroll */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* ──────────────── STEP 1: SCAN OU DIGITAR ──────────────── */}
          {step === 'scan' && (
            <div className="space-y-4">
              {/* Leitor de Câmera */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-square max-w-[280px] mx-auto flex items-center justify-center shadow-inner">
                <div id={scannerContainerId} className="w-full h-full" />

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <Loader2 size={32} className="animate-spin text-brand-500 mb-2" />
                    <span className="text-xs">Iniciando câmera traseira...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-amber-300 p-4 text-center space-y-2">
                    <AlertTriangle size={30} className="text-amber-400" />
                    <span className="text-xs font-medium text-slate-200">{cameraError}</span>
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold mt-2 transition-colors"
                    >
                      Tentar câmera novamente
                    </button>
                  </div>
                )}

                {/* Mira e animação de scanner */}
                {cameraActive && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-brand-500 rounded-xl relative shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]">
                      <div className="absolute inset-x-0 h-0.5 bg-brand-400 animate-pulse top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div className="relative text-center my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Ou digite o código
                </span>
              </div>

              {/* Digitar código manual */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <QrIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: QR001 ou cole a URL"
                    className="input pl-10 text-sm font-mono uppercase tracking-wider"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupCode(manualCode);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupCode(manualCode)}
                  disabled={!manualCode.trim() || searching}
                  className="btn-primary px-5 shrink-0"
                >
                  {searching ? <Loader2 size={16} className="animate-spin" /> : 'Buscar'}
                </button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 2: CONFIRMAR E VINCULAR ──────────────── */}
          {step === 'confirm' && placa && (
            <div className="space-y-5 animate-fade-in">
              {/* Card de Identificação da Placa */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Código da Placa</span>
                  <span
                    className={`badge ${
                      isNewPlaca
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : placa.estabelecimento
                        ? 'bg-blue-50 text-brand-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isNewPlaca ? 'Nova (Não cadastrada)' : placa.estabelecimento ? 'Já vinculada' : 'Disponível'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                    <QrIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{placa.codigo}</h3>
                    <p className="text-xs text-slate-500">
                      {placa.estabelecimento
                        ? `Atualmente associada a: ${placa.estabelecimento.nome}`
                        : 'Pronta para ser ativada em um cliente'}
                    </p>
                  </div>
                </div>

                {matchingNfcCode && (
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Link2 size={14} className="text-teal-600" />
                      Tag NFC correspondente ({matchingNfcCode})
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-teal-700">
                      <input
                        type="checkbox"
                        checked={vincularNfcJunto}
                        onChange={(e) => setVincularNfcJunto(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      Vincular junto
                    </label>
                  </div>
                )}
              </div>

              {/* Seleção do Estabelecimento */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Estabelecimento de Destino</label>
                  <button
                    type="button"
                    onClick={() => setShowNewEstForm(!showNewEstForm)}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    {showNewEstForm ? 'Escolher existente' : 'Cadastrar novo no local'}
                  </button>
                </div>

                {showNewEstForm ? (
                  /* Formulário Rápido de Novo Estabelecimento */
                  <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-100 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-900 mb-1">
                      <Sparkles size={14} className="text-brand-600" />
                      <span>Cadastro Express de Estabelecimento</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Nome do Local *</label>
                      <input
                        type="text"
                        required
                        value={newEstNome}
                        onChange={(e) => setNewEstNome(e.target.value)}
                        placeholder="Ex: Pizzaria Fornalha"
                        className="input text-sm py-2"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                        Link de Avaliação do Google *
                      </label>
                      <input
                        type="url"
                        required
                        value={newEstLink}
                        onChange={(e) => setNewEstLink(e.target.value)}
                        placeholder="https://g.page/r/.../review"
                        className="input text-sm py-2"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                        WhatsApp do Gerente (Opcional)
                      </label>
                      <input
                        type="tel"
                        value={newEstWhats}
                        onChange={(e) => setNewEstWhats(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="input text-sm py-2"
                      />
                    </div>
                  </div>
                ) : (
                  /* Select de Estabelecimentos Existentes */
                  <div className="relative">
                    <Store size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedEstId}
                      onChange={(e) => setSelectedEstId(e.target.value)}
                      className="input pl-10 text-sm font-medium"
                    >
                      <option value="">Selecione o estabelecimento...</option>
                      {estabelecimentos.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome} {e.endereco ? `(${e.endereco})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleReset} className="btn-secondary flex-1 py-3 text-sm">
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSaveActivation}
                  disabled={saving || (!selectedEstId && !showNewEstForm)}
                  className="btn-primary flex-2 py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar Ativação'}
                  {!saving && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 3: SUCESSO E TESTE ──────────────── */}
          {step === 'success' && placa && (
            <div className="text-center py-4 space-y-5 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-100">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Placa Ativada com Sucesso!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  O redirecionamento dinâmico já está funcionando perfeitamente.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Código:</span>
                  <span className="font-mono font-bold text-slate-800">{placa.codigo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estabelecimento:</span>
                  <span className="font-bold text-brand-600">{placa.estabelecimento?.nome || 'Vinculado'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destino:</span>
                  <span className="text-slate-600 truncate max-w-[200px]" title={placa.estabelecimento?.link_google}>
                    {placa.estabelecimento?.link_google || 'Link Google'}
                  </span>
                </div>
                {matchingNfcCode && vincularNfcJunto && (
                  <div className="flex justify-between pt-1 border-t border-slate-200/60 text-teal-700 font-medium">
                    <span>NFC Vinculado:</span>
                    <span className="font-mono font-bold">{matchingNfcCode}</span>
                  </div>
                )}
              </div>

              {/* Botão Principal de Testar Placa */}
              <div className="space-y-2 pt-2">
                <a
                  href={publicTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 active:scale-95 transition-transform"
                >
                  <ExternalLink size={18} />
                  Testar Placa Agora (Abrir Google)
                </a>

                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                  }}
                  className="btn-secondary w-full py-2.5 text-xs text-slate-600"
                >
                  Ativar outra placa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

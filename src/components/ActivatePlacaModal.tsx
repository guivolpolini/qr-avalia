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
  Nfc as NfcIcon,
  Plus,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Link2,
  Copy,
  Check,
  Radio,
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
  tipo: 'qr' | 'nfc';
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

  // Gravação NFC
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [nfcWriting, setNfcWriting] = useState(false);
  const [nfcWriteSuccess, setNfcWriteSuccess] = useState(false);
  const [nfcWriteError, setNfcWriteError] = useState<string | null>(null);

  const canWebNfc = typeof window !== 'undefined' && 'NDEFReader' in window;

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
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(20);
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

  // Busca placa ou tag no Supabase com detecção automática do tipo
  async function handleLookupCode(rawCode: string) {
    const code = extrairCodigo(rawCode);
    if (!code) return;

    setSearching(true);
    setCameraError(null);

    try {
      const isNfcByPrefix = code.startsWith('NFC');
      let foundTipo: 'qr' | 'nfc' = isNfcByPrefix ? 'nfc' : 'qr';
      let existingItem: any = null;

      if (isNfcByPrefix) {
        // 1. Procura primeiro na tabela nfc_tags
        const { data: nfcData, error: nfcErr } = await supabase
          .from('nfc_tags')
          .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
          .eq('codigo', code)
          .maybeSingle();

        if (nfcErr) throw nfcErr;
        if (nfcData) {
          existingItem = nfcData;
          foundTipo = 'nfc';
        } else {
          // Fallback: talvez esteja em qr_codes
          const { data: qrData } = await supabase
            .from('qr_codes')
            .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
            .eq('codigo', code)
            .maybeSingle();
          if (qrData) {
            existingItem = qrData;
            foundTipo = 'qr';
          }
        }
      } else {
        // 1. Procura primeiro na tabela qr_codes
        const { data: qrData, error: qrErr } = await supabase
          .from('qr_codes')
          .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
          .eq('codigo', code)
          .maybeSingle();

        if (qrErr) throw qrErr;
        if (qrData) {
          existingItem = qrData;
          foundTipo = 'qr';
        } else {
          // Fallback: talvez seja uma tag nfc sem prefixo
          const { data: nfcData } = await supabase
            .from('nfc_tags')
            .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
            .eq('codigo', code)
            .maybeSingle();
          if (nfcData) {
            existingItem = nfcData;
            foundTipo = 'nfc';
          }
        }
      }

      // Procura código par correspondente (se QR001 -> busca NFC001; se NFC001 -> busca QR001)
      const numMatch = code.match(/\d+/);
      let counterpartCode: string | null = null;

      if (numMatch) {
        const num = numMatch[0];
        counterpartCode = foundTipo === 'qr' ? `NFC${num}` : `QR${num}`;
      }

      setMatchingNfcCode(counterpartCode);
      setVincularNfcJunto(true);

      if (existingItem) {
        setPlaca({
          id: existingItem.id,
          codigo: existingItem.codigo,
          tipo: foundTipo,
          ativo: existingItem.ativo,
          estabelecimento_id: existingItem.estabelecimento_id || null,
          estabelecimento: existingItem.estabelecimento || null,
        });
        setIsNewPlaca(false);
        setSelectedEstId(existingItem.estabelecimento_id || '');
      } else {
        // Placa ou tag nova, não cadastrada ainda
        setPlaca({
          id: '',
          codigo: code,
          tipo: foundTipo,
          ativo: true,
          estabelecimento_id: null,
          estabelecimento: null,
        });
        setIsNewPlaca(true);
        setSelectedEstId('');
      }

      setStep('confirm');
    } catch (err: any) {
      console.error('Erro ao consultar placa/tag:', err);
      setCameraError('Erro ao consultar o código no banco. Tente novamente.');
    } finally {
      setSearching(false);
    }
  }

  // Salvar ativação de QR Code ou Tag NFC
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

      const isNfc = placa.tipo === 'nfc';
      const primaryTable = isNfc ? 'nfc_tags' : 'qr_codes';
      const dynamicUrl = `${window.location.origin}/${isNfc ? 'n' : 'q'}/${placa.codigo}`;

      if (isNewPlaca) {
        const insertPayload: any = {
          codigo: placa.codigo,
          estabelecimento_id: finalEstId,
          ativo: true,
        };
        if (isNfc) {
          insertPayload.url_dinamica = dynamicUrl;
        }

        const { data: inserted, error: insertErr } = await supabase
          .from(primaryTable)
          .insert(insertPayload)
          .select('*, estabelecimento:estabelecimento_id(id, nome, link_google)')
          .single();

        if (insertErr) throw insertErr;
        setPlaca({
          id: inserted.id,
          codigo: inserted.codigo,
          tipo: placa.tipo,
          ativo: inserted.ativo,
          estabelecimento_id: finalEstId,
          estabelecimento: inserted.estabelecimento,
        });
      } else {
        const updatePayload: any = {
          estabelecimento_id: finalEstId,
          ativo: true,
        };
        if (isNfc) {
          updatePayload.url_dinamica = dynamicUrl;
        }

        const { error: updateErr } = await supabase
          .from(primaryTable)
          .update(updatePayload)
          .eq('id', placa.id);

        if (updateErr) throw updateErr;

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

      // Se houver código par correspondente (ex: QR001 <-> NFC001) e vincular junto
      if (matchingNfcCode && vincularNfcJunto) {
        const secondaryTable = isNfc ? 'qr_codes' : 'nfc_tags';
        const secondaryUrl = `${window.location.origin}/${isNfc ? 'q' : 'n'}/${matchingNfcCode}`;

        const { data: existingSec } = await supabase
          .from(secondaryTable)
          .select('id')
          .eq('codigo', matchingNfcCode)
          .maybeSingle();

        if (existingSec) {
          await supabase
            .from(secondaryTable)
            .update({
              estabelecimento_id: finalEstId,
              ativo: true,
            })
            .eq('id', existingSec.id);
        } else {
          const secPayload: any = {
            codigo: matchingNfcCode,
            estabelecimento_id: finalEstId,
            ativo: true,
          };
          if (!isNfc) {
            secPayload.url_dinamica = secondaryUrl;
          }
          await supabase.from(secondaryTable).insert(secPayload);
        }
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([30, 50, 30]);
      }

      if (onSuccess) onSuccess();
      setStep('success');
    } catch (err: any) {
      console.error('Erro ao ativar placa/tag:', err);
      alert(`Erro ao ativar: ${err?.message || 'Tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  }

  // Gravação via Web NFC direta no navegador
  async function handleWriteNfc(urlToWrite: string) {
    if (!canWebNfc) {
      alert('A gravação direta via navegador está disponível no Google Chrome para Android com NFC ativado. No iPhone, use o aplicativo gratuito NFC Tools.');
      return;
    }

    setNfcWriting(true);
    setNfcWriteError(null);
    setNfcWriteSuccess(false);

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.write({
        records: [
          {
            recordType: 'url',
            data: urlToWrite,
          },
        ],
      });
      setNfcWriteSuccess(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([50, 100, 50]);
      }
    } catch (err: any) {
      console.error('Erro ao gravar NFC:', err);
      setNfcWriteError(err?.message || 'Falha ao gravar na tag. Verifique se o NFC do celular está ativado e aproxime novamente.');
    } finally {
      setNfcWriting(false);
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
    setCopiedUrl(false);
    setNfcWriting(false);
    setNfcWriteSuccess(false);
    setNfcWriteError(null);
  }

  if (!isOpen) return null;

  const isNfc = placa?.tipo === 'nfc';
  const publicTestUrl = placa?.codigo
    ? `${window.location.origin}/${isNfc ? 'n' : 'q'}/${placa.codigo}`
    : '';
  const nfcUrlToRecord = isNfc
    ? publicTestUrl
    : matchingNfcCode
    ? `${window.location.origin}/n/${matchingNfcCode}`
    : '';

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
              {step === 'scan' && <Camera size={18} />}
              {step === 'confirm' && (isNfc ? <NfcIcon size={18} /> : <QrIcon size={18} />)}
              {step === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {step === 'scan' && 'Escanear ou Identificar Placa'}
                {step === 'confirm' && `Vincular ${isNfc ? 'Tag NFC' : 'Placa QR'}`}
                {step === 'success' && `${isNfc ? 'Tag NFC' : 'Placa'} Ativada com Sucesso!`}
              </h2>
              <p className="text-xs text-slate-400">
                {step === 'scan' && 'Aponte a câmera ou digite o código'}
                {step === 'confirm' && `Código: ${placa?.codigo}`}
                {step === 'success' && 'Pronta para ser usada no cliente'}
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
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 mx-auto"
                    >
                      <RefreshCw size={12} />
                      Tentar Novamente
                    </button>
                  </div>
                )}

                {cameraActive && (
                  <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                    <span className="text-[11px] font-semibold text-white/90 bg-slate-950/70 px-3 py-1 rounded-full backdrop-blur-xs border border-white/10">
                      Posicione o QR Code no centro
                    </span>
                  </div>
                )}
              </div>

              {/* Divisor */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-xs uppercase font-bold text-slate-400">
                  Ou digite o código (QR ou NFC)
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Digitação Manual */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) {
                    handleLookupCode(manualCode);
                  }
                }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="Ex: QR001, NFC001..."
                    className="input font-mono font-bold uppercase tracking-wider text-base py-3"
                    disabled={searching}
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim() || searching}
                    className="btn-primary px-5 py-3 text-sm font-bold flex items-center gap-1.5"
                  >
                    {searching ? <Loader2 size={18} className="animate-spin" /> : 'Identificar'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  Dica: Você pode digitar códigos de QR Code (QR001) ou Tags NFC (NFC001).
                </p>
              </form>
            </div>
          )}

          {/* ──────────────── STEP 2: CONFIRMAR E VINCULAR ──────────────── */}
          {step === 'confirm' && placa && (
            <div className="space-y-5 animate-fade-in">
              {/* Card de Identificação da Placa / Tag */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {isNfc ? 'Tag NFC Identificada' : 'Placa QR Identificada'}
                  </span>
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
                  <div className={`w-10 h-10 rounded-xl ${isNfc ? 'bg-teal-600' : 'bg-brand-600'} text-white flex items-center justify-center font-bold text-sm shadow-xs`}>
                    {isNfc ? <NfcIcon size={20} /> : <QrIcon size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">{placa.codigo}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isNfc ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                        {isNfc ? 'NFC' : 'QR Code'}
                      </span>
                    </div>
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
                      {isNfc ? 'QR Code' : 'Tag NFC'} par correspondente ({matchingNfcCode})
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
                    className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
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
                <button type="button" onClick={handleReset} className="btn-secondary flex-1 py-3 text-sm cursor-pointer">
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSaveActivation}
                  disabled={saving || (!selectedEstId && !showNewEstForm)}
                  className="btn-primary flex-2 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
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
                <h3 className="text-xl font-extrabold text-slate-900">
                  {isNfc ? 'Tag NFC Ativada com Sucesso!' : 'Placa Ativada com Sucesso!'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  O redirecionamento dinâmico já está funcionando perfeitamente.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipo:</span>
                  <span className="font-bold text-slate-700 uppercase">{isNfc ? 'Tag NFC' : 'QR Code'}</span>
                </div>
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
                    <span>{isNfc ? 'QR Vinculado:' : 'NFC Vinculado:'}</span>
                    <span className="font-mono font-bold">{matchingNfcCode}</span>
                  </div>
                )}
              </div>

              {/* Se for NFC ou tiver NFC vinculado, exibe ferramentas de gravação */}
              {(isNfc || (matchingNfcCode && vincularNfcJunto)) && (
                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-left space-y-3">
                  <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
                    <NfcIcon size={16} className="text-teal-600" />
                    <span>Gravar na Tag NFC Física</span>
                  </div>

                  <p className="text-[11px] text-teal-700 leading-tight">
                    Para o cliente aproximar o celular e abrir, esta URL precisa estar gravada no chip NFC:
                  </p>

                  <div className="p-2.5 rounded-xl bg-white border border-teal-200 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-700 truncate" title={nfcUrlToRecord}>
                      {nfcUrlToRecord}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(nfcUrlToRecord);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedUrl ? 'Copiado!' : 'Copiar URL'}</span>
                    </button>
                  </div>

                  {canWebNfc && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleWriteNfc(nfcUrlToRecord)}
                        disabled={nfcWriting}
                        className="w-full py-2.5 px-3 rounded-xl bg-teal-700 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-teal-800 active:scale-95 transition-all shadow-xs cursor-pointer"
                      >
                        <Radio size={14} className={nfcWriting ? 'animate-pulse' : ''} />
                        <span>{nfcWriting ? 'Aproxime a tag da traseira do celular...' : 'Gravar Tag com este Celular'}</span>
                      </button>
                      {nfcWriteSuccess && (
                        <p className="text-xs text-emerald-700 font-bold mt-1 text-center">✓ Gravado com sucesso na tag NFC!</p>
                      )}
                      {nfcWriteError && (
                        <p className="text-xs text-red-600 font-medium mt-1 text-center">{nfcWriteError}</p>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 bg-white/80 p-2.5 rounded-xl border border-teal-100 space-y-1">
                    <p className="font-semibold text-slate-700">📱 Como gravar no iPhone ou Android:</p>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Clique em <strong>Copiar URL</strong> acima</li>
                      <li>Abra o aplicativo gratuito <strong>NFC Tools</strong></li>
                      <li>Toque em <strong>Escrever</strong> ➔ <strong>Adicionar registro</strong> ➔ <strong>URL / Link</strong></li>
                      <li>Cole o link copiado e encoste na tag para gravar!</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Botões de Teste e Conclusão */}
              <div className="space-y-2 pt-2">
                <a
                  href={publicTestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-brand-500/20 active:scale-95 transition-transform"
                >
                  <ExternalLink size={18} />
                  Testar Redirecionamento Agora
                </a>

                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                  }}
                  className="btn-secondary w-full py-2.5 text-xs text-slate-600 cursor-pointer"
                >
                  Ativar outra placa
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 active:scale-95 transition-all cursor-pointer"
                >
                  Concluir e Voltar ao Painel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

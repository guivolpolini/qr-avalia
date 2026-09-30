import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Star,
  Store,
  Send,
  MessageSquareWarning,
  Sparkles,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Estabelecimento } from '@/types/database';

export default function AvaliacaoPublica() {
  const { id } = useParams<{ id: string }>();
  const [estabelecimento, setEstabelecimento] = useState<Estabelecimento | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteContato, setClienteContato] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function loadEst() {
      setLoading(true);

      // 1. Tenta via RPC (permite que clientes anônimos leiam dados públicos com segurança)
      const { data: rpcData } = await supabase.rpc('get_avaliacao_publica', {
        p_estabelecimento_id: id,
      });

      if (rpcData) {
        setEstabelecimento(rpcData as Estabelecimento);
        setLoading(false);
        return;
      }

      // 2. Fallback via select direto
      const { data } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('id', id)
        .eq('ativo', true)
        .single();

      if (data) {
        setEstabelecimento(data as Estabelecimento);
      }
      setLoading(false);
    }

    loadEst();
  }, [id]);

  function handleSelectRating(val: number) {
    setRating(val);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(25);
    }
  }

  // Prepara link do WhatsApp para o caso de insatisfação
  const zapRaw = (estabelecimento?.whatsapp || estabelecimento?.telefone || '').replace(/\D/g, '');
  const zapFinal = zapRaw && (zapRaw.startsWith('55') && zapRaw.length >= 12 ? zapRaw : '55' + zapRaw);

  const zapMensagem = `Olá! Estive no estabelecimento *${estabelecimento?.nome || ''}* e gostaria de relatar uma questão sobre o meu atendimento:\n\n"${feedbackText.trim() || 'Gostaria de falar com o gerente sobre uma insatisfação.'}"`;

  const zapUrl = zapFinal
    ? `https://wa.me/${zapFinal}?text=${encodeURIComponent(zapMensagem)}`
    : `https://wa.me/?text=${encodeURIComponent(zapMensagem)}`;

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!estabelecimento?.email_notificacao) return;

    setSendingEmail(true);

    try {
      const res = await fetch('/api/send-feedback-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: estabelecimento.email_notificacao,
          estabelecimentoNome: estabelecimento.nome,
          rating: rating || 1,
          mensagem: feedbackText.trim(),
          clienteNome: clienteNome.trim(),
          clienteContato: clienteContato.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSentSuccess(true);
      } else {
        // Fallback suave via mailto se API key do Resend não estiver configurada
        const mailtoSubject = encodeURIComponent(`Feedback Privado (${rating}★) - ${estabelecimento.nome}`);
        const mailtoBody = encodeURIComponent(
          `Nota dada: ${rating} estrelas\n\nRelato:\n"${feedbackText.trim()}"\n\nCliente: ${clienteNome.trim() || 'Anônimo'}\nContato: ${clienteContato.trim() || 'Não informado'}`
        );
        window.location.href = `mailto:${estabelecimento.email_notificacao}?subject=${mailtoSubject}&body=${mailtoBody}`;
        setEmailSentSuccess(true);
      }
    } catch {
      // Fallback em caso de erro de rede
      const mailtoSubject = encodeURIComponent(`Feedback Privado (${rating}★) - ${estabelecimento.nome}`);
      const mailtoBody = encodeURIComponent(
        `Nota dada: ${rating} estrelas\n\nRelato:\n"${feedbackText.trim()}"\n\nCliente: ${clienteNome.trim() || 'Anônimo'}\nContato: ${clienteContato.trim() || 'Não informado'}`
      );
      window.location.href = `mailto:${estabelecimento.email_notificacao}?subject=${mailtoSubject}&body=${mailtoBody}`;
      setEmailSentSuccess(true);
    } finally {
      setSendingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <Loader2 size={32} className="animate-spin text-brand-600 mb-3" />
        <span className="text-sm">Carregando avaliação...</span>
      </div>
    );
  }

  if (!estabelecimento) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Store size={48} className="text-slate-400 mb-4" />
        <h1 className="text-lg font-bold text-slate-800">Estabelecimento não encontrado</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          O link pode estar expirado ou inativo temporariamente.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-brand-500 selection:text-white">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-6 sm:p-8 animate-scale-in text-center relative overflow-hidden">
        {/* Faixa decorativa sutil */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-brand-500 to-emerald-500" />

        {/* Nome do Local */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 mb-3 shadow-inner">
          <Store size={28} />
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
          {estabelecimento.nome}
        </h1>

        {/* ──────── ETAPA 1: ESCOLHA DE NOTA (1 A 5 ESTRELAS) ──────── */}
        {rating === null && (
          <div className="mt-6 space-y-6 animate-fade-in">
            <div>
              <p className="text-base font-semibold text-slate-700">
                Como foi sua experiência conosco hoje?
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Toque em uma estrela para avaliar
              </p>
            </div>

            {/* Estrelas */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating ?? 0) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => handleSelectRating(star)}
                    className="p-1 sm:p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer rounded-lg focus:outline-none"
                    aria-label={`${star} estrelas`}
                  >
                    <Star
                      size={38}
                      className={`transition-colors duration-200 ${
                        isFilled
                          ? 'text-amber-400 fill-amber-400 drop-shadow-sm'
                          : 'text-slate-300 hover:text-amber-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <ShieldCheck size={14} className="text-slate-400" />
              <span>Sua opinião sincera nos ajuda a evoluir</span>
            </div>
          </div>
        )}

        {/* ──────── ETAPA 2A: FEEDBACK POSITIVO (4 OU 5 ESTRELAS) ──────── */}
        {rating !== null && rating >= 4 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mb-1">
              <Sparkles size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Ficamos muito felizes! 🎉
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                Você nos avaliou com <strong className="text-emerald-700">{rating} estrelas</strong>. Poderia compartilhar essa mesma avaliação no Google? Leva menos de 10 segundos e nos ajuda muito!
              </p>
            </div>

            {/* Botão de Avaliar no Google */}
            <a
              href={estabelecimento.link_google}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-500/25 active:scale-95 transition-all text-white"
            >
              <Star size={18} className="text-amber-300 fill-amber-300" />
              <span>Avaliar no Google Agora</span>
              <ExternalLink size={14} className="opacity-80" />
            </a>

            <button
              onClick={() => setRating(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Trocar nota
            </button>
          </div>
        )}

        {/* ──────── ETAPA 2B: FEEDBACK INTERMEDIÁRIO (1 A 3 ESTRELAS) ──────── */}
        {rating !== null && rating <= 3 && (
          <div className="mt-5 space-y-4 animate-fade-in text-left">
            {emailSentSuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-fade-in">
                <CheckCircle2 size={40} className="text-emerald-600 mx-auto" />
                <h3 className="text-base font-bold text-emerald-950">Mensagem Enviada com Sucesso!</h3>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Seu relato foi encaminhado diretamente para a gerência de <strong>{estabelecimento.nome}</strong>. Agradecemos por nos ajudar a melhorar o nosso atendimento!
                </p>
                <button
                  onClick={() => {
                    setEmailSentSuccess(false);
                    setRating(null);
                    setFeedbackText('');
                  }}
                  className="btn-secondary text-xs mt-3 cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <MessageSquareWarning size={20} className="text-amber-600 shrink-0" />
                  <span>
                    Sentimos muito que sua experiência não tenha sido 5 estrelas. Queremos ouvir você para resolver!
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    O que aconteceu? Conte diretamente à gerência:
                  </label>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Ex: O pedido demorou um pouco, ou a comida veio fria..."
                    className="input min-h-24 text-xs leading-relaxed"
                    autoFocus
                  />
                </div>

                {/* Dados opcionais do cliente */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Seu Nome (opcional)
                    </label>
                    <input
                      type="text"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      placeholder="Ex: Maria"
                      className="input text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Telefone/Zap (opcional)
                    </label>
                    <input
                      type="text"
                      value={clienteContato}
                      onChange={(e) => setClienteContato(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="input text-xs py-2"
                    />
                  </div>
                </div>

                {/* Opções de Envio: WhatsApp e/ou E-mail conforme preferência do lojista */}
                <div className="space-y-2 pt-2">
                  {estabelecimento.canal_queixas !== 'email' && (
                    <a
                      href={zapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-white"
                    >
                      <Send size={15} />
                      <span>Enviar no WhatsApp da Gerência</span>
                    </a>
                  )}

                  {estabelecimento.canal_queixas !== 'whatsapp' && (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={sendingEmail || !feedbackText.trim()}
                      className={`w-full py-3.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer ${
                        estabelecimento.canal_queixas === 'email'
                          ? 'btn-primary bg-slate-900 hover:bg-slate-800 text-white shadow-md active:scale-95'
                          : 'btn-secondary border-slate-300 hover:border-slate-400 active:scale-95'
                      }`}
                    >
                      {sendingEmail ? (
                        <Loader2 size={15} className="animate-spin text-brand-600" />
                      ) : (
                        <Mail size={15} className="text-slate-600" />
                      )}
                      <span>{sendingEmail ? 'Enviando e-mail...' : 'Enviar por E-mail à Diretoria'}</span>
                    </button>
                  )}
                </div>

                {/* Link opcional discreto para cumprir políticas do Google */}
                <div className="pt-3 border-t border-slate-100 text-center">
                  <a
                    href={estabelecimento.link_google}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Prefiro avaliar publicamente no Google
                  </a>
                  <div className="mt-2">
                    <button
                      onClick={() => setRating(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-center mt-6 text-[11px] text-slate-500">
        Tecnologia por <strong className="text-slate-600 font-semibold">QR Avalia • VolpoTech</strong>
      </div>
    </div>
  );
}

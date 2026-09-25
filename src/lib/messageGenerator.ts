/**
 * Message Generator
 *
 * Gera mensagens de prospecção WhatsApp personalizadas.
 * Usa SOMENTE dados reais do Prospect — nunca inventa informações.
 *
 * 3 tipos de abordagem:
 * 1. Sem site — foco em presença digital
 * 2. Com site — foco em complemento/melhorias
 * 3. Geral — quando dados insuficientes
 */

import type { Prospect } from '@/types/database';

/** Extrai o primeiro nome do estabelecimento para uso informal. */
function firstName(businessName: string): string {
  return businessName.split(/[\s-—,]/)[0].trim();
}

/** Extrai cidade/bairro do endereço para personalização. */
function extractCity(address: string): string {
  if (!address) return '';
  // Endereço formato: "Rua X, 123 - Bairro, Cidade - UF, CEP"
  const parts = address.split(',');
  // Tenta pegar a parte da cidade (geralmente após o bairro)
  if (parts.length >= 3) {
    const city = parts[parts.length - 2]?.trim().split('-')[0]?.trim();
    if (city && city.length > 2) return city;
  }
  return '';
}

/** Formata avaliação de forma natural. */
function formatRating(rating: number | null, reviewCount: number): string {
  if (!rating || reviewCount === 0) return '';
  const stars = rating >= 4.5 ? 'ótima avaliação' : rating >= 4.0 ? 'boa avaliação' : '';
  if (!stars) return '';
  return `vi que vocês têm ${stars} no Maps (${rating} ⭐ com ${reviewCount} avaliações)`;
}

/**
 * Abordagem 1: Estabelecimento SEM SITE
 * Foco: oportunidade de presença digital, não problema.
 */
function messageSemSite(p: Prospect): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const cityLine = city ? ` em ${city}` : '';

  const variants = [
    `Olá! Vi o ${p.business_name}${cityLine} no Google Maps${ratingLine ? ' e ' + ratingLine : ''}. Trabalho com criação de sites e percebi que vocês ainda não têm um. Seria ótimo para atrair mais clientes online! Posso te mostrar alguns exemplos? 😊`,

    `Oi, tudo bem? Achei o ${p.business_name} enquanto pesquisava${p.category ? ` ${p.category.toLowerCase()}` : ' negócios'}${cityLine}. ${ratingLine ? `Parabéns — ${ratingLine}! ` : ''}Vi que ainda não têm site próprio. Ajudo negócios locais a terem presença digital. Posso mostrar como funciona sem compromisso?`,

    `Oi ${nome}! Vi o estabelecimento de vocês no Maps${cityLine}. ${ratingLine ? `Impressionante — ${ratingLine}. ` : ''}Muitos clientes pesquisam online antes de visitar, e um site ajuda muito nisso. Seria legal conversar sobre isso? Trabalho com sites para negócios locais.`,
  ];

  // Seleciona variant baseado no hash do nome (determinístico)
  const idx = p.business_name.length % variants.length;
  return variants[idx];
}

/**
 * Abordagem 2: Estabelecimento COM SITE
 * Foco: complemento/melhoria, sem afirmar problemas não verificados.
 */
function messageComSite(p: Prospect): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const cityLine = city ? ` em ${city}` : '';

  const variants = [
    `Oi! Vi o ${p.business_name}${cityLine} no Maps${ratingLine ? ' — ' + ratingLine : ''}. Trabalho com presença digital para negócios locais e adoraria mostrar como podemos complementar o site de vocês para atrair ainda mais clientes. Posso enviar algumas ideias?`,

    `Olá ${nome}! Encontrei o ${p.business_name} pesquisando${p.category ? ` ${p.category.toLowerCase()}` : ''}${cityLine}. ${ratingLine ? `Vi que ${ratingLine} — parabéns! ` : ''}Trabalho ajudando negócios locais a melhorar sua presença online. Teria interesse em conversar sobre isso?`,
  ];

  const idx = p.business_name.length % variants.length;
  return variants[idx];
}

/**
 * Abordagem 3: Geral
 * Quando não há informações suficientes para personalizar.
 */
function messageGeral(p: Prospect): string {
  const city = extractCity(p.address);
  const cityLine = city ? ` em ${city}` : '';
  const ratingLine = formatRating(p.rating, p.review_count);

  return `Oi! Vi o ${p.business_name}${cityLine} no Google Maps${ratingLine ? ' — ' + ratingLine : ''}. Trabalho com soluções digitais para negócios locais e adoraria apresentar o que fazemos. Posso te mostrar mais detalhes?`;
}

/** Determina o tipo de abordagem baseado nos dados disponíveis. */
export type ApproachType = 'sem_site' | 'com_site' | 'geral';

export function getApproachType(p: Prospect): ApproachType {
  const hasEnoughData = p.business_name && (p.address || p.category || p.rating != null);
  if (!hasEnoughData) return 'geral';
  if (!p.website || p.website.trim() === '') return 'sem_site';
  return 'com_site';
}

/** Gera mensagem de prospecção para um prospect. */
export function generateMessage(p: Prospect): string {
  const type = getApproachType(p);
  switch (type) {
    case 'sem_site': return messageSemSite(p);
    case 'com_site': return messageComSite(p);
    default: return messageGeral(p);
  }
}

/**
 * Formata número de telefone para uso no WhatsApp.
 * Retorna null se o número for inválido ou ausente.
 */
export function formatPhoneForWhatsApp(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;

  // Já tem DDI 55 e é válido (mínimo: 55 + DDD 2 + número 8 = 12)
  if (digits.startsWith('55') && digits.length >= 12) return digits;

  // Adiciona DDI Brasil
  if (digits.length >= 10) return `55${digits}`;

  return null;
}

/**
 * Gera URL para abrir WhatsApp com mensagem pré-preenchida.
 * Retorna null se número inválido.
 */
export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const wa = formatPhoneForWhatsApp(phone);
  if (!wa) return null;
  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
}

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
 * Foco: Google Meu Negócio + aparecer nas pesquisas + presença digital com site
 */
function messageSemSite(p: Prospect): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const cityLine = city ? ` em ${city}` : '';

  const variants = [
    `Olá! Vi o ${p.business_name}${cityLine} no Google Maps${ratingLine ? ' e ' + ratingLine : ''}. Eu trabalho otimizando o perfil do Google Meu Negócio para ajudar empresas a aparecerem no topo das pesquisas do Google e também criando sites profissionais (vi que vocês ainda não têm um). Isso ajuda muito a atrair novos clientes na região! Posso te mostrar como funciona na prática? 😊`,

    `Oi, tudo bem? Achei o ${p.business_name} pesquisando${p.category ? ` ${p.category.toLowerCase()}` : ' negócios'}${cityLine}. ${ratingLine ? `Parabéns — ${ratingLine}! ` : ''}Eu ajudo negócios locais a melhorarem o perfil no Google Meu Negócio para aparecerem nas primeiras posições das buscas e terem seu próprio site. Posso te apresentar algumas melhorias rápidas sem nenhum compromisso?`,

    `Oi ${nome}! Vi o estabelecimento de vocês no Maps${cityLine}. ${ratingLine ? `Muito legal — ${ratingLine}. ` : ''}Hoje a grande maioria das pessoas pesquisa no Google antes de ir até o local. Eu ajudo negócios a melhorarem o Google Meu Negócio para aparecerem mais nas pesquisas, além de criar o site oficial para fechar mais vendas. Seria legal batermos um papo rápido sobre isso?`,
  ];

  // Seleciona variant baseado no hash do nome (determinístico)
  const idx = p.business_name.length % variants.length;
  return variants[idx];
}

/**
 * Abordagem 2: Estabelecimento COM SITE
 * Foco: Otimizar Google Meu Negócio para aparecer nas primeiras posições de busca
 */
function messageComSite(p: Prospect): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const cityLine = city ? ` em ${city}` : '';

  const variants = [
    `Oi! Vi o ${p.business_name}${cityLine} no Google Maps${ratingLine ? ' — ' + ratingLine : ''}. Trabalho otimizando o perfil do Google Meu Negócio para ajudar estabelecimentos a se destacarem e aparecerem nas primeiras posições de pesquisa quando clientes buscam no bairro. Posso te enviar algumas sugestões de melhoria sem compromisso?`,

    `Olá ${nome}! Encontrei o ${p.business_name} pesquisando${p.category ? ` ${p.category.toLowerCase()}` : ''}${cityLine}. ${ratingLine ? `Vi que ${ratingLine} — parabéns! ` : ''}Eu ajudo negócios da região a otimizarem o Google Meu Negócio para aumentarem a visibilidade nas pesquisas e receberem mais contatos no WhatsApp todos os dias. Teria interesse em ver como funciona?`,
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

  return `Oi! Vi o ${p.business_name}${cityLine} no Google Maps${ratingLine ? ' — ' + ratingLine : ''}. Trabalho ajudando empresas locais a melhorarem o Google Meu Negócio para aparecerem no topo das pesquisas e conquistarem mais clientes. Posso te mostrar uma demonstração rápida?`;
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

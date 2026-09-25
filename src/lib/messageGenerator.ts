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

/** Formata avaliação de forma natural e enxuta. */
function formatRating(rating: number | null, reviewCount: number): string {
  if (!rating || reviewCount === 0) return '';
  if (rating >= 4.5) return ` (nota ${rating.toFixed(1)} ⭐ com ${reviewCount} avaliações)`;
  if (rating >= 4.0) return ` (nota ${rating.toFixed(1)} ⭐)`;
  return '';
}

/**
 * Abordagem 1: Estabelecimento SEM SITE
 * Foco: Posição no Google Meu Negócio + Perda de clientes para concorrentes + Solução site
 */
function messageSemSite(p: Prospect, variantIndex?: number): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const categoria = p.category ? p.category.toLowerCase() : 'serviços';
  const localizacao = city ? ` em ${city}` : ' aqui na região';

  const variants = [
    // 1. Gancho de Oportunidade / Concorrência (Maior conversão)
    `Oi pessoal da ${p.business_name}, tudo bem?\n\nEstava pesquisando ${categoria}${localizacao} e encontrei o perfil de vocês no Google.\n\nVi que o trabalho de vocês é bem avaliado${ratingLine}, mas reparei que vocês ainda não têm um site cadastrado e o perfil no Google Meu Negócio tá perdendo posições pra outros concorrentes que aparecem primeiro nas buscas.\n\nEu trabalho colocando empresas locais no topo das pesquisas do Google e criando páginas rápidas para receber clientes no WhatsApp. Posso te mandar 2 ajustes rápidos pra vocês melhorarem isso?`,

    // 2. Direto ao Proprietário / Decisor
    `Olá, tudo bem? É com o responsável ou proprietário da ${p.business_name}?\n\nAchei o perfil de vocês no Google Maps enquanto pesquisava ${categoria}${localizacao}. Vocês têm um ótimo negócio, mas hoje concorrentes da região estão aparecendo na frente de vocês quando as pessoas buscam no Google.\n\nEu ajudo estabelecimentos locais a dominarem as primeiras posições do Google Meu Negócio e terem um site profissional para fechar mais vendas. Posso te enviar um diagnóstico rápido mostrando o que falta pra vocês liderarem as buscas?`,

    // 3. Conversa Curta e Objetiva
    `Oi ${nome}, tudo bem?\n\nVi o perfil de vocês no Google Maps${localizacao} e achei muito bacana a estrutura${ratingLine}.\n\nHoje a grande maioria dos clientes pesquisa no Google antes de decidir onde ir. Eu trabalho otimizando o Google Meu Negócio para colocar o perfil de vocês no topo das pesquisas e crio sites modernos focados em atrair clientes.\n\nVocê teria 2 minutinhos pra ver uma demonstração rápida de como colocar vocês em destaque no Google?`,
  ];

  const idx = variantIndex !== undefined ? variantIndex % variants.length : (p.business_name.length % variants.length);
  return variants[idx];
}

/**
 * Abordagem 2: Estabelecimento COM SITE
 * Foco: Subir para o Top 3 do Google Maps e superar concorrentes locais
 */
function messageComSite(p: Prospect, variantIndex?: number): string {
  const nome = firstName(p.business_name);
  const city = extractCity(p.address);
  const ratingLine = formatRating(p.rating, p.review_count);
  const categoria = p.category ? p.category.toLowerCase() : 'serviços';
  const localizacao = city ? ` em ${city}` : ' na região';

  const variants = [
    // 1. Ultrapassar concorrentes no Top 3 do Maps
    `Oi pessoal da ${p.business_name}, tudo bem?\n\nEncontrei o perfil de vocês no Google Maps enquanto pesquisava ${categoria}${localizacao}.\n\nParabéns pelo espaço e atendimento${ratingLine}! Reparei que vocês já têm site, mas no Google Meu Negócio ainda tem outros concorrentes aparecendo na frente de vocês quando os clientes pesquisam pelo celular no bairro.\n\nEu sou especialista em SEO local e posicionamento no Google Maps. Posso te mandar uma análise rápida de como colocar o perfil de vocês no Top 3 das pesquisas?`,

    // 2. Foco em mais ligações e mensagens no WhatsApp
    `Olá ${nome}, tudo bem? É com o responsável pelo ${p.business_name}?\n\nEstava analisando o posicionamento das empresas de ${categoria}${localizacao} no Google. O perfil de vocês tem potencial enorme, mas notei alguns pontos no Google Meu Negócio que estão limitando vocês de receberem mais contatos todos os dias.\n\nPreparei um resumo bem prático com ajustes que aumentam a visibilidade do perfil nas pesquisas locais. Quer que eu te envie por aqui sem compromisso?`,
  ];

  const idx = variantIndex !== undefined ? variantIndex % variants.length : (p.business_name.length % variants.length);
  return variants[idx];
}

/**
 * Abordagem 3: Geral
 * Quando não há dados suficientes para segmentar site.
 */
function messageGeral(p: Prospect, variantIndex?: number): string {
  const city = extractCity(p.address);
  const localizacao = city ? ` em ${city}` : ' na região';
  const ratingLine = formatRating(p.rating, p.review_count);

  return `Oi pessoal da ${p.business_name}, tudo bem?\n\nVi o perfil de vocês no Google Maps${localizacao}${ratingLine}.\n\nEu trabalho otimizando o Google Meu Negócio para negócios locais aparecerem nas primeiras posições de pesquisa do Google quando potenciais clientes buscam no bairro.\n\nPreparei algumas sugestões rápidas para ajudar a aumentar a visibilidade de vocês nas buscas. Posso te mandar por aqui?`;
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
export function generateMessage(p: Prospect, variantIndex?: number): string {
  const type = getApproachType(p);
  switch (type) {
    case 'sem_site': return messageSemSite(p, variantIndex);
    case 'com_site': return messageComSite(p, variantIndex);
    default: return messageGeral(p, variantIndex);
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

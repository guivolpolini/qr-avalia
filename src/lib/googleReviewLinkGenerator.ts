/**
 * Google Review Link Generator
 *
 * Converte qualquer link ou identificador do Google Maps (URL longa, URL curta maps.app.goo.gl,
 * CID ou Place ID) no link oficial de avaliação com 5 estrelas do Google:
 * https://search.google.com/local/writereview?placeid=...
 *
 * Utiliza o algoritmo matemático protobuf (sem necessidade de API key paga do Google).
 */

function toLEBytes(val: bigint): number[] {
  const bytes: number[] = [];
  let g = val;
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(g & 0xffn));
    g >>= 8n;
  }
  return bytes;
}

/**
 * Converte o par hexadecimal de feature ID (hex1:hex2) no Place ID oficial (ChIJ...)
 */
export function hexPairToPlaceId(hex1Str: string, hex2Str: string): string {
  const hex1 = BigInt(hex1Str);
  const hex2 = BigInt(hex2Str);
  const g = [9, ...toLEBytes(hex1), 17, ...toLEBytes(hex2)];
  const t = [10, g.length, ...g];
  const l = new Uint8Array(t);

  let b64: string;
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    let binary = '';
    for (let i = 0; i < l.length; i++) {
      binary += String.fromCharCode(l[i]);
    }
    b64 = window.btoa(binary);
  } else {
    b64 = Buffer.from(l).toString('base64');
  }

  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Monta o link oficial de avaliação direta com pop-up de 5 estrelas
 */
export function buildReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Verifica se a string é um link curto de compartilhamento do Google Maps
 */
export function isShortGoogleMapsUrl(input: string): boolean {
  const clean = input.trim().toLowerCase();
  return (
    clean.includes('maps.app.goo.gl') ||
    clean.includes('goo.gl/maps') ||
    clean.includes('share.google')
  );
}

/**
 * Resolve links curtos (maps.app.goo.gl) chamando a Edge Function /api/resolve-maps-url
 */
export async function resolveShortUrl(shortUrl: string): Promise<string> {
  try {
    const res = await fetch('/api/resolve-maps-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: shortUrl.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.resolvedUrl && typeof data.resolvedUrl === 'string') {
        return data.resolvedUrl;
      }
    }
  } catch (err) {
    console.warn('Erro ao chamar Edge resolver, tentando fallback direto:', err);
  }

  // Fallback de contingência
  return shortUrl;
}

export interface GeneratedReviewLink {
  reviewUrl: string;
  placeId?: string;
  cid?: string;
  tipo: 'place_id' | 'feature_hex' | 'cid' | 'already_review_link';
}

/**
 * Processa qualquer texto/URL e gera o link direto de avaliação do Google.
 */
export async function generateGoogleReviewLink(rawInput: string): Promise<GeneratedReviewLink | null> {
  let input = rawInput.trim();
  if (!input) return null;

  // 1. Se for um link curto (maps.app.goo.gl), resolve o redirecionamento primeiro
  if (isShortGoogleMapsUrl(input)) {
    input = await resolveShortUrl(input);
  }

  // 2. Se já for um link de avaliação do Google (writereview ou g.page)
  if (input.includes('search.google.com/local/writereview') || input.includes('g.page/r/')) {
    const placeIdMatch = input.match(/[?&]placeid=([A-Za-z0-9_-]+)/i);
    return {
      reviewUrl: input,
      placeId: placeIdMatch ? placeIdMatch[1] : undefined,
      tipo: 'already_review_link',
    };
  }

  // 3. Se for digitado diretamente o Place ID (ex: ChIJ...)
  if (/^ChIJ[A-Za-z0-9_-]{20,}$/.test(input)) {
    return {
      reviewUrl: buildReviewUrl(input),
      placeId: input,
      tipo: 'place_id',
    };
  }

  // 4. Procura parâmetro placeid explícito na URL
  const explicitPlaceIdMatch = input.match(/[?&](?:placeid|place_id)=([A-Za-z0-9_-]+)/i);
  if (explicitPlaceIdMatch) {
    const placeId = explicitPlaceIdMatch[1];
    return {
      reviewUrl: buildReviewUrl(placeId),
      placeId,
      tipo: 'place_id',
    };
  }

  // 5. Procura o padrão padrão do Google Maps (!1s0x...:0x...)
  const hexPairMatch = input.match(/!1s(0x[a-f0-9]+):(0x[a-f0-9]+)/i);
  if (hexPairMatch) {
    const hex1 = hexPairMatch[1];
    const hex2 = hexPairMatch[2];
    const placeId = hexPairToPlaceId(hex1, hex2);
    return {
      reviewUrl: buildReviewUrl(placeId),
      placeId,
      tipo: 'feature_hex',
    };
  }

  // 6. Procura parâmetro ftid (ex: ftid=0x...:0x...)
  const ftidMatch = input.match(/[?&]ftid=(0x[a-f0-9]+):(0x[a-f0-9]+)/i);
  if (ftidMatch) {
    const hex1 = ftidMatch[1];
    const hex2 = ftidMatch[2];
    const placeId = hexPairToPlaceId(hex1, hex2);
    return {
      reviewUrl: buildReviewUrl(placeId),
      placeId,
      tipo: 'feature_hex',
    };
  }

  // 7. Procura parâmetro CID decimal (ex: ?cid=123456789...)
  const cidMatch = input.match(/[?&]cid=(\d+)/i);
  if (cidMatch) {
    const cid = cidMatch[1];
    // Se temos o CID, podemos gerar a URL direta de review via placeid/cid do Google
    return {
      reviewUrl: `https://search.google.com/local/writereview?placeid=${cid}`,
      cid,
      tipo: 'cid',
    };
  }

  return null;
}

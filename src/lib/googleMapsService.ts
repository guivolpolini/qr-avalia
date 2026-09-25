/**
 * Google Maps Scraper Service
 *
 * Interface com o scraper local (gosom/google-maps-scraper via Docker).
 * O scraper roda em http://localhost:8080 (configurável via VITE_SCRAPER_URL).
 *
 * NÃO usa Supabase. NÃO toca em qr_codes, scans, ou estabelecimentos.
 * Módulo completamente isolado do sistema de QR Codes.
 */

import type { ScraperResult, Prospect } from '@/types/database';

const rawScraperUrl = (import.meta.env.VITE_SCRAPER_URL ?? 'http://localhost:8080').replace(/\/$/, '');
// Use local Vite proxy if pointing to localhost:8080 to prevent CORS issues
const SCRAPER_BASE = (rawScraperUrl.includes('localhost:8080') || rawScraperUrl.includes('127.0.0.1:8080'))
  ? '/scraper-api'
  : rawScraperUrl;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000; // 2 min max

export interface ScrapeJobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  count?: number;
}

export interface ScrapeOptions {
  keyword: string;
  lat: number;
  lng: number;
  depth?: number; // default 5, max 20
  maxResults?: number; // default 50
}

/** Verifica se o scraper está rodando. Timeout rápido de 3s. */
export async function checkScraperAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SCRAPER_BASE}/api/v1/jobs`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Cria um job de scraping. Retorna o ID do job. */
async function createJob(opts: ScrapeOptions): Promise<string> {
  const body = {
    name: 'qr-avalia-scrape',
    keywords: [opts.keyword],
    lang: 'pt',
    zoom: 15,
    lat: String(opts.lat),
    lon: String(opts.lng),
    fast_mode: false,
    radius: 10000,
    depth: Math.min(opts.depth ?? 5, 20),
    email: false,
    max_time: 120,
  };

  const res = await fetch(`${SCRAPER_BASE}/api/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Erro ao criar job: ${res.status} ${text}`);
  }

  const data = await res.json();
  const id = data?.id ?? data?.ID;
  if (!id) throw new Error('Resposta inválida do scraper (sem ID)');
  return String(id);
}

/** Poll até o job completar ou timeout. */
async function waitForJob(jobId: string): Promise<ScrapeJobStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${SCRAPER_BASE}/api/v1/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Erro ao verificar job: ${res.status}`);

    const data = await res.json();
    const status = String(data.Status ?? data.status ?? '').toLowerCase();

    if (status === 'ok' || status === 'completed') {
      return { id: jobId, status: 'completed' };
    }
    if (status === 'failed') throw new Error('Job falhou no scraper');
  }

  throw new Error('Timeout aguardando scraper (2 min). Tente com menos resultados.');
}

/** Baixa resultados CSV e parseia para array de objetos. */
async function downloadResults(jobId: string): Promise<ScraperResult[]> {
  const res = await fetch(`${SCRAPER_BASE}/api/v1/jobs/${jobId}/download`);
  if (!res.ok) throw new Error(`Erro ao baixar resultados: ${res.status}`);

  const text = await res.text();
  return parseCSV(text);
}

/** Parseia CSV simples com header na primeira linha. */
function parseCSV(csv: string): ScraperResult[] {
  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] ?? '').trim();
    });
    return obj as ScraperResult;
  });
}

/** Divide linha CSV respeitando aspas. */
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Normaliza resultado bruto do scraper para o formato Prospect. */
export function normalizeResult(raw: ScraperResult): Omit<Prospect, 'id' | 'status' | 'notes' | 'ultima_mensagem' | 'ultima_mensagem_em' | 'created_at' | 'updated_at'> {
  // O scraper usa 'title' como nome; normaliza campos conhecidos
  const name = String(raw.title ?? raw.name ?? '').trim();
  const phone = String(raw.phone ?? raw.telefone ?? '').trim();
  const website = String(raw.website ?? raw.site ?? '').trim();
  const gmapsUrl = String(raw.link ?? raw.google_maps_url ?? raw.url ?? raw.web_url ?? '').trim();

  // Rating pode vir como string "4.5" ou número
  const rawRating = raw.review_rating ?? raw.rating ?? raw.stars;
  const rating = rawRating != null ? parseFloat(String(rawRating)) : null;

  // Reviews pode vir como string "1,234" — remove separadores
  const rawReviews = raw.review_count ?? raw.reviews ?? raw.reviews_count ?? 0;
  const reviewCount = parseInt(String(rawReviews).replace(/\D/g, ''), 10) || 0;

  return {
    business_name: name,
    category: String(raw.category ?? raw.tipo ?? '').trim(),
    address: String(raw.address ?? raw.endereco ?? '').trim(),
    phone,
    website,
    google_maps_url: gmapsUrl,
    rating: isNaN(rating as number) ? null : rating,
    review_count: reviewCount,
    instagram: String(raw.instagram ?? '').trim(),
    source: 'google_maps',
  };
}

/** Executa busca completa: cria job → aguarda → baixa → normaliza. */
export async function scrapeGoogleMaps(
  opts: ScrapeOptions,
  onProgress?: (msg: string) => void,
): Promise<ReturnType<typeof normalizeResult>[]> {
  onProgress?.('Criando job de scraping...');
  const jobId = await createJob(opts);

  onProgress?.('Aguardando resultados (pode levar 1-2 min)...');
  await waitForJob(jobId);

  onProgress?.('Baixando e processando resultados...');
  const raw = await downloadResults(jobId);

  return raw
    .map(normalizeResult)
    .filter(r => r.business_name.length > 0);
}

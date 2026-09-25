export interface Estabelecimento {
  id: string;
  nome: string;
  link_google: string;
  telefone: string;
  endereco: string;
  ativo: boolean;
  tipo_negocio: string;
  descricao: string;
  cardapio: string;
  cor_marca: string;
  whatsapp: string;
  instagram: string;
  site_com_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface QrCode {
  id: string;
  codigo: string;
  estabelecimento_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  estabelecimento?: Pick<Estabelecimento, 'id' | 'nome' | 'link_google'> | null;
}

export interface NfcTag {
  id: string;
  codigo: string;
  estabelecimento_id: string | null;
  url_dinamica: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  estabelecimento?: Pick<Estabelecimento, 'id' | 'nome'> | null;
}

export interface GoogleSeoStatus {
  id: string;
  estabelecimento_id: string;
  url_google_business: string;
  url_google_maps: string;
  url_avaliacoes: string;
  checklist: Record<string, boolean>;
  observacoes: string;
  created_at: string;
  updated_at: string;
  estabelecimento?: Pick<Estabelecimento, 'id' | 'nome'> | null;
}

// ── Prospecção (módulo isolado) ───────────────────────────────────
export type ProspectStatus =
  | 'novo'
  | 'contatado'
  | 'interessado'
  | 'cliente'
  | 'nao_interessado';

export interface Prospect {
  id: string;
  business_name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  google_maps_url: string;
  rating: number | null;
  review_count: number;
  instagram: string;
  source: string;
  status: ProspectStatus;
  notes: string;
  ultima_mensagem: string;
  ultima_mensagem_em: string | null;
  created_at: string;
  updated_at: string;
}

// Raw result from Google Maps Scraper API
export interface ScraperResult {
  title: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  google_maps_url?: string;
  rating?: number;
  reviews?: number;
  instagram?: string;
  // raw fields we ignore (lat, lng, emails, hours, etc.)
  [key: string]: unknown;
}

export interface Scan {
  id: string;
  tipo: string;
  qr_code_id: string | null;
  nfc_tag_id: string | null;
  estabelecimento_id: string | null;
  user_agent: string;
  ip: string;
  created_at: string;
  qr_code?: Pick<QrCode, 'id' | 'codigo'> | null;
  nfc_tag?: Pick<NfcTag, 'id' | 'codigo'> | null;
  estabelecimento?: Pick<Estabelecimento, 'id' | 'nome'> | null;
}

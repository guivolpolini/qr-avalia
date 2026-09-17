export interface Estabelecimento {
  id: string;
  nome: string;
  link_google: string;
  telefone: string;
  endereco: string;
  ativo: boolean;
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

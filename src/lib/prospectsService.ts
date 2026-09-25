/**
 * Prospects Service
 *
 * CRUD da tabela `prospects` no Supabase.
 * Completamente isolado do sistema de QR Codes.
 * Não acessa qr_codes, nfc_tags, scans ou estabelecimentos.
 */

import { supabase } from '@/lib/supabase';
import type { Prospect, ProspectStatus } from '@/types/database';

export interface ProspectFilters {
  status?: ProspectStatus | 'todos';
  semSite?: boolean;
  semTelefone?: boolean;
  search?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number; // duplicatas ignoradas
  errors: number;
}

const LOCAL_STORAGE_KEY = 'qr_avalia_prospects';

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  return err.code === 'PGRST205' || String(err.message || '').includes("table 'public.prospects'");
}

function getLocalProspects(): Prospect[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalProspects(list: Prospect[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save prospects locally:', e);
  }
}

/** Lista prospects com filtros opcionais. */
export async function getProspects(filters: ProspectFilters = {}): Promise<Prospect[]> {
  try {
    let query = supabase
      .from('prospects')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'todos') {
      query = query.eq('status', filters.status);
    }
    if (filters.semSite) {
      query = query.eq('website', '');
    }
    if (filters.semTelefone) {
      query = query.eq('phone', '');
    }
    if (filters.search) {
      query = query.ilike('business_name', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        // Fallback LocalStorage
        return filterLocalProspects(getLocalProspects(), filters);
      }
      throw new Error(error.message);
    }
    return data ?? [];
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return filterLocalProspects(getLocalProspects(), filters);
    }
    throw err;
  }
}

function filterLocalProspects(list: Prospect[], filters: ProspectFilters): Prospect[] {
  let result = [...list];
  if (filters.status && filters.status !== 'todos') {
    result = result.filter(p => p.status === filters.status);
  }
  if (filters.semSite) {
    result = result.filter(p => !p.website);
  }
  if (filters.semTelefone) {
    result = result.filter(p => !p.phone);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(p => p.business_name.toLowerCase().includes(q));
  }
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Importa lista de prospects com deduplicação.
 * Usa ON CONFLICT DO NOTHING nos índices únicos da tabela.
 */
export async function importProspects(
  items: Omit<Prospect, 'id' | 'status' | 'notes' | 'ultima_mensagem' | 'ultima_mensagem_em' | 'created_at' | 'updated_at'>[],
): Promise<ImportResult> {
  if (items.length === 0) return { imported: 0, skipped: 0, errors: 0 };

  try {
    const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };
    const BATCH = 50;

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);

      const { data, error } = await supabase
        .from('prospects')
        .insert(batch)
        .select('id');

      if (error) {
        if (isTableMissingError(error)) {
          return importLocalProspects(items);
        }
        if (error.code === '23505') {
          for (const item of batch) {
            const { error: singleErr } = await supabase.from('prospects').insert(item);
            if (singleErr?.code === '23505') result.skipped++;
            else if (singleErr) result.errors++;
            else result.imported++;
          }
        } else {
          result.errors += batch.length;
        }
      } else {
        result.imported += data?.length ?? 0;
        result.skipped += batch.length - (data?.length ?? 0);
      }
    }

    return result;
  } catch (err: any) {
    if (isTableMissingError(err)) {
      return importLocalProspects(items);
    }
    throw err;
  }
}

function importLocalProspects(
  items: Omit<Prospect, 'id' | 'status' | 'notes' | 'ultima_mensagem' | 'ultima_mensagem_em' | 'created_at' | 'updated_at'>[],
): ImportResult {
  const current = getLocalProspects();
  const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };
  const now = new Date().toISOString();

  for (const item of items) {
    const cleanPhone = (item.phone || '').replace(/\D/g, '');
    const isDup = current.some(p => {
      const pPhone = (p.phone || '').replace(/\D/g, '');
      if (cleanPhone && pPhone && cleanPhone === pPhone) return true;
      if (item.google_maps_url && p.google_maps_url && item.google_maps_url === p.google_maps_url) return true;
      if (p.business_name.toLowerCase() === item.business_name.toLowerCase()) return true;
      return false;
    });

    if (isDup) {
      result.skipped++;
    } else {
      const newProspect: Prospect = {
        ...item,
        id: crypto.randomUUID(),
        status: 'novo',
        notes: '',
        ultima_mensagem: '',
        ultima_mensagem_em: null,
        created_at: now,
        updated_at: now,
      };
      current.push(newProspect);
      result.imported++;
    }
  }

  saveLocalProspects(current);
  return result;
}

/** Atualiza status de um prospect. */
export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ status })
    .eq('id', id);

  if (error) {
    if (isTableMissingError(error)) {
      const list = getLocalProspects();
      const item = list.find(p => p.id === id);
      if (item) {
        item.status = status;
        item.updated_at = new Date().toISOString();
        saveLocalProspects(list);
      }
      return;
    }
    throw new Error(error.message);
  }
}

/** Salva a última mensagem gerada para um prospect. */
export async function saveProspectMessage(id: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ ultima_mensagem: message, ultima_mensagem_em: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    if (isTableMissingError(error)) {
      const list = getLocalProspects();
      const item = list.find(p => p.id === id);
      if (item) {
        item.ultima_mensagem = message;
        item.ultima_mensagem_em = new Date().toISOString();
        item.updated_at = new Date().toISOString();
        saveLocalProspects(list);
      }
      return;
    }
    throw new Error(error.message);
  }
}

/** Atualiza anotações de um prospect. */
export async function updateProspectNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ notes })
    .eq('id', id);

  if (error) {
    if (isTableMissingError(error)) {
      const list = getLocalProspects();
      const item = list.find(p => p.id === id);
      if (item) {
        item.notes = notes;
        item.updated_at = new Date().toISOString();
        saveLocalProspects(list);
      }
      return;
    }
    throw new Error(error.message);
  }
}

/** Remove um prospect. */
export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id);

  if (error) {
    if (isTableMissingError(error)) {
      const list = getLocalProspects().filter(p => p.id !== id);
      saveLocalProspects(list);
      return;
    }
    throw new Error(error.message);
  }
}

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

/** Lista prospects com filtros opcionais. */
export async function getProspects(filters: ProspectFilters = {}): Promise<Prospect[]> {
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
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Importa lista de prospects com deduplicação.
 * Usa ON CONFLICT DO NOTHING nos índices únicos da tabela.
 */
export async function importProspects(
  items: Omit<Prospect, 'id' | 'status' | 'notes' | 'ultima_mensagem' | 'ultima_mensagem_em' | 'created_at' | 'updated_at'>[],
): Promise<ImportResult> {
  if (items.length === 0) return { imported: 0, skipped: 0, errors: 0 };

  const result: ImportResult = { imported: 0, skipped: 0, errors: 0 };

  // Insere em lotes de 50 para evitar timeout
  const BATCH = 50;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);

    const { data, error } = await supabase
      .from('prospects')
      .insert(batch)
      .select('id');

    if (error) {
      // Erros de conflito (duplicatas) são contados como skipped
      if (error.code === '23505') {
        // Unique violation — insere um a um para contar corretamente
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
      // Diferença = duplicatas ignoradas pelo ON CONFLICT
      result.skipped += batch.length - (data?.length ?? 0);
    }
  }

  return result;
}

/** Atualiza status de um prospect. */
export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ status })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Salva a última mensagem gerada para um prospect. */
export async function saveProspectMessage(id: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ ultima_mensagem: message, ultima_mensagem_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Atualiza anotações de um prospect. */
export async function updateProspectNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('prospects')
    .update({ notes })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Remove um prospect. */
export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env';

/**
 * Cliente Supabase com a chave de serviço (ignora RLS).
 * Existe só no servidor: o front nunca fala com o Supabase direto.
 * Regras de escrita na camada antiga: ver CLAUDE.md, seção "Treino do Joelho".
 */
export function createDb(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

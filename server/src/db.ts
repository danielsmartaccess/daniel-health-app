import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import type { Env } from './env';
import type { Db } from './repository';

/**
 * Cliente Supabase com a chave de serviço (ignora RLS).
 * Existe só no servidor: o front nunca fala com o Supabase direto.
 * Tipado com o Database recortado: só as tabelas permitidas são acessíveis.
 */
export function createDb(env: Env): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

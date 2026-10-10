import { z } from 'zod';

const DEFAULT_OWNER_ID = '00000000-0000-0000-0000-000000000001';
// Formato genérico 8-4-4-4-12: o UUID fixo do dono não tem bits de versão RFC,
// e o validador uuid() estrito do zod o rejeitaria.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const envSchema = z.object({
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OWNER_ID: z.string().regex(UUID_SHAPE).default(DEFAULT_OWNER_ID),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_REDIRECT_URI: z.string().url().default('http://127.0.0.1:3001/api/spotify/callback'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Valida as variáveis de ambiente.
 * A mensagem de erro cita só os NOMES das variáveis inválidas, nunca os valores,
 * para a chave de serviço não vazar em log.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // Variável vazia no .env conta como ausente (evita aceitar "SPOTIFY_CLIENT_ID=").
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${keys.join(', ')}`);
  }
  return parsed.data;
}

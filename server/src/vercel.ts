/**
 * Entrada da função na Vercel. O build (scripts/vercel-build.mjs) empacota este arquivo
 * com esbuild em .vercel/output/functions/api.func/index.mjs.
 * As variáveis vêm do ambiente do projeto na Vercel (nunca de arquivo).
 */
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { SupabaseKneeRepository } from './repository';

const env = loadEnv();

export default createApp({
  repo: new SupabaseKneeRepository(createDb(env)),
  ownerId: env.OWNER_ID,
  deviceToken: env.DEVICE_TOKEN,
  now: Date.now,
});

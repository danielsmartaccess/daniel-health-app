import { existsSync } from 'node:fs';
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { SupabaseKneeRepository } from './repository';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
const app = createApp({
  repo: new SupabaseKneeRepository(createDb(env)),
  ownerId: env.OWNER_ID,
  now: Date.now,
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`[server] ouvindo em http://${env.HOST}:${env.PORT}`);
});

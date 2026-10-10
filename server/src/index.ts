import { existsSync } from 'node:fs';
import { createApp } from './app';
import { loadEnv } from './env';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
const app = createApp();

app.listen(env.PORT, env.HOST, () => {
  console.log(`[server] ouvindo em http://${env.HOST}:${env.PORT}`);
});

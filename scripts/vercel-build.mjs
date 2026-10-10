#!/usr/bin/env node
/**
 * Build para a Vercel no formato Build Output API v3 (.vercel/output):
 *  - static/            → client (Vite) já compilado
 *  - functions/api.func → servidor Express empacotado num único arquivo (esbuild)
 *  - config.json        → rotas: /api/* vai para a função; o resto é a SPA
 *
 * O app legado (saude-app.html) continua no GitHub Pages e não entra aqui.
 * Uso: npm run vercel-build
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const OUT = '.vercel/output';
const FN = `${OUT}/functions/api.func`;

rmSync(OUT, { recursive: true, force: true });

execSync('npm run build -w @knee/client', { stdio: 'inherit' });
mkdirSync(`${OUT}/static`, { recursive: true });
cpSync('client/dist', `${OUT}/static`, { recursive: true });

mkdirSync(FN, { recursive: true });
await build({
  entryPoints: ['server/src/vercel.ts'],
  outfile: `${FN}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Express e dependências são CommonJS: o bundle ESM precisa de um `require` real.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'info',
});

writeFileSync(
  `${FN}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      // Sem os helpers da Vercel: o Express lê o corpo da requisição por conta própria.
      shouldAddHelpers: false,
      maxDuration: 10,
    },
    null,
    2,
  ),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '^/assets/(.*)$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`\nBuild Output pronto em ${OUT}`);

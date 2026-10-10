#!/usr/bin/env node
/**
 * Bloqueia chaves secretas do Supabase em arquivos que o Git rastreia (ou rastrearia).
 * O repositório é público: um segredo commitado vaza para sempre.
 *
 * Detecta:
 *  - chaves novas `sb_secret_...`;
 *  - JWTs legados cujo payload tem role "service_role".
 * A chave anon/publishable é pública por natureza e não é bloqueada.
 *
 * Uso: node scripts/check-secrets.mjs   (roda no `npm run check` e no pre-commit)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SB_SECRET = /sb_secret_[A-Za-z0-9_-]{16,}/;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]+/g;

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

function isServiceRoleJwt(payloadB64) {
  try {
    return (
      JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')).role === 'service_role'
    );
  } catch {
    return false;
  }
}

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // removido do disco mas ainda no índice
  }
  if (text.includes('\0')) continue; // binário

  text.split('\n').forEach((line, i) => {
    if (SB_SECRET.test(line)) findings.push(`${file}:${i + 1} chave sb_secret_`);
    for (const match of line.matchAll(JWT)) {
      if (isServiceRoleJwt(match[1])) findings.push(`${file}:${i + 1} JWT service_role`);
    }
  });
}

if (findings.length > 0) {
  // Mostra só onde está, nunca o valor.
  console.error('Segredo encontrado em arquivo rastreado pelo Git:');
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    'Mova o valor para server/.env (ignorado pelo Git) e troque a chave se ela já saiu daqui.',
  );
  process.exit(1);
}
console.log(`check-secrets: ${files.length} arquivos verificados, nenhum segredo.`);

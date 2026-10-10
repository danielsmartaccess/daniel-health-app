/**
 * Teste de integração contra o Supabase REAL. Não há banco de desenvolvimento, então:
 *  - só escreve em knee_* e, na camada antiga, só faz get-or-create do dia de hoje;
 *  - marca tudo como '[teste-integracao]' e apaga o que criou no final.
 */
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDate } from '@knee/shared';
import { createApp } from './app';
import { createDb } from './db';
import { loadEnv } from './env';
import { SupabaseKneeRepository } from './repository';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = loadEnv();
const db = createDb(env);

const TEMPLATE_ID = '6ac8cc81-f371-4a0d-9f2d-f944b7f23148';
const PLANK = 'f554ba9d-fbf1-4b49-8177-5219caf36455';
const MARK = '[teste-integracao]';

let server: Server;
let base: string;
const created = { sessionId: null as string | null, swimId: null as string | null };
const today = localDate(Date.now());
let dayBefore: { id: string; updated_at: string | null } | null = null;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.DEVICE_TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  const { data } = await db
    .from('daily_logs')
    .select('id, updated_at')
    .eq('user_id', env.OWNER_ID)
    .eq('date', today)
    .maybeSingle();
  dayBefore = data;

  const app = createApp({
    repo: new SupabaseKneeRepository(db),
    ownerId: env.OWNER_ID,
    deviceToken: env.DEVICE_TOKEN,
    now: Date.now,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(async () => {
  if (created.sessionId) {
    await db.from('knee_workout_sessions').delete().eq('id', created.sessionId); // itens em cascata
  }
  if (created.swimId) await db.from('knee_swim_logs').delete().eq('id', created.swimId);
  await new Promise((resolve) => server.close(resolve));
});

describe('fluxo completo contra o banco real', () => {
  it('2.1 lê o template de core com os 4 exercícios em ordem', async () => {
    const res = await call('GET', `/templates/${TEMPLATE_ID}`);
    expect(res.status).toBe(200);
    const items = res.body.items as { name: string; mode: string }[];
    expect(items.map((i) => i.name)).toEqual([
      'Abdominal tradicional',
      'Prancha',
      'Superman',
      'Canoinha',
    ]);
    expect(items[1]?.mode).toBe('time');
  });

  it('2.2 inicia sessão no dia de hoje sem alterar o dia existente', async () => {
    const res = await call('POST', '/sessions', {
      templateId: TEMPLATE_ID,
      painBefore: 0,
      onAntiInflammatory: false,
    });
    expect(res.status).toBe(201);
    created.sessionId = res.body.id as string;
    expect(res.body.date).toBe(today);

    const { data: dayAfter } = await db
      .from('daily_logs')
      .select('id, updated_at')
      .eq('user_id', env.OWNER_ID)
      .eq('date', today)
      .single();
    if (dayBefore) {
      expect(dayAfter).toEqual(dayBefore); // mesmo id, updated_at intocado
    }
    expect(res.body.dailyLogId).toBe(dayAfter?.id);
  });

  it('2.3 grava uma série', async () => {
    const res = await call('POST', `/sessions/${created.sessionId}/items`, {
      exerciseId: PLANK,
      setNumber: 1,
      plannedDurationSeconds: 40,
      actualDurationSeconds: 40,
      plannedRestSeconds: 30,
      actualRestSeconds: 30,
      completed: true,
      skipped: false,
    });
    expect(res.status).toBe(201);
  });

  it('2.2 finaliza uma vez e aparece na view do painel com os dados do dia', async () => {
    const res = await call('PATCH', `/sessions/${created.sessionId}/finish`, {
      painAfter: 0,
      freeNotes: MARK,
    });
    expect(res.status).toBe(200);
    expect(
      (await call('PATCH', `/sessions/${created.sessionId}/finish`, { painAfter: 1 })).status,
    ).toBe(409);

    const { data: row } = await db
      .from('knee_recovery_daily')
      .select('*')
      .eq('session_id', created.sessionId!)
      .single();
    expect(row).toMatchObject({ date: today, pain_before: 0, pain_after: 0 });
  });

  it('2.4 registra e lista uma natação de hoje', async () => {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const res = await call('POST', '/swims', {
      startedAt,
      durationSeconds: 600,
      distanceM: 400,
      kick: 'none',
      notes: MARK,
    });
    expect(res.status).toBe(201);
    created.swimId = res.body.id as string;

    const list = await call('GET', '/swims');
    const swims = list.body as unknown as { id: string; date: string }[];
    expect(swims.some((s) => s.id === created.swimId)).toBe(true);
    expect(swims.some((s) => s.date === '2026-10-09')).toBe(true); // registro real de 09/10
  });
});

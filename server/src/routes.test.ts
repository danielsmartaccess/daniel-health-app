import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateDto } from '@knee/shared';
import { createApp } from './app';
import type { KneeRepository } from './repository';
import { MemoryKneeRepository } from './testing/memoryRepository';

const OWNER = '00000000-0000-0000-0000-000000000001';
const TEMPLATE_ID = '6ac8cc81-f371-4a0d-9f2d-f944b7f23148';
const PLANK = 'f554ba9d-fbf1-4b49-8177-5219caf36455';
const MISSING = '11111111-1111-4111-8111-111111111111';

const template: TemplateDto = {
  id: TEMPLATE_ID,
  name: 'Core — Recuperação de joelho',
  description: null,
  items: [
    {
      exerciseId: PLANK,
      name: 'Prancha',
      mode: 'time',
      voiceInstruction: 'Prancha',
      orderIndex: 1,
      sets: 3,
      durationSeconds: 40,
      reps: null,
      restSeconds: 30,
    },
  ],
};

// 23h30 de 10/10 em São Paulo = 02h30 de 11/10 em UTC
const LATE_EVENING = Date.parse('2026-10-11T02:30:00Z');

let server: Server;
let base: string;
let repo: MemoryKneeRepository;
let clock: number;

const DEVICE_TOKEN = 'chave-de-teste-com-mais-de-32-caracteres-0000';

async function start(customRepo?: KneeRepository) {
  const app = createApp({
    repo: customRepo ?? repo,
    ownerId: OWNER,
    deviceToken: DEVICE_TOKEN,
    now: () => clock,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  authorization: string | null = `Bearer ${DEVICE_TOKEN}`,
) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return {
    status: res.status,
    headers: res.headers,
    body: (await res.json()) as Record<string, unknown>,
  };
}

const item = {
  exerciseId: PLANK,
  setNumber: 1,
  plannedDurationSeconds: 40,
  actualDurationSeconds: 40,
  plannedRestSeconds: 30,
  actualRestSeconds: 30,
  completed: true,
  skipped: false,
};

beforeEach(async () => {
  repo = new MemoryKneeRepository([template]);
  clock = LATE_EVENING;
  await start();
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('chave do aparelho', () => {
  it('401 sem chave, com chave errada ou com esquema errado', async () => {
    const path = `/templates/${TEMPLATE_ID}`;
    expect((await call('GET', path, undefined, null)).status).toBe(401);
    expect((await call('GET', path, undefined, 'Bearer chave-errada')).status).toBe(401);
    expect((await call('GET', path, undefined, `Basic ${DEVICE_TOKEN}`)).status).toBe(401);
  });

  it('não grava nada sem a chave', async () => {
    const res = await call(
      'POST',
      '/sessions',
      { templateId: TEMPLATE_ID, painBefore: 0, onAntiInflammatory: false },
      null,
    );
    expect(res.status).toBe(401);
    expect(repo.dailyLogs.size).toBe(0);
  });

  it('health check fica aberto (monitoramento) e nada da API é cacheável', async () => {
    const health = await call('GET', '/health', undefined, null);
    expect(health.status).toBe(200);
    expect(health.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /api/templates/:id (2.1)', () => {
  it('devolve o template com itens prontos para o plano', async () => {
    const res = await call('GET', `/templates/${TEMPLATE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(template);
  });

  it('404 para template inexistente e 400 para id malformado', async () => {
    expect((await call('GET', `/templates/${MISSING}`)).status).toBe(404);
    expect((await call('GET', '/templates/abc')).status).toBe(400);
  });
});

describe('POST /api/sessions (2.2)', () => {
  const body = { templateId: TEMPLATE_ID, painBefore: 3, onAntiInflammatory: true };

  it('cria o dia pela data de São Paulo, não UTC (sessão às 23h30)', async () => {
    const res = await call('POST', '/sessions', body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ date: '2026-10-10', startedAt: '2026-10-11T02:30:00.000Z' });
    expect([...repo.dailyLogs.keys()]).toEqual([`${OWNER}|2026-10-10`]);
  });

  it('reaproveita o dia existente (get-or-create)', async () => {
    const first = await call('POST', '/sessions', body);
    const second = await call('POST', '/sessions', body);
    expect(second.body.dailyLogId).toBe(first.body.dailyLogId);
    expect(repo.dailyLogs.size).toBe(1);
  });

  it('400 sem o campo de anti-inflamatório, com detalhes do campo', async () => {
    const res = await call('POST', '/sessions', { templateId: TEMPLATE_ID, painBefore: 3 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([expect.objectContaining({ path: 'onAntiInflammatory' })]);
  });

  it('404 para template inexistente, sem criar o dia', async () => {
    const res = await call('POST', '/sessions', { ...body, templateId: MISSING });
    expect(res.status).toBe(404);
    expect(repo.dailyLogs.size).toBe(0);
  });

  it('400 para JSON malformado', async () => {
    expect((await call('POST', '/sessions', '{"templateId":')).status).toBe(400);
  });
});

describe('itens e finalização (2.2 e 2.3)', () => {
  async function newSession() {
    const res = await call('POST', '/sessions', {
      templateId: TEMPLATE_ID,
      painBefore: 2,
      onAntiInflammatory: false,
    });
    return res.body.id as string;
  }

  it('grava a série na sessão aberta', async () => {
    const id = await newSession();
    const res = await call('POST', `/sessions/${id}/items`, item);
    expect(res.status).toBe(201);
    expect(repo.sessions.get(id)?.items).toEqual([item]);
  });

  it('400 para série inválida e para exercício inexistente', async () => {
    const id = await newSession();
    expect((await call('POST', `/sessions/${id}/items`, { ...item, skipped: true })).status).toBe(
      400,
    );
    expect(
      (await call('POST', `/sessions/${id}/items`, { ...item, exerciseId: MISSING })).status,
    ).toBe(400);
  });

  it('404 para sessão inexistente', async () => {
    expect((await call('POST', `/sessions/${MISSING}/items`, item)).status).toBe(404);
    expect((await call('PATCH', `/sessions/${MISSING}/finish`, { painAfter: 1 })).status).toBe(404);
  });

  it('finaliza uma vez; depois disso recusa itens e nova finalização (409)', async () => {
    const id = await newSession();
    clock += 20 * 60 * 1000;
    const finished = await call('PATCH', `/sessions/${id}/finish`, { painAfter: 1 });
    expect(finished.status).toBe(200);
    expect(finished.body.endedAt).toBe('2026-10-11T02:50:00.000Z');

    expect((await call('PATCH', `/sessions/${id}/finish`, { painAfter: 5 })).status).toBe(409);
    expect((await call('POST', `/sessions/${id}/items`, item)).status).toBe(409);
  });
});

describe('natação (2.4)', () => {
  const swim = {
    startedAt: '2026-10-09T16:12:00-03:00',
    endedAt: '2026-10-09T16:58:00-03:00',
    durationSeconds: 2753,
    distanceM: 1552,
    poolLengthM: 16,
    laps: 97,
    activeKcal: 315,
    totalKcal: 390,
    avgHr: 108,
    effort: 8,
    stroke: 'freestyle',
    kick: 'none',
    onAntiInflammatory: true,
  };

  it('registra no dia local do início do treino e lista', async () => {
    const created = await call('POST', '/swims', swim);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ date: '2026-10-09', kick: 'none', distanceM: 1552 });
    expect([...repo.dailyLogs.keys()]).toEqual([`${OWNER}|2026-10-09`]);

    const list = await call('GET', '/swims');
    expect(list.body).toEqual([created.body]);
  });

  it('exige a pernada', async () => {
    const withoutKick = Object.fromEntries(Object.entries(swim).filter(([key]) => key !== 'kick'));
    const res = await call('POST', '/swims', withoutKick);
    expect(res.status).toBe(400);
  });

  it('422 para treino no futuro ou há mais de 30 dias', async () => {
    expect(
      (await call('POST', '/swims', { ...swim, startedAt: '2026-10-11T12:00:00Z', endedAt: null }))
        .status,
    ).toBe(422);
    expect(
      (await call('POST', '/swims', { ...swim, startedAt: '2026-09-01T12:00:00Z', endedAt: null }))
        .status,
    ).toBe(422);
  });

  it('400 quando o fim é antes do início', async () => {
    const res = await call('POST', '/swims', { ...swim, endedAt: '2026-10-09T16:00:00-03:00' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/sessions/:id/music (5.2)', () => {
  it('registra a música da sessão com o horário do servidor', async () => {
    const session = await call('POST', '/sessions', {
      templateId: TEMPLATE_ID,
      painBefore: 1,
      onAntiInflammatory: false,
    });
    const id = session.body.id as string;
    const res = await call('POST', `/sessions/${id}/music`, {
      spotifyUri: 'spotify:playlist:37i9dQZF1DX76Wlfdnj7AP',
      name: 'Treino',
    });
    expect(res.status).toBe(201);
    expect(repo.music).toEqual([
      {
        sessionId: id,
        music: { spotifyUri: 'spotify:playlist:37i9dQZF1DX76Wlfdnj7AP', name: 'Treino' },
        startedAt: '2026-10-11T02:30:00.000Z',
      },
    ]);
  });

  it('400 para link que não é URI do Spotify; 404 para sessão inexistente', async () => {
    const body = { spotifyUri: 'https://open.spotify.com/playlist/x', name: null };
    expect((await call('POST', `/sessions/${MISSING}/music`, body)).status).toBe(400);
    expect(
      (
        await call('POST', `/sessions/${MISSING}/music`, {
          spotifyUri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
          name: null,
        })
      ).status,
    ).toBe(404);
  });
});

describe('GET /api/recovery (4.1)', () => {
  it('devolve os eventos em ordem cronológica e exige a chave', async () => {
    const base = {
      painBefore: 2,
      painAfter: 1,
      onAntiInflammatory: true,
      sleepHours: 7,
      sleepScore: null,
      weightKg: 75,
      alcoholDoses: 0,
    };
    repo.recovery = [
      {
        ...base,
        id: 'b',
        kind: 'core',
        date: '2026-10-10',
        startedAt: '2026-10-10T12:00:00Z',
        distanceM: null,
        kick: null,
      },
      {
        ...base,
        id: 'a',
        kind: 'swim',
        date: '2026-10-09',
        startedAt: '2026-10-09T19:12:00Z',
        distanceM: 1552,
        kick: 'none',
      },
    ];
    const res = await call('GET', '/recovery');
    expect(res.status).toBe(200);
    expect((res.body.events as { id: string }[]).map((e) => e.id)).toEqual(['a', 'b']);
    expect((await call('GET', '/recovery', undefined, null)).status).toBe(401);
  });
});

describe('erros internos', () => {
  it('500 genérico, sem vazar a mensagem do banco', async () => {
    await new Promise((resolve) => server.close(resolve));
    const failing = new MemoryKneeRepository([template]);
    failing.getTemplate = async () => {
      throw new Error('connection to db.qktebgvnejjhpfdriert failed: password authentication');
    };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await start(failing);

    const res = await call('GET', `/templates/${TEMPLATE_ID}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Erro interno' });
    log.mockRestore();
  });

  it('404 em JSON para rota desconhecida', async () => {
    const res = await call('GET', '/nao-existe');
    expect(res.status).toBe(404);
  });
});

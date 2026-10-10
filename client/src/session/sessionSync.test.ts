import { describe, expect, it } from 'vitest';
import type { SessionItem } from '@knee/shared';
import { ApiHttpError, UnauthorizedError } from '../api';
import { SessionSync, type SyncState } from './sessionSync';

const TEMPLATE_ID = '6ac8cc81-f371-4a0d-9f2d-f944b7f23148';
const item = (setNumber: number): SessionItem => ({
  exerciseId: 'f554ba9d-fbf1-4b49-8177-5219caf36455',
  setNumber,
  plannedDurationSeconds: 40,
  actualDurationSeconds: 40,
  plannedRestSeconds: 30,
  actualRestSeconds: 30,
  completed: true,
  skipped: false,
});

/** API falsa: registra as chamadas; `failures` lista erros a lançar, na ordem. */
function fakeApi(failures: unknown[] = []) {
  const calls: string[] = [];
  const next = async () => {
    const failure = failures.shift();
    if (failure) throw failure;
  };
  let releaseCreate: () => void = () => {};
  const createGate = { blocked: false };
  const api = {
    createSession: async () => {
      if (createGate.blocked) await new Promise<void>((r) => (releaseCreate = r));
      await next();
      calls.push('create');
      return { id: 'sess-1', dailyLogId: 'day-1', date: '2026-10-10', startedAt: '' };
    },
    addSessionItem: async (sessionId: string, i: SessionItem) => {
      await next();
      calls.push(`item:${sessionId}:${i.setNumber}`);
      return { id: `item-${i.setNumber}` };
    },
    finishSession: async (sessionId: string) => {
      await next();
      calls.push(`finish:${sessionId}`);
      return { id: sessionId, startedAt: '', endedAt: '' };
    },
  };
  return { api, calls, createGate, releaseCreate: () => releaseCreate() };
}

function setup(failures: unknown[] = []) {
  const f = fakeApi(failures);
  const states: SyncState[] = [];
  const waits: number[] = [];
  const sync = new SessionSync(
    f.api,
    (s) => states.push(s),
    async (ms) => {
      waits.push(ms);
    },
    [10, 20, 30],
  );
  return { ...f, sync, states, waits };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const startBody = { templateId: TEMPLATE_ID, painBefore: 3, onAntiInflammatory: true };

describe('SessionSync', () => {
  it('cria, grava as séries em ordem e finaliza', async () => {
    const t = setup();
    t.sync.start(startBody);
    t.sync.addItem(item(1));
    t.sync.addItem(item(2));
    t.sync.finish({ painAfter: 2 });
    await settle();
    expect(t.calls).toEqual(['create', 'item:sess-1:1', 'item:sess-1:2', 'finish:sess-1']);
    expect(t.sync.snapshot).toMatchObject({ status: 'saved', pending: 0, sessionId: 'sess-1' });
  });

  it('séries que chegam antes da sessão existir esperam na fila', async () => {
    const t = setup();
    t.createGate.blocked = true;
    t.sync.start(startBody);
    t.sync.addItem(item(1));
    await settle();
    expect(t.calls).toEqual([]);
    expect(t.sync.snapshot.pending).toBe(2);

    t.releaseCreate();
    await settle();
    expect(t.calls).toEqual(['create', 'item:sess-1:1']);
    expect(t.sync.snapshot.status).toBe('idle'); // sessão aberta, nada pendente
  });

  it('falha de rede e 5xx: tenta de novo com espera crescente, sem perder nem duplicar', async () => {
    const t = setup([new TypeError('Failed to fetch'), new ApiHttpError(503, 'indisponível')]);
    t.sync.start(startBody);
    t.sync.addItem(item(1));
    await settle();
    expect(t.calls).toEqual(['create', 'item:sess-1:1']);
    expect(t.waits).toEqual([10, 20]);
    expect(t.states.some((s) => s.status === 'retrying')).toBe(true);
    expect(t.sync.snapshot.error).toBeNull();
  });

  it('erro definitivo (4xx) para a fila e mostra o motivo', async () => {
    const t = setup([new ApiHttpError(404, 'Template não encontrado')]);
    t.sync.start(startBody);
    t.sync.addItem(item(1));
    await settle();
    expect(t.calls).toEqual([]);
    expect(t.sync.snapshot).toMatchObject({ status: 'failed', error: 'Template não encontrado' });

    t.sync.addItem(item(2)); // ignorado depois de falhar
    await settle();
    expect(t.calls).toEqual([]);
  });

  it('chave recusada não é repetida', async () => {
    const t = setup([new UnauthorizedError()]);
    t.sync.start(startBody);
    await settle();
    expect(t.waits).toEqual([]);
    expect(t.sync.snapshot).toMatchObject({
      status: 'failed',
      error: 'Chave do aparelho recusada',
    });
  });

  it('409 ao finalizar conta como salvo (a primeira tentativa já tinha chegado)', async () => {
    const t = setup();
    t.sync.start(startBody);
    await settle();
    t.api.finishSession = async () => {
      throw new ApiHttpError(409, 'Sessão já finalizada');
    };
    t.sync.finish({ painAfter: 1 });
    await settle();
    expect(t.sync.snapshot.status).toBe('saved');
  });

  it('série sem sessão criada é erro definitivo, não repetição infinita', async () => {
    const t = setup();
    t.sync.addItem(item(1));
    await settle();
    expect(t.waits).toEqual([]);
    expect(t.sync.snapshot.status).toBe('failed');
  });
});

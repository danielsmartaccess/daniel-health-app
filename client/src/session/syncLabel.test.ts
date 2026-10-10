import { describe, expect, it } from 'vitest';
import type { SyncState } from './sessionSync';
import { syncLabel } from './syncLabel';

const state = (patch: Partial<SyncState>): SyncState => ({
  status: 'idle',
  pending: 0,
  sessionId: null,
  error: null,
  ...patch,
});

describe('syncLabel', () => {
  it('nada antes de o treino começar', () => {
    expect(syncLabel(state({}), false)).toBeNull();
  });

  it('gravando, salvando, sem conexão, salvo e falha', () => {
    expect(syncLabel(state({ sessionId: 's' }), true)).toEqual({ text: 'Gravando', tone: 'ok' });
    expect(syncLabel(state({ status: 'saving' }), true)?.text).toBe('Salvando…');
    expect(syncLabel(state({ status: 'retrying' }), true)?.tone).toBe('warn');
    expect(syncLabel(state({ status: 'saved' }), true)?.text).toBe('Treino salvo');
    expect(syncLabel(state({ status: 'failed', error: 'Template não encontrado' }), true)).toEqual({
      text: 'Não salvou: Template não encontrado',
      tone: 'error',
    });
  });
});

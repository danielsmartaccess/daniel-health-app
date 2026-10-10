import type { SyncState } from './sessionSync';

export interface SyncLabel {
  text: string;
  tone: 'ok' | 'warn' | 'error';
}

/** Texto do indicador de gravação. null antes de o treino começar. */
export function syncLabel(state: SyncState, started: boolean): SyncLabel | null {
  if (!started) return null;
  switch (state.status) {
    case 'saving':
      return { text: 'Salvando…', tone: 'ok' };
    case 'retrying':
      return { text: 'Sem conexão · tentando de novo', tone: 'warn' };
    case 'failed':
      return { text: `Não salvou: ${state.error ?? 'erro'}`, tone: 'error' };
    case 'saved':
      return { text: 'Treino salvo', tone: 'ok' };
    case 'idle':
      return { text: state.sessionId ? 'Gravando' : 'Salvando…', tone: 'ok' };
  }
}

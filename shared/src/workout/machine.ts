import type { SessionItem } from '../schemas';
import type { Block, WorkBlock } from './plan';

/**
 * Máquina de estados do treino guiado. Função pura: o tempo entra sempre como `now` (ms epoch).
 *
 * Cronômetro por timestamp, não por contagem de ticks: o restante é calculado como
 * `duração − tempo decorrido`, então ticks atrasados (aba em segundo plano, tela apagada)
 * não distorcem o tempo. Pausa não consome tempo.
 *
 *   idle ──start──▶ running ⇄ resting ──(fim do plano | finish)──▶ finished
 *                     │  ▲       │  ▲
 *                   pause resume pause resume
 *                     ▼  │       ▼  │
 *                      paused ◀──┘
 */

export type Status = 'idle' | 'running' | 'resting' | 'paused' | 'finished';
type ActiveStatus = 'running' | 'resting';

export interface WorkoutState {
  readonly plan: readonly Block[];
  readonly status: Status;
  readonly index: number;
  /** Tempo já decorrido no bloco atual antes do segmento corrente (soma das partes entre pausas). */
  readonly accumulatedMs: number;
  /** Início do segmento corrente; null quando parado (idle, paused, finished). */
  readonly segmentStartedAt: number | null;
  readonly pausedFrom: ActiveStatus | null;
  /** Aviso de voz dos últimos 5 s já disparado neste bloco. */
  readonly warned: boolean;
  /** Série cujo trabalho terminou e que aguarda o fim do descanso para ser gravada. */
  readonly pendingItem: SessionItem | null;
}

export type WorkoutEvent =
  | { type: 'start'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  /** Pula o bloco atual (trabalho ou descanso). */
  | { type: 'skip'; now: number }
  /** "Concluí": encerra um bloco de repetições. */
  | { type: 'complete'; now: number }
  /** Encerra o treino antes do fim do plano. */
  | { type: 'finish'; now: number };

export type Effect =
  | { type: 'speak'; text: string }
  /** Série pronta para POST /api/sessions/:id/items. */
  | { type: 'item'; item: SessionItem }
  | { type: 'finished' };

export interface Transition {
  state: WorkoutState;
  effects: Effect[];
}

export const VOICE_WARNING_MS = 5_000;

export function createWorkout(plan: readonly Block[]): WorkoutState {
  return {
    plan,
    status: 'idle',
    index: 0,
    accumulatedMs: 0,
    segmentStartedAt: null,
    pausedFrom: null,
    warned: false,
    pendingItem: null,
  };
}

/** Transição inválida devolve o MESMO estado (mesma referência) e nenhum efeito. */
export function transition(state: WorkoutState, event: WorkoutEvent): Transition {
  switch (event.type) {
    case 'start':
      return state.status === 'idle' ? enterBlock(state, 0, event.now, []) : unchanged(state);
    case 'tick':
      return isActive(state.status) ? tick(state, event.now) : unchanged(state);
    case 'pause':
      return isActive(state.status) ? pause(state, event.now) : unchanged(state);
    case 'resume':
      return state.status === 'paused' && state.pausedFrom
        ? {
            state: {
              ...state,
              status: state.pausedFrom,
              pausedFrom: null,
              segmentStartedAt: event.now,
            },
            effects: [],
          }
        : unchanged(state);
    case 'skip':
      return isActive(state.status)
        ? endBlock(state, event.now, 'skipped', elapsedMs(state, event.now))
        : unchanged(state);
    case 'complete': {
      const block = currentBlock(state);
      return state.status === 'running' && block?.kind === 'work' && block.mode === 'reps'
        ? endBlock(state, event.now, 'completed', elapsedMs(state, event.now))
        : unchanged(state);
    }
    case 'finish':
      return isActive(state.status) || state.status === 'paused'
        ? finishEarly(state, event.now)
        : unchanged(state);
  }
}

// ─── Leitura (seletores puros para a UI) ────────────────────────────────────────

export function currentBlock(state: WorkoutState): Block | undefined {
  return state.plan[state.index];
}

export function elapsedMs(state: WorkoutState, now: number): number {
  const running = state.segmentStartedAt === null ? 0 : Math.max(0, now - state.segmentStartedAt);
  return state.accumulatedMs + running;
}

/** Restante do bloco atual; null em blocos de repetições (sem duração fixa). */
export function remainingMs(state: WorkoutState, now: number): number | null {
  const duration = currentBlock(state)?.durationMs ?? null;
  return duration === null ? null : Math.max(0, duration - elapsedMs(state, now));
}

/** Progresso geral 0..1 para a barra "tipo vídeo", baseado nas estimativas dos blocos. */
export function overallProgress(state: WorkoutState, now: number): number {
  const total = state.plan.reduce((sum, block) => sum + block.estimatedMs, 0);
  if (state.status === 'finished') return 1;
  if (total === 0 || state.status === 'idle') return 0;

  const done = state.plan.slice(0, state.index).reduce((sum, block) => sum + block.estimatedMs, 0);
  const block = currentBlock(state);
  const partial = block ? Math.min(elapsedMs(state, now), block.estimatedMs) : 0;
  return Math.min(1, (done + partial) / total);
}

// ─── Transições internas ─────────────────────────────────────────────────────────

function unchanged(state: WorkoutState): Transition {
  return { state, effects: [] };
}

function isActive(status: Status): status is ActiveStatus {
  return status === 'running' || status === 'resting';
}

function enterBlock(state: WorkoutState, index: number, at: number, effects: Effect[]): Transition {
  const block = state.plan[index];
  if (!block) {
    return {
      state: {
        ...state,
        status: 'finished',
        index: state.plan.length,
        accumulatedMs: 0,
        segmentStartedAt: null,
        pausedFrom: null,
        warned: false,
      },
      effects: [...effects, { type: 'finished' }],
    };
  }
  return {
    state: {
      ...state,
      status: block.kind === 'work' ? 'running' : 'resting',
      index,
      accumulatedMs: 0,
      segmentStartedAt: at,
      pausedFrom: null,
      warned: false,
    },
    effects,
  };
}

/** Avança blocos de tempo já expirados (inclusive vários, após a aba dormir) e dispara a voz. */
function tick(initial: WorkoutState, now: number): Transition {
  let state = initial;
  const effects: Effect[] = [];

  for (;;) {
    const block = currentBlock(state);
    if (!isActive(state.status) || !block || block.durationMs === null) break;
    if (state.segmentStartedAt === null) break;

    const endsAt = state.segmentStartedAt + (block.durationMs - state.accumulatedMs);
    if (now < endsAt) break;

    // O próximo bloco começa no fim previsto deste, não no tick atrasado.
    const next = endBlock(state, endsAt, 'completed', block.durationMs);
    state = next.state;
    effects.push(...next.effects);
  }

  const remaining = remainingMs(state, now);
  if (isActive(state.status) && !state.warned && remaining !== null) {
    if (remaining <= VOICE_WARNING_MS) {
      state = { ...state, warned: true };
      effects.push({ type: 'speak', text: warningText(state) });
    }
  }

  return state === initial ? unchanged(initial) : { state, effects };
}

function pause(state: WorkoutState, now: number): Transition {
  return {
    state: {
      ...state,
      status: 'paused',
      pausedFrom: state.status as ActiveStatus,
      accumulatedMs: elapsedMs(state, now),
      segmentStartedAt: null,
    },
    effects: [],
  };
}

/** Encerra o bloco atual em `at` e entra no próximo. Grava a série quando ela fica completa. */
function endBlock(
  state: WorkoutState,
  at: number,
  outcome: 'completed' | 'skipped',
  actualMs: number,
): Transition {
  const block = currentBlock(state);
  if (!block) return unchanged(state);

  const effects: Effect[] = [];
  let pendingItem = state.pendingItem;

  if (block.kind === 'work') {
    const next = state.plan[state.index + 1];
    const item = draftItem(
      block,
      outcome,
      actualMs,
      next?.kind === 'rest' ? next.durationMs : null,
    );
    if (next?.kind === 'rest') {
      pendingItem = item;
    } else {
      effects.push({ type: 'item', item });
      pendingItem = null;
    }
  } else if (pendingItem) {
    effects.push({
      type: 'item',
      item: { ...pendingItem, actualRestSeconds: toSeconds(actualMs) },
    });
    pendingItem = null;
  }

  return enterBlock({ ...state, pendingItem }, state.index + 1, at, effects);
}

/** Encerra o treino antes do fim: o bloco atual conta como pulado e a série parcial é gravada. */
function finishEarly(state: WorkoutState, now: number): Transition {
  const block = currentBlock(state);
  const elapsed = elapsedMs(state, now);
  const effects: Effect[] = [];

  if (block?.kind === 'work') {
    effects.push({ type: 'item', item: draftItem(block, 'skipped', elapsed, null) });
  } else if (state.pendingItem) {
    effects.push({
      type: 'item',
      item: { ...state.pendingItem, actualRestSeconds: toSeconds(elapsed) },
    });
  }
  effects.push({ type: 'finished' });

  return {
    state: {
      ...state,
      status: 'finished',
      accumulatedMs: 0,
      segmentStartedAt: null,
      pausedFrom: null,
      pendingItem: null,
    },
    effects,
  };
}

function draftItem(
  block: WorkBlock,
  outcome: 'completed' | 'skipped',
  actualMs: number,
  plannedRestMs: number | null,
): SessionItem {
  return {
    exerciseId: block.exerciseId,
    setNumber: block.setNumber,
    plannedDurationSeconds: block.durationMs === null ? null : toSeconds(block.durationMs),
    actualDurationSeconds: toSeconds(actualMs),
    plannedRestSeconds: plannedRestMs === null ? null : toSeconds(plannedRestMs),
    actualRestSeconds: null,
    completed: outcome === 'completed',
    skipped: outcome === 'skipped',
  };
}

function toSeconds(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

/** Texto do aviso dos últimos 5 s, conforme o bloco atual. */
export function warningText(state: WorkoutState): string {
  const block = currentBlock(state);
  if (block?.kind === 'rest') {
    const next = state.plan[state.index + 1];
    if (next?.kind !== 'work') return 'Fim do descanso';
    const target =
      next.mode === 'reps' && next.reps
        ? `${next.reps} repetições`
        : `${Math.round((next.durationMs ?? 0) / 1000)} segundos`;
    return `Próximo: ${next.spokenName}, ${target}`;
  }
  return state.index === state.plan.length - 1 ? 'Últimos 5 segundos' : 'Faltam 5 segundos';
}

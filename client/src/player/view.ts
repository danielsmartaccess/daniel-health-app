import {
  currentBlock,
  elapsedMs,
  overallProgress,
  remainingMs,
  type Block,
  type Status,
  type WorkBlock,
  type WorkoutState,
} from '@knee/shared';

/**
 * Modelo de tela do player: tudo o que a UI mostra, calculado a partir do estado da
 * máquina e do instante atual. Puro e testável; os componentes só desenham.
 */
export interface SegmentView {
  kind: 'work' | 'rest';
  /** Largura relativa na linha do tempo (estimativa do bloco). */
  weight: number;
  /** Quanto do segmento já foi percorrido, 0..1. */
  fill: number;
  current: boolean;
}

export interface PlayerView {
  status: Status;
  kind: 'work' | 'rest' | null;
  title: string;
  subtitle: string;
  mode: 'time' | 'reps' | null;
  reps: number | null;
  remainingMs: number | null;
  elapsedMs: number;
  /** Progresso do bloco atual, 0..1; null em repetições (sem duração fixa). */
  blockFraction: number | null;
  next: string | null;
  overall: number;
  segments: SegmentView[];
  /** Rótulo curto acima do título: "Agora", "Pausado" ou vazio. */
  label: string;
  canStart: boolean;
  canComplete: boolean;
  canPause: boolean;
  canResume: boolean;
  canSkip: boolean;
  canFinish: boolean;
  /** Tela deve ficar acesa (treino em andamento, inclusive pausado). */
  keepAwake: boolean;
}

export function toPlayerView(state: WorkoutState, now: number): PlayerView {
  // Antes de iniciar e depois do fim não há bloco "em curso" para mostrar.
  const inProgress = state.status !== 'idle' && state.status !== 'finished';
  const block = inProgress ? currentBlock(state) : undefined;
  const remaining = block ? remainingMs(state, now) : null;
  const elapsed = block ? elapsedMs(state, now) : 0;
  const exerciseIds = uniqueExerciseIds(state.plan);
  const active = state.status === 'running' || state.status === 'resting';

  return {
    status: state.status,
    kind: block?.kind ?? null,
    title: titleOf(state, block),
    subtitle: subtitleOf(state, block, exerciseIds),
    mode: block?.kind === 'work' ? block.mode : null,
    reps: block?.kind === 'work' ? block.reps : null,
    remainingMs: remaining,
    elapsedMs: elapsed,
    blockFraction:
      block?.durationMs && remaining !== null ? 1 - remaining / block.durationMs : null,
    next: nextLabel(state),
    overall: overallProgress(state, now),
    segments: segmentsOf(state, elapsed),
    label: state.status === 'paused' ? 'Pausado' : block?.kind === 'work' ? 'Agora' : '',
    canStart: state.status === 'idle' && state.plan.length > 0,
    canComplete: state.status === 'running' && block?.kind === 'work' && block.mode === 'reps',
    canPause: active,
    canResume: state.status === 'paused',
    canSkip: active,
    canFinish: inProgress,
    keepAwake: inProgress,
  };
}

/**
 * Fala do botão "Iniciar treino". No iPhone, a primeira fala precisa acontecer no toque:
 * anunciar o primeiro exercício destrava a voz para os avisos dos últimos 5 s.
 */
export function startAnnouncement(state: WorkoutState): string {
  const first = state.plan.find((b): b is WorkBlock => b.kind === 'work');
  return first ? `Começando. ${first.spokenName}, ${spokenTarget(first)}` : 'Começando';
}

function spokenTarget(block: WorkBlock): string {
  if (block.mode === 'reps') return block.reps ? `${block.reps} repetições` : 'repetições';
  return `${Math.round((block.durationMs ?? 0) / 1000)} segundos`;
}

export function targetLabel(block: WorkBlock): string {
  if (block.mode === 'reps') return block.reps ? `${block.reps} repetições` : 'repetições';
  return `${Math.round((block.durationMs ?? 0) / 1000)} s`;
}

function titleOf(state: WorkoutState, block: Block | undefined): string {
  if (state.status === 'finished') return 'Treino concluído';
  if (state.status === 'idle') {
    return state.plan.length > 0 ? 'Pronto para começar' : 'Sem exercícios';
  }
  return block?.kind === 'work' ? block.name : 'Descanso';
}

function subtitleOf(state: WorkoutState, block: Block | undefined, exerciseIds: string[]): string {
  if (state.status === 'finished') return `${exerciseIds.length} exercícios`;
  if (state.status === 'idle') {
    const sets = state.plan.filter((b) => b.kind === 'work').length;
    const totalMs = state.plan.reduce((sum, b) => sum + b.estimatedMs, 0);
    const minutes = Math.max(1, Math.round(totalMs / 60_000));
    return `${exerciseIds.length} exercícios · ${sets} séries · ~${minutes} min`;
  }
  if (block?.kind !== 'work') return 'Respire e solte o corpo';
  const ordinal = exerciseIds.indexOf(block.exerciseId) + 1;
  return `Exercício ${ordinal} de ${exerciseIds.length} · Série ${block.setNumber} de ${block.totalSets}`;
}

function nextLabel(state: WorkoutState): string | null {
  if (state.status === 'finished') return null;
  const from = state.status === 'idle' ? 0 : state.index + 1;
  const next = state.plan.slice(from).find((b): b is WorkBlock => b.kind === 'work');
  return next ? `${next.name} · ${targetLabel(next)}` : null;
}

function segmentsOf(state: WorkoutState, elapsed: number): SegmentView[] {
  return state.plan.map((block, i) => {
    let fill = 0;
    if (state.status === 'finished' || i < state.index) fill = 1;
    else if (i === state.index && state.status !== 'idle') {
      fill = block.estimatedMs > 0 ? Math.min(1, elapsed / block.estimatedMs) : 0;
    }
    return {
      kind: block.kind,
      weight: block.estimatedMs,
      fill,
      current: i === state.index && state.status !== 'idle' && state.status !== 'finished',
    };
  });
}

function uniqueExerciseIds(plan: readonly Block[]): string[] {
  const ids: string[] = [];
  for (const block of plan) {
    if (block.kind === 'work' && !ids.includes(block.exerciseId)) ids.push(block.exerciseId);
  }
  return ids;
}

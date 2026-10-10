import { describe, expect, it } from 'vitest';
import { buildPlan, createWorkout, transition, type TemplateItemInput } from '@knee/shared';
import { formatCountdown, formatElapsed } from './format';
import { toPlayerView } from './view';

const S = 1000;
const items: TemplateItemInput[] = [
  {
    exerciseId: 'f554ba9d-fbf1-4b49-8177-5219caf36455',
    name: 'Prancha',
    mode: 'time',
    voiceInstruction: 'Prancha',
    orderIndex: 1,
    sets: 2,
    durationSeconds: 40,
    reps: null,
    restSeconds: 30,
  },
  {
    exerciseId: '61736bd9-a3d0-4531-888c-624b111a7b30',
    name: 'Superman',
    mode: 'reps',
    voiceInstruction: 'Superman',
    orderIndex: 2,
    sets: 1,
    durationSeconds: 30,
    reps: 12,
    restSeconds: 30,
  },
];
const idle = createWorkout(buildPlan(items));
const at = (events: Parameters<typeof transition>[1][]) =>
  events.reduce((state, event) => transition(state, event).state, idle);

describe('formatação de tempo', () => {
  it('contagem regressiva arredonda para cima; decorrido, para baixo', () => {
    expect(formatCountdown(39_001)).toBe('0:40');
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatElapsed(61_999)).toBe('1:01');
    expect(formatElapsed(-5)).toBe('0:00');
  });
});

describe('toPlayerView', () => {
  it('antes de começar: resumo do treino e botão iniciar', () => {
    const view = toPlayerView(idle, 0);
    expect(view).toMatchObject({
      title: 'Pronto para começar',
      // estimativa: 40 + 30 + 40 + 30 + 30 = 170 s ≈ 3 min
      subtitle: '2 exercícios · 3 séries · ~3 min',
      // nada "em curso" antes de iniciar (sem rótulo, sem meta, sem contagem)
      kind: null,
      mode: null,
      reps: null,
      remainingMs: null,
      next: 'Prancha · 40 s',
      canStart: true,
      canComplete: false,
      overall: 0,
    });
    expect(view.segments.every((s) => s.fill === 0 && !s.current)).toBe(true);
  });

  it('bloco de tempo: contagem, fração do bloco e próximo exercício', () => {
    const view = toPlayerView(at([{ type: 'start', now: 0 }]), 10 * S);
    expect(view).toMatchObject({
      kind: 'work',
      mode: 'time',
      title: 'Prancha',
      subtitle: 'Exercício 1 de 2 · Série 1 de 2',
      remainingMs: 30 * S,
      next: 'Prancha · 40 s',
      canStart: false,
    });
    expect(view.blockFraction).toBeCloseTo(0.25);
    expect(view.segments[0]).toMatchObject({ current: true, fill: 0.25 });
  });

  it('descanso: anuncia o próximo exercício', () => {
    const view = toPlayerView(
      at([
        { type: 'start', now: 0 },
        { type: 'tick', now: 40 * S },
      ]),
      45 * S,
    );
    expect(view).toMatchObject({ kind: 'rest', title: 'Descanso', mode: null });
    expect(view.segments[0]?.fill).toBe(1);
  });

  it('repetições: sem contagem, mostra a meta e libera o "concluí"', () => {
    const view = toPlayerView(
      at([
        { type: 'start', now: 0 },
        { type: 'tick', now: 140 * S },
      ]),
      150 * S,
    );
    expect(view).toMatchObject({
      title: 'Superman',
      subtitle: 'Exercício 2 de 2 · Série 1 de 1',
      mode: 'reps',
      reps: 12,
      remainingMs: null,
      blockFraction: null,
      elapsedMs: 10 * S,
      next: null,
      canComplete: true,
    });
  });

  it('fim: tudo preenchido', () => {
    const done = at([
      { type: 'start', now: 0 },
      { type: 'tick', now: 140 * S },
      { type: 'complete', now: 160 * S },
    ]);
    const view = toPlayerView(done, 160 * S);
    expect(view).toMatchObject({ title: 'Treino concluído', overall: 1, canComplete: false });
    expect(view.segments.every((s) => s.fill === 1)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createWorkout,
  elapsedMs,
  overallProgress,
  remainingMs,
  transition,
  type Effect,
  type WorkoutEvent,
  type WorkoutState,
} from './machine';
import { buildPlan, type TemplateItemInput } from './plan';

const PLANK = 'f554ba9d-fbf1-4b49-8177-5219caf36455';
const SUPERMAN = '61736bd9-a3d0-4531-888c-624b111a7b30';
const S = 1000;

const items: TemplateItemInput[] = [
  // fora de ordem de propósito: o plano ordena por orderIndex
  {
    exerciseId: SUPERMAN,
    name: 'Superman',
    mode: 'reps',
    voiceInstruction: 'Superman',
    orderIndex: 2,
    sets: 1,
    durationSeconds: 30,
    reps: 12,
    restSeconds: 30,
  },
  {
    exerciseId: PLANK,
    name: 'Prancha',
    mode: 'time',
    voiceInstruction: 'Prancha',
    orderIndex: 1,
    sets: 2,
    durationSeconds: 40,
    reps: null,
    restSeconds: 30,
  },
];

/** Plano: Prancha 1 (40 s) · descanso 30 s · Prancha 2 (40 s) · descanso 30 s · Superman (12 reps) */
const plan = buildPlan(items);

function run(events: WorkoutEvent[], from: WorkoutState = createWorkout(plan)) {
  let state = from;
  const effects: Effect[] = [];
  for (const event of events) {
    const result = transition(state, event);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const speaks = (effects: Effect[]) => effects.filter((e) => e.type === 'speak');
const itemsOf = (effects: Effect[]) => effects.flatMap((e) => (e.type === 'item' ? [e.item] : []));

describe('buildPlan', () => {
  it('gera trabalho + descanso por série, ordenado, sem descanso no fim', () => {
    expect(plan.map((b) => (b.kind === 'work' ? `${b.name}#${b.setNumber}` : 'rest'))).toEqual([
      'Prancha#1',
      'rest',
      'Prancha#2',
      'rest',
      'Superman#1',
    ]);
  });

  it('repetições não têm duração fixa; tempo tem', () => {
    expect(plan[0]).toMatchObject({ mode: 'time', durationMs: 40 * S });
    expect(plan[4]).toMatchObject({ mode: 'reps', durationMs: null, reps: 12 });
  });

  it('rejeita exercício por tempo sem duração e séries inválidas', () => {
    expect(() => buildPlan([{ ...items[1]!, durationSeconds: null }])).toThrow(RangeError);
    expect(() => buildPlan([{ ...items[1]!, sets: 0 }])).toThrow(RangeError);
  });
});

describe('transições válidas', () => {
  it('start: idle → running no primeiro bloco', () => {
    const { state } = run([{ type: 'start', now: 0 }]);
    expect(state).toMatchObject({ status: 'running', index: 0, segmentStartedAt: 0 });
    expect(remainingMs(state, 10 * S)).toBe(30 * S);
  });

  it('bloco de tempo expira no tick e entra no descanso no instante previsto', () => {
    const { state } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 41 * S },
    ]);
    expect(state).toMatchObject({ status: 'resting', index: 1, segmentStartedAt: 40 * S });
    expect(remainingMs(state, 41 * S)).toBe(29 * S);
  });

  it('a série é gravada só quando o descanso dela termina, com o descanso real', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 40 * S },
      { type: 'skip', now: 52 * S }, // descansou 12 s dos 30 planejados
    ]);
    expect(itemsOf(effects)).toEqual([
      {
        exerciseId: PLANK,
        setNumber: 1,
        plannedDurationSeconds: 40,
        actualDurationSeconds: 40,
        plannedRestSeconds: 30,
        actualRestSeconds: 12,
        completed: true,
        skipped: false,
      },
    ]);
  });

  it('pular o descanso começa o próximo bloco na hora', () => {
    const { state } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 40 * S },
      { type: 'skip', now: 52 * S },
    ]);
    expect(state).toMatchObject({ status: 'running', index: 2, segmentStartedAt: 52 * S });
  });

  it('pular um bloco de trabalho grava a série como pulada, com o tempo real', () => {
    const { state, effects } = run([
      { type: 'start', now: 0 },
      { type: 'skip', now: 15 * S },
      { type: 'tick', now: 45 * S }, // descanso inteiro: 15 s → 45 s
    ]);
    expect(state.index).toBe(2);
    expect(itemsOf(effects)[0]).toMatchObject({
      actualDurationSeconds: 15,
      actualRestSeconds: 30,
      completed: false,
      skipped: true,
    });
  });
});

describe('pausa', () => {
  it('não consome tempo do bloco', () => {
    const paused = run([
      { type: 'start', now: 0 },
      { type: 'pause', now: 10 * S },
    ]).state;
    expect(paused.status).toBe('paused');
    expect(elapsedMs(paused, 999 * S)).toBe(10 * S);

    const resumed = run(
      [
        { type: 'resume', now: 70 * S },
        { type: 'tick', now: 99 * S },
      ],
      paused,
    ).state;
    expect(resumed).toMatchObject({ status: 'running', index: 0 });
    expect(remainingMs(resumed, 99 * S)).toBe(1 * S);

    expect(transition(resumed, { type: 'tick', now: 100 * S }).state.status).toBe('resting');
  });

  it('retoma no mesmo tipo de bloco em que pausou (descanso)', () => {
    const { state } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 40 * S },
      { type: 'pause', now: 50 * S },
      { type: 'resume', now: 60 * S },
    ]);
    expect(state.status).toBe('resting');
    expect(remainingMs(state, 60 * S)).toBe(20 * S);
  });

  it('tick durante a pausa não faz nada', () => {
    const paused = run([
      { type: 'start', now: 0 },
      { type: 'pause', now: 10 * S },
    ]).state;
    expect(transition(paused, { type: 'tick', now: 500 * S }).state).toBe(paused);
  });
});

describe('voz nos últimos 5 s', () => {
  it('dispara uma única vez por bloco', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 34.9 * S }, // ainda faltam 5,1 s
      { type: 'tick', now: 35 * S },
      { type: 'tick', now: 36 * S },
      { type: 'tick', now: 39 * S },
    ]);
    expect(speaks(effects)).toEqual([{ type: 'speak', text: 'Faltam 5 segundos' }]);
  });

  it('volta a disparar no bloco seguinte, anunciando o próximo exercício', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 36 * S },
      { type: 'tick', now: 40 * S },
      { type: 'tick', now: 66 * S },
    ]);
    expect(speaks(effects).map((e) => (e.type === 'speak' ? e.text : ''))).toEqual([
      'Faltam 5 segundos',
      'Próximo: Prancha, 40 segundos',
    ]);
  });

  it('anuncia repetições quando o próximo é por repetição', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 110 * S }, // já no último descanso (110 s → 140 s)
      { type: 'tick', now: 136 * S },
    ]);
    expect(speaks(effects).at(-1)).toEqual({
      type: 'speak',
      text: 'Próximo: Superman, 12 repetições',
    });
  });

  it('não fala em bloco de repetições (não há "últimos 5 s")', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 140 * S },
      { type: 'tick', now: 400 * S },
    ]);
    expect(speaks(effects)).toEqual([]);
  });
});

describe('repetições: avança só no "concluí"', () => {
  const atSuperman = () =>
    run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 140 * S },
    ]).state;

  it('o tempo passa mas o bloco não expira', () => {
    const state = transition(atSuperman(), { type: 'tick', now: 999 * S }).state;
    expect(state).toMatchObject({ status: 'running', index: 4 });
    expect(remainingMs(state, 999 * S)).toBeNull();
  });

  it('concluí grava a série e, sendo o último bloco, finaliza', () => {
    const { state, effects } = run([{ type: 'complete', now: 165 * S }], atSuperman());
    expect(state.status).toBe('finished');
    expect(itemsOf(effects)).toEqual([
      {
        exerciseId: SUPERMAN,
        setNumber: 1,
        plannedDurationSeconds: null,
        actualDurationSeconds: 25,
        plannedRestSeconds: null,
        actualRestSeconds: null,
        completed: true,
        skipped: false,
      },
    ]);
    expect(effects.at(-1)).toEqual({ type: 'finished' });
  });

  it('concluí não vale em bloco de tempo nem no descanso', () => {
    const working = run([{ type: 'start', now: 0 }]).state;
    expect(transition(working, { type: 'complete', now: 5 * S }).state).toBe(working);
    const resting = transition(working, { type: 'tick', now: 40 * S }).state;
    expect(transition(resting, { type: 'complete', now: 45 * S }).state).toBe(resting);
  });
});

describe('aba em segundo plano (ticks atrasados)', () => {
  it('um tick tardio avança vários blocos mantendo os horários previstos', () => {
    const { state, effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 200 * S },
    ]);
    expect(state).toMatchObject({ status: 'running', index: 4, segmentStartedAt: 140 * S });
    expect(itemsOf(effects).map((i) => [i.setNumber, i.actualRestSeconds])).toEqual([
      [1, 30],
      [2, 30],
    ]);
    expect(speaks(effects)).toEqual([]); // avisos que já passaram não são falados atrasados
  });
});

describe('encerrar antes do fim', () => {
  it('no meio do trabalho: grava a série parcial como pulada e finaliza', () => {
    const { state, effects } = run([
      { type: 'start', now: 0 },
      { type: 'finish', now: 12 * S },
    ]);
    expect(state.status).toBe('finished');
    expect(itemsOf(effects)).toEqual([
      expect.objectContaining({ actualDurationSeconds: 12, skipped: true, completed: false }),
    ]);
    expect(effects.at(-1)).toEqual({ type: 'finished' });
  });

  it('no descanso: grava a série pendente com o descanso feito até ali', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'tick', now: 40 * S },
      { type: 'finish', now: 48 * S },
    ]);
    expect(itemsOf(effects)).toEqual([
      expect.objectContaining({ completed: true, actualRestSeconds: 8 }),
    ]);
  });

  it('pausado: usa o tempo acumulado até a pausa', () => {
    const { effects } = run([
      { type: 'start', now: 0 },
      { type: 'pause', now: 20 * S },
      { type: 'finish', now: 300 * S },
    ]);
    expect(itemsOf(effects)[0]).toMatchObject({ actualDurationSeconds: 20 });
  });
});

describe('transições inválidas devolvem o mesmo estado', () => {
  const idle = createWorkout(plan);
  const running = transition(idle, { type: 'start', now: 0 }).state;
  const finished = transition(running, { type: 'finish', now: 1 * S }).state;

  it.each<[string, WorkoutState, WorkoutEvent['type']]>([
    ['idle', idle, 'tick'],
    ['idle', idle, 'pause'],
    ['idle', idle, 'resume'],
    ['idle', idle, 'skip'],
    ['idle', idle, 'complete'],
    ['idle', idle, 'finish'],
    ['running', running, 'start'],
    ['running', running, 'resume'],
    ['finished', finished, 'start'],
    ['finished', finished, 'tick'],
    ['finished', finished, 'pause'],
    ['finished', finished, 'skip'],
    ['finished', finished, 'finish'],
  ])('%s + %s', (_label, state, type) => {
    const result = transition(state, { type, now: 5 * S } as WorkoutEvent);
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  it('plano vazio: start finaliza direto', () => {
    const { state, effects } = run([{ type: 'start', now: 0 }], createWorkout([]));
    expect(state.status).toBe('finished');
    expect(effects).toEqual([{ type: 'finished' }]);
  });
});

describe('overallProgress', () => {
  it('vai de 0 a 1 de forma monotônica ao longo do treino', () => {
    const idle = createWorkout(plan);
    expect(overallProgress(idle, 0)).toBe(0);

    const running = transition(idle, { type: 'start', now: 0 }).state;
    // estimativas: 40 + 30 + 40 + 30 + 30 = 170 s; aos 20 s → 20/170
    expect(overallProgress(running, 20 * S)).toBeCloseTo(20 / 170);

    const atSuperman = transition(running, { type: 'tick', now: 140 * S }).state;
    expect(overallProgress(atSuperman, 140 * S)).toBeCloseTo(140 / 170);
    // repetições demorando mais que a estimativa não passam de 100%
    expect(overallProgress(atSuperman, 999 * S)).toBeCloseTo(1);

    const done = transition(atSuperman, { type: 'complete', now: 200 * S }).state;
    expect(overallProgress(done, 200 * S)).toBe(1);
  });
});

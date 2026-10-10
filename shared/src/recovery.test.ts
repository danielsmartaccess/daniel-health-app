import { describe, expect, it } from 'vitest';
import {
  MIN_PAIRS_FOR_CORRELATION,
  pearson,
  recoveryInsights,
  type RecoveryEvent,
} from './recovery';

const event = (i: number, patch: Partial<RecoveryEvent> = {}): RecoveryEvent => ({
  id: `e${i}`,
  kind: 'core',
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  startedAt: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
  painBefore: 3,
  painAfter: 2,
  onAntiInflammatory: false,
  sleepHours: 7,
  sleepScore: null,
  weightKg: 75,
  alcoholDoses: 0,
  distanceM: null,
  kick: null,
  ...patch,
});

describe('pearson', () => {
  it('perfeita positiva, perfeita negativa e sem variação', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1], [1])).toBeNull();
  });
});

describe('recoveryInsights', () => {
  it('com menos de 10 pares não calcula correlação ("poucos dados")', () => {
    const events = Array.from({ length: MIN_PAIRS_FOR_CORRELATION - 1 }, (_, i) =>
      event(i, { sleepHours: 5 + i, painAfter: 9 - i }),
    );
    const sleep = recoveryInsights(events).factors.find((f) => f.factor === 'sleepHours')!;
    expect(sleep).toMatchObject({ pairs: 9, enough: false, r: null, strength: null });
  });

  it('com 10 pares calcula r e classifica a força', () => {
    // mais sono, menos dor: correlação negativa forte
    const events = Array.from({ length: 10 }, (_, i) =>
      event(i, { sleepHours: 5 + i * 0.3, painAfter: 9 - i }),
    );
    const sleep = recoveryInsights(events).factors.find((f) => f.factor === 'sleepHours')!;
    expect(sleep.enough).toBe(true);
    expect(sleep.r).toBeCloseTo(-1);
    expect(sleep.strength).toBe('forte');
  });

  it('só conta pares com os dois valores (dor depois e o fator)', () => {
    const events = [event(0), event(1, { painAfter: null }), event(2, { alcoholDoses: null })];
    const alcohol = recoveryInsights(events).factors.find((f) => f.factor === 'alcoholDoses')!;
    expect(alcohol.pairs).toBe(1);
  });

  it('resume total, dor registrada, anti-inflamatório e variação média', () => {
    const events = [
      event(0, { painBefore: 4, painAfter: 2, onAntiInflammatory: true }),
      event(1, { painBefore: 2, painAfter: 2 }),
      event(2, { kind: 'swim', painBefore: null, painAfter: null, onAntiInflammatory: true }),
    ];
    expect(recoveryInsights(events)).toMatchObject({
      total: 3,
      withPainAfter: 2,
      underAntiInflammatory: 2,
      averageChange: -1,
    });
  });

  it('sem notas de dor, a variação média é null', () => {
    expect(recoveryInsights([event(0, { painBefore: null })]).averageChange).toBeNull();
  });
});

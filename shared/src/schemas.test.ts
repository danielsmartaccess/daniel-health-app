import { describe, expect, it } from 'vitest';
import {
  createSessionBodySchema,
  finishSessionBodySchema,
  idSchema,
  sessionItemSchema,
} from './schemas';

const TEMPLATE_ID = '6ac8cc81-f371-4a0d-9f2d-f944b7f23148';
const EXERCISE_ID = 'f554ba9d-fbf1-4b49-8177-5219caf36455';

describe('idSchema', () => {
  it('aceita o UUID fixo do dono, que não é RFC v4', () => {
    expect(idSchema.safeParse('00000000-0000-0000-0000-000000000001').success).toBe(true);
  });
  it('rejeita texto que não é UUID', () => {
    expect(idSchema.safeParse('1; drop table').success).toBe(false);
  });
});

describe('createSessionBodySchema', () => {
  const valid = { templateId: TEMPLATE_ID, painBefore: 2, onAntiInflammatory: false };

  it('aceita payload válido', () => {
    expect(createSessionBodySchema.parse(valid)).toEqual(valid);
  });
  it.each([-1, 11, 2.5])('rejeita dor fora de 0..10 inteiro (%s)', (painBefore) => {
    expect(createSessionBodySchema.safeParse({ ...valid, painBefore }).success).toBe(false);
  });
  it('exige o campo de anti-inflamatório (confundidor de dor)', () => {
    const withoutFlag = { templateId: TEMPLATE_ID, painBefore: 2 };
    expect(createSessionBodySchema.safeParse(withoutFlag).success).toBe(false);
  });
  it('rejeita campos desconhecidos', () => {
    expect(createSessionBodySchema.safeParse({ ...valid, userId: 'x' }).success).toBe(false);
  });
});

describe('sessionItemSchema', () => {
  const valid = {
    exerciseId: EXERCISE_ID,
    setNumber: 1,
    plannedDurationSeconds: 40,
    actualDurationSeconds: 40,
    plannedRestSeconds: 30,
    actualRestSeconds: 12,
    completed: true,
    skipped: false,
  };

  it('aceita série válida, inclusive sem descanso e sem duração planejada (repetições)', () => {
    expect(sessionItemSchema.safeParse(valid).success).toBe(true);
    expect(
      sessionItemSchema.safeParse({
        ...valid,
        plannedDurationSeconds: null,
        plannedRestSeconds: null,
        actualRestSeconds: null,
      }).success,
    ).toBe(true);
  });
  it('rejeita série concluída e pulada ao mesmo tempo', () => {
    expect(sessionItemSchema.safeParse({ ...valid, skipped: true }).success).toBe(false);
  });
  it('rejeita série zero e tempo negativo', () => {
    expect(sessionItemSchema.safeParse({ ...valid, setNumber: 0 }).success).toBe(false);
    expect(sessionItemSchema.safeParse({ ...valid, actualDurationSeconds: -1 }).success).toBe(
      false,
    );
  });
});

describe('finishSessionBodySchema', () => {
  it('aceita só a dor depois, com notas opcionais', () => {
    expect(finishSessionBodySchema.safeParse({ painAfter: 1 }).success).toBe(true);
  });
  it('corta espaços e limita o tamanho das notas', () => {
    expect(finishSessionBodySchema.parse({ painAfter: 0, freeNotes: '  ok  ' }).freeNotes).toBe(
      'ok',
    );
    expect(
      finishSessionBodySchema.safeParse({ painAfter: 0, freeNotes: 'x'.repeat(2001) }).success,
    ).toBe(false);
  });
});

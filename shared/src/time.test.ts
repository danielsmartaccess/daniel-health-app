import { describe, expect, it } from 'vitest';
import { localDate } from './time';

describe('localDate (America/Sao_Paulo)', () => {
  it('23h30 locais continuam no mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
    expect(localDate(Date.parse('2026-10-11T02:30:00Z'))).toBe('2026-10-10');
  });

  it('meia-noite local vira o dia', () => {
    expect(localDate(Date.parse('2026-10-11T02:59:59Z'))).toBe('2026-10-10');
    expect(localDate(Date.parse('2026-10-11T03:00:00Z'))).toBe('2026-10-11');
  });

  it('manhã local cai no mesmo dia do UTC', () => {
    expect(localDate(new Date('2026-10-10T13:31:17Z'))).toBe('2026-10-10');
  });

  it('vira o ano corretamente', () => {
    expect(localDate(Date.parse('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
  });

  it('rejeita instante inválido', () => {
    expect(() => localDate(Number.NaN)).toThrow(RangeError);
  });
});

import { describe, expect, it } from 'vitest';
import type { FactorInsight } from '@knee/shared';
import {
  factorSentence,
  formatChange,
  formatDayMonth,
  formatNumber,
  formatPain,
  kickLabel,
  kindLabel,
} from './format';

const insight = (patch: Partial<FactorInsight>): FactorInsight => ({
  factor: 'sleepHours',
  label: 'Sono (horas)',
  pairs: 3,
  enough: false,
  r: null,
  strength: null,
  ...patch,
});

describe('formatação do painel', () => {
  it('data sem deslocamento de fuso', () => {
    expect(formatDayMonth('2026-10-09')).toBe('09/10');
  });

  it('rótulos de tipo e pernada', () => {
    expect(kindLabel('swim')).toBe('Natação');
    expect(kindLabel('core')).toBe('Core');
    expect(kickLabel('none')).toBe('só braço');
    expect(kickLabel(null)).toBeNull();
  });

  it('números em pt-BR e ausência como travessão', () => {
    expect(formatNumber(7.25, ' h')).toBe('7,3 h');
    expect(formatNumber(null)).toBe('—');
  });

  it('dor antes → depois', () => {
    expect(formatPain(2, 1)).toBe('2 → 1');
    expect(formatPain(3, null)).toBe('3 → —');
    expect(formatPain(null, null)).toBe('sem nota');
  });

  it('variação com sinal', () => {
    expect(formatChange(-1)).toBe('−1');
    expect(formatChange(0.5)).toBe('+0,5');
    expect(formatChange(0.01)).toBe('0');
    expect(formatChange(null)).toBe('—');
  });

  it('cruzamento: poucos dados abaixo de 10; r e força acima', () => {
    expect(factorSentence(insight({}))).toBe(
      'Poucos dados: 3 de 10 treinos com dor e sono registrados.',
    );
    expect(
      factorSentence(insight({ pairs: 12, enough: true, r: -0.42, strength: 'moderada' })),
    ).toBe('r = −0,42 · moderada (quanto mais, menos dor) · n = 12');
  });
});

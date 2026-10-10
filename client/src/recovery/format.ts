import { MIN_PAIRS_FOR_CORRELATION, type FactorInsight, type RecoveryEvent } from '@knee/shared';

const number1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const number2 = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Sinal tipográfico explícito (o Intl varia entre hífen e sinal de menos). */
const signed = (value: number, format: (n: number) => string) =>
  value === 0 ? format(0) : `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`;

/** 'YYYY-MM-DD' → 'dd/mm' sem passar por Date (evita deslocamento de fuso). */
export function formatDayMonth(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

export const kindLabel = (kind: RecoveryEvent['kind']) => (kind === 'swim' ? 'Natação' : 'Core');

const KICK_LABELS: Record<string, string> = {
  none: 'só braço',
  flutter: 'pernada crawl',
  dolphin: 'golfinho',
  breaststroke: 'pernada de peito',
  fins: 'nadadeira',
};
export const kickLabel = (kick: string | null) => (kick ? (KICK_LABELS[kick] ?? kick) : null);

export function formatNumber(value: number | null, unit = ''): string {
  return value === null ? '—' : `${number1.format(value)}${unit}`;
}

export function formatPain(before: number | null, after: number | null): string {
  if (before === null && after === null) return 'sem nota';
  return `${before ?? '—'} → ${after ?? '—'}`;
}

/** Variação média (depois − antes), com sinal: "−1", "+0,5", "0". */
export function formatChange(change: number | null): string {
  if (change === null) return '—';
  const rounded = Math.round(change * 10) / 10;
  return signed(rounded, (n) => number1.format(n));
}

const FACTOR_NOUN: Record<FactorInsight['factor'], string> = {
  sleepHours: 'sono',
  alcoholDoses: 'álcool',
  weightKg: 'peso',
};

/** Frase de um cruzamento: "poucos dados" abaixo de 10 pares; r, força e n acima. */
export function factorSentence(insight: FactorInsight): string {
  if (!insight.enough) {
    return `Poucos dados: ${insight.pairs} de ${MIN_PAIRS_FOR_CORRELATION} treinos com dor e ${FACTOR_NOUN[insight.factor]} registrados.`;
  }
  if (insight.r === null) return `Sem variação suficiente para comparar (n = ${insight.pairs}).`;
  const direction = insight.r < 0 ? 'quanto mais, menos dor' : 'quanto mais, mais dor';
  const r = signed(insight.r, (n) => number2.format(n));
  return `r = ${r} · ${insight.strength} (${direction}) · n = ${insight.pairs}`;
}

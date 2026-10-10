/**
 * Card 4.1 — painel de recuperação: um evento por treino (core guiado ou natação),
 * cruzado com sono, peso e álcool do mesmo dia (dados do health app).
 *
 * Regras estatísticas (do prompt de fusão):
 *  - correlação só com >= 10 pares; abaixo disso, "poucos dados";
 *  - dor sob anti-inflamatório é sinalizada: ela pode estar mascarada;
 *  - correlação não é causa, e álcool/sono do MESMO dia (limite da visão aprovada).
 */
export type RecoveryKind = 'core' | 'swim';

export interface RecoveryEvent {
  id: string;
  kind: RecoveryKind;
  date: string;
  startedAt: string;
  painBefore: number | null;
  painAfter: number | null;
  onAntiInflammatory: boolean | null;
  sleepHours: number | null;
  sleepScore: number | null;
  weightKg: number | null;
  alcoholDoses: number | null;
  /** Só natação. */
  distanceM: number | null;
  kick: string | null;
}

/** GET /api/recovery */
export interface RecoveryDto {
  events: RecoveryEvent[];
}

export const MIN_PAIRS_FOR_CORRELATION = 10;

export type FactorKey = 'sleepHours' | 'alcoholDoses' | 'weightKg';

export interface FactorInsight {
  factor: FactorKey;
  label: string;
  /** Pares (dor depois, fator) com os dois valores presentes. */
  pairs: number;
  enough: boolean;
  /** Pearson r; null quando não há pares suficientes ou variação. */
  r: number | null;
  strength: 'fraca' | 'moderada' | 'forte' | null;
}

export interface RecoveryInsights {
  total: number;
  withPainAfter: number;
  underAntiInflammatory: number;
  /** Média de (dor depois − dor antes) nos treinos com as duas notas. */
  averageChange: number | null;
  factors: FactorInsight[];
}

const FACTORS: { factor: FactorKey; label: string }[] = [
  { factor: 'sleepHours', label: 'Sono (horas)' },
  { factor: 'alcoholDoses', label: 'Álcool (doses no dia)' },
  { factor: 'weightKg', label: 'Peso (kg)' },
];

/** Coeficiente de Pearson; null com menos de 2 pares ou sem variação em um dos lados. */
export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mean = (v: readonly number[]) => v.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

function strengthOf(r: number | null): FactorInsight['strength'] {
  if (r === null) return null;
  const a = Math.abs(r);
  return a < 0.3 ? 'fraca' : a < 0.5 ? 'moderada' : 'forte';
}

export function recoveryInsights(events: readonly RecoveryEvent[]): RecoveryInsights {
  const withPainAfter = events.filter((e) => e.painAfter !== null);
  const changes = events
    .filter((e) => e.painBefore !== null && e.painAfter !== null)
    .map((e) => e.painAfter! - e.painBefore!);

  const factors = FACTORS.map(({ factor, label }): FactorInsight => {
    const pairs = withPainAfter.filter((e) => e[factor] !== null);
    const enough = pairs.length >= MIN_PAIRS_FOR_CORRELATION;
    const r = enough
      ? pearson(
          pairs.map((e) => e[factor]!),
          pairs.map((e) => e.painAfter!),
        )
      : null;
    return { factor, label, pairs: pairs.length, enough, r, strength: strengthOf(r) };
  });

  return {
    total: events.length,
    withPainAfter: withPainAfter.length,
    underAntiInflammatory: events.filter((e) => e.onAntiInflammatory === true).length,
    averageChange: changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : null,
    factors,
  };
}

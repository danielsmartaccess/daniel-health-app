/**
 * Plano do treino: transforma os itens do template numa sequência linear de blocos.
 * Cada série vira um bloco de trabalho seguido do seu descanso. Não há descanso no fim.
 */

export type ExerciseMode = 'time' | 'reps';

/** Item do template já com o exercício resolvido (vem de GET /api/templates/:id). */
export interface TemplateItemInput {
  exerciseId: string;
  name: string;
  mode: ExerciseMode;
  voiceInstruction: string | null;
  orderIndex: number;
  sets: number;
  durationSeconds: number | null;
  reps: number | null;
  restSeconds: number;
}

export interface WorkBlock {
  kind: 'work';
  exerciseId: string;
  name: string;
  spokenName: string;
  mode: ExerciseMode;
  setNumber: number;
  totalSets: number;
  /** Duração fixa (modo tempo). Em repetições é null: o bloco só termina no "concluí". */
  durationMs: number | null;
  reps: number | null;
  /** Estimativa usada só na barra de progresso geral. */
  estimatedMs: number;
}

export interface RestBlock {
  kind: 'rest';
  durationMs: number;
  estimatedMs: number;
}

export type Block = WorkBlock | RestBlock;

/** Estimativa para repetições sem duração cadastrada (barra geral apenas). */
const FALLBACK_REPS_ESTIMATE_MS = 30_000;

export function buildPlan(items: readonly TemplateItemInput[]): Block[] {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  const blocks: Block[] = [];

  for (const item of sorted) {
    assertValidItem(item);
    const durationMs = item.mode === 'time' ? item.durationSeconds! * 1000 : null;
    const estimatedMs =
      item.durationSeconds && item.durationSeconds > 0
        ? item.durationSeconds * 1000
        : FALLBACK_REPS_ESTIMATE_MS;

    for (let setNumber = 1; setNumber <= item.sets; setNumber++) {
      blocks.push({
        kind: 'work',
        exerciseId: item.exerciseId,
        name: item.name,
        spokenName: item.voiceInstruction?.trim() || item.name,
        mode: item.mode,
        setNumber,
        totalSets: item.sets,
        durationMs,
        reps: item.mode === 'reps' ? item.reps : null,
        estimatedMs,
      });
      if (item.restSeconds > 0) {
        const restMs = item.restSeconds * 1000;
        blocks.push({ kind: 'rest', durationMs: restMs, estimatedMs: restMs });
      }
    }
  }

  if (blocks.at(-1)?.kind === 'rest') blocks.pop();
  return blocks;
}

function assertValidItem(item: TemplateItemInput): void {
  if (!Number.isInteger(item.sets) || item.sets < 1) {
    throw new RangeError(`"${item.name}": número de séries inválido`);
  }
  if (item.mode === 'time' && !(item.durationSeconds && item.durationSeconds > 0)) {
    throw new RangeError(`"${item.name}": exercício por tempo precisa de duração`);
  }
  if (item.restSeconds < 0) {
    throw new RangeError(`"${item.name}": descanso negativo`);
  }
}

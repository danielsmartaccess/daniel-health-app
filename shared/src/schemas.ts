import { z } from 'zod';

/**
 * Formato genérico 8-4-4-4-12. O UUID fixo do dono (…0001) não tem bits de versão RFC,
 * e o validador uuid() estrito do zod 4 o rejeitaria.
 */
export const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idSchema = z.string().regex(UUID_SHAPE, 'id inválido');

const painSchema = z.number().int().min(0).max(10);
const secondsSchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 * 60);

/** POST /api/sessions */
export const createSessionBodySchema = z.strictObject({
  templateId: idSchema,
  painBefore: painSchema,
  onAntiInflammatory: z.boolean(),
});
export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

/** POST /api/sessions/:id/items — uma série (bloco de trabalho + descanso que o segue). */
export const sessionItemSchema = z
  .strictObject({
    exerciseId: idSchema,
    setNumber: z.number().int().min(1),
    plannedDurationSeconds: secondsSchema.nullable(),
    actualDurationSeconds: secondsSchema,
    plannedRestSeconds: secondsSchema.nullable(),
    actualRestSeconds: secondsSchema.nullable(),
    completed: z.boolean(),
    skipped: z.boolean(),
  })
  .refine((item) => !(item.completed && item.skipped), {
    message: 'Uma série não pode estar concluída e pulada ao mesmo tempo',
    path: ['skipped'],
  });
export type SessionItem = z.infer<typeof sessionItemSchema>;

/** PATCH /api/sessions/:id/finish */
export const finishSessionBodySchema = z.strictObject({
  painAfter: painSchema,
  squatDepthNotes: z.string().trim().max(500).nullable().optional(),
  freeNotes: z.string().trim().max(2000).nullable().optional(),
});
export type FinishSessionBody = z.infer<typeof finishSessionBodySchema>;

// ─── Música (Spotify) tocada num treino ─────────────────────────────────────────

/** URI do Spotify: spotify:<tipo>:<id>. */
export const SPOTIFY_URI = /^spotify:(track|playlist|album|artist|episode|show):[A-Za-z0-9]{1,64}$/;

/** POST /api/sessions/:id/music */
export const sessionMusicBodySchema = z.strictObject({
  spotifyUri: z.string().regex(SPOTIFY_URI, 'URI do Spotify inválida'),
  name: z.string().trim().max(300).nullable(),
});
export type SessionMusicBody = z.infer<typeof sessionMusicBodySchema>;

// ─── Natação (registro manual, não guiada) ──────────────────────────────────────

export const SWIM_STROKES = [
  'freestyle',
  'backstroke',
  'breaststroke',
  'butterfly',
  'mixed',
] as const;
/** 'none' = só braço (pull buoy). É o campo que separa natação segura de natação de risco. */
export const SWIM_KICKS = ['none', 'flutter', 'dolphin', 'breaststroke', 'fins'] as const;

/** POST /api/swims — campos do resumo do Apple Watch + variáveis do joelho. */
export const swimLogBodySchema = z
  .strictObject({
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    durationSeconds: z
      .number()
      .int()
      .min(1)
      .max(6 * 60 * 60),
    distanceM: z.number().int().min(1).max(20_000),
    poolLengthM: z.number().positive().max(100).nullable().optional(),
    laps: z.number().int().min(0).nullable().optional(),
    activeKcal: z.number().int().min(0).nullable().optional(),
    totalKcal: z.number().int().min(0).nullable().optional(),
    avgHr: z.number().int().min(30).max(230).nullable().optional(),
    effort: z.number().int().min(1).max(10).nullable().optional(),
    stroke: z.enum(SWIM_STROKES).nullable().optional(),
    kick: z.enum(SWIM_KICKS),
    painBefore: painSchema.nullable().optional(),
    painAfter: painSchema.nullable().optional(),
    onAntiInflammatory: z.boolean().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((s) => !s.endedAt || Date.parse(s.endedAt) > Date.parse(s.startedAt), {
    message: 'O fim precisa ser depois do início',
    path: ['endedAt'],
  });
export type SwimLogBody = z.infer<typeof swimLogBodySchema>;

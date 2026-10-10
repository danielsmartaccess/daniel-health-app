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

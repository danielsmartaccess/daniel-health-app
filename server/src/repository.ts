import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FinishSessionBody,
  RecoveryEvent,
  SessionItem,
  SessionMusicBody,
  SwimLogBody,
  SwimLogDto,
  TemplateDto,
  TemplateItemInput,
} from '@knee/shared';
import type { Database } from './database.types';
import { badRequest, conflict, notFound } from './errors';

export type Db = SupabaseClient<Database>;

/**
 * Porta de acesso a dados. As rotas dependem desta interface, não do Supabase
 * (testes de rota usam uma implementação em memória).
 */
export interface KneeRepository {
  getTemplate(id: string): Promise<TemplateDto | null>;
  /** Única escrita na camada antiga: cria o dia se não existir; nunca altera um dia existente. */
  getOrCreateDailyLog(ownerId: string, date: string): Promise<string>;
  createSession(input: {
    dailyLogId: string;
    templateId: string;
    painBefore: number;
    onAntiInflammatory: boolean;
    startedAt: string;
  }): Promise<{ id: string; startedAt: string }>;
  addSessionItem(sessionId: string, item: SessionItem): Promise<{ id: string }>;
  finishSession(
    sessionId: string,
    body: FinishSessionBody,
    endedAt: string,
  ): Promise<{ id: string; startedAt: string; endedAt: string }>;
  createSwim(dailyLogId: string, date: string, body: SwimLogBody): Promise<SwimLogDto>;
  listSwims(limit: number): Promise<SwimLogDto[]>;
  /** 5.2 — registra a música tocada numa sessão (knee_spotify_sessions). */
  addSessionMusic(
    sessionId: string,
    music: SessionMusicBody,
    startedAt: string,
  ): Promise<{ id: string }>;
  /** Treinos de core (visão knee_recovery_daily) + natações, com sono/peso/álcool do dia. */
  listRecovery(): Promise<RecoveryEvent[]>;
}

const FK_VIOLATION = '23503';

export class SupabaseKneeRepository implements KneeRepository {
  constructor(private readonly db: Db) {}

  async getTemplate(id: string): Promise<TemplateDto | null> {
    const { data, error } = await this.db
      .from('knee_workout_templates')
      .select(
        `id, name, description,
         knee_workout_template_items (
           order_index, sets, duration_seconds, reps, rest_seconds,
           knee_exercises ( id, name, type, voice_instruction )
         )`,
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const items: TemplateItemInput[] = data.knee_workout_template_items.map((row) => {
      const exercise = row.knee_exercises;
      if (exercise.type !== 'time' && exercise.type !== 'reps') {
        throw new Error(`Tipo de exercício desconhecido: ${exercise.type}`);
      }
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        mode: exercise.type,
        voiceInstruction: exercise.voice_instruction,
        orderIndex: row.order_index,
        sets: row.sets,
        durationSeconds: row.duration_seconds,
        reps: row.reps,
        restSeconds: row.rest_seconds,
      };
    });
    items.sort((a, b) => a.orderIndex - b.orderIndex);

    return { id: data.id, name: data.name, description: data.description, items };
  }

  async getOrCreateDailyLog(ownerId: string, date: string): Promise<string> {
    // INSERT ... ON CONFLICT (user_id, date) DO NOTHING: não toca em updated_at de dia existente.
    const { error: upsertError } = await this.db
      .from('daily_logs')
      .upsert({ user_id: ownerId, date }, { onConflict: 'user_id,date', ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    const { data, error } = await this.db
      .from('daily_logs')
      .select('id')
      .eq('user_id', ownerId)
      .eq('date', date)
      .single();
    if (error) throw error;
    return data.id;
  }

  async createSession(input: {
    dailyLogId: string;
    templateId: string;
    painBefore: number;
    onAntiInflammatory: boolean;
    startedAt: string;
  }): Promise<{ id: string; startedAt: string }> {
    const { data, error } = await this.db
      .from('knee_workout_sessions')
      .insert({
        daily_log_id: input.dailyLogId,
        template_id: input.templateId,
        pain_before: input.painBefore,
        on_anti_inflammatory: input.onAntiInflammatory,
        started_at: input.startedAt,
      })
      .select('id, started_at')
      .single();
    if (error) throw error;
    return { id: data.id, startedAt: data.started_at };
  }

  async addSessionItem(sessionId: string, item: SessionItem): Promise<{ id: string }> {
    await this.assertSessionOpen(sessionId);

    const { data, error } = await this.db
      .from('knee_workout_session_items')
      .insert({
        session_id: sessionId,
        exercise_id: item.exerciseId,
        set_number: item.setNumber,
        planned_duration_seconds: item.plannedDurationSeconds,
        actual_duration_seconds: item.actualDurationSeconds,
        planned_rest_seconds: item.plannedRestSeconds,
        actual_rest_seconds: item.actualRestSeconds,
        completed: item.completed,
        skipped: item.skipped,
      })
      .select('id')
      .single();
    if (error?.code === FK_VIOLATION) throw badRequest('Exercício inexistente');
    if (error) throw error;
    return { id: data.id };
  }

  async finishSession(
    sessionId: string,
    body: FinishSessionBody,
    endedAt: string,
  ): Promise<{ id: string; startedAt: string; endedAt: string }> {
    const { data, error } = await this.db
      .from('knee_workout_sessions')
      .update({
        ended_at: endedAt,
        pain_after: body.painAfter,
        squat_depth_notes: body.squatDepthNotes ?? null,
        free_notes: body.freeNotes ?? null,
      })
      .eq('id', sessionId)
      .is('ended_at', null) // finalizar duas vezes não sobrescreve a primeira
      .select('id, started_at, ended_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      await this.assertSessionOpen(sessionId); // lança 404 ou 409
      throw conflict('Sessão já finalizada');
    }
    return { id: data.id, startedAt: data.started_at, endedAt: data.ended_at ?? endedAt };
  }

  async createSwim(dailyLogId: string, date: string, body: SwimLogBody): Promise<SwimLogDto> {
    const { data, error } = await this.db
      .from('knee_swim_logs')
      .insert({
        daily_log_id: dailyLogId,
        started_at: body.startedAt,
        ended_at: body.endedAt ?? null,
        duration_seconds: body.durationSeconds,
        distance_m: body.distanceM,
        pool_length_m: body.poolLengthM ?? null,
        laps: body.laps ?? null,
        active_kcal: body.activeKcal ?? null,
        total_kcal: body.totalKcal ?? null,
        avg_hr: body.avgHr ?? null,
        effort: body.effort ?? null,
        stroke: body.stroke ?? null,
        kick: body.kick,
        pain_before: body.painBefore ?? null,
        pain_after: body.painAfter ?? null,
        on_anti_inflammatory: body.onAntiInflammatory ?? null,
        notes: body.notes ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toSwimDto(data, date);
  }

  async listSwims(limit: number): Promise<SwimLogDto[]> {
    const { data, error } = await this.db
      .from('knee_swim_logs')
      .select('*, daily_logs ( date )')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map((row) => toSwimDto(row, row.daily_logs.date));
  }

  async addSessionMusic(
    sessionId: string,
    music: SessionMusicBody,
    startedAt: string,
  ): Promise<{ id: string }> {
    const { data, error } = await this.db
      .from('knee_spotify_sessions')
      .insert({
        session_id: sessionId,
        spotify_uri: music.spotifyUri,
        playlist_or_track_name: music.name,
        started_at: startedAt,
      })
      .select('id')
      .single();
    if (error?.code === FK_VIOLATION) throw notFound('Sessão');
    if (error) throw error;
    return { id: data.id };
  }

  async listRecovery(): Promise<RecoveryEvent[]> {
    const [sessions, swims] = await Promise.all([
      this.db.from('knee_recovery_daily').select('*'),
      this.db.from('knee_swim_logs').select(
        `id, started_at, pain_before, pain_after, on_anti_inflammatory, distance_m, kick,
           daily_logs (
             date,
             biometrics ( weight_kg, sleep_hours, sleep_score ),
             alcohol_log ( amount_doses )
           )`,
      ),
    ]);
    if (sessions.error) throw sessions.error;
    if (swims.error) throw swims.error;

    const core: RecoveryEvent[] = sessions.data
      .filter((row) => row.session_id && row.date && row.started_at)
      .map((row) => ({
        id: row.session_id!,
        kind: 'core',
        date: row.date!,
        startedAt: row.started_at!,
        painBefore: row.pain_before,
        painAfter: row.pain_after,
        onAntiInflammatory: row.on_anti_inflammatory,
        sleepHours: toNumber(row.sleep_hours),
        sleepScore: row.sleep_score,
        weightKg: toNumber(row.weight_kg),
        alcoholDoses: toNumber(row.alcohol_doses),
        distanceM: null,
        kick: null,
      }));

    const swim: RecoveryEvent[] = swims.data.map((row) => {
      const day = row.daily_logs;
      const bio = day.biometrics;
      return {
        id: row.id,
        kind: 'swim',
        date: day.date,
        startedAt: row.started_at,
        painBefore: row.pain_before,
        painAfter: row.pain_after,
        onAntiInflammatory: row.on_anti_inflammatory,
        sleepHours: toNumber(bio?.sleep_hours ?? null),
        sleepScore: bio?.sleep_score ?? null,
        weightKg: toNumber(bio?.weight_kg ?? null),
        alcoholDoses: toNumber(day.alcohol_log?.amount_doses ?? null),
        distanceM: row.distance_m,
        kick: row.kick,
      };
    });

    return [...core, ...swim].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  private async assertSessionOpen(sessionId: string): Promise<void> {
    const { data, error } = await this.db
      .from('knee_workout_sessions')
      .select('id, ended_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound('Sessão');
    if (data.ended_at) throw conflict('Sessão já finalizada');
  }
}

type SwimRow = Database['public']['Tables']['knee_swim_logs']['Row'];

/** Colunas numeric do Postgres podem chegar como string; normaliza para number. */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toSwimDto(row: SwimRow, date: string): SwimLogDto {
  return {
    id: row.id,
    date,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    distanceM: row.distance_m,
    poolLengthM: row.pool_length_m === null ? null : Number(row.pool_length_m),
    laps: row.laps,
    activeKcal: row.active_kcal,
    totalKcal: row.total_kcal,
    avgHr: row.avg_hr,
    effort: row.effort,
    stroke: row.stroke as SwimLogDto['stroke'],
    kick: row.kick as SwimLogDto['kick'],
    painBefore: row.pain_before,
    painAfter: row.pain_after,
    onAntiInflammatory: row.on_anti_inflammatory,
    notes: row.notes,
  };
}

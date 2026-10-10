-- BASELINE: já aplicada no Supabase em 2026-06-16. Não reaplicar.

-- RPC chamada pelo Atalho do iOS: 1 POST grava o dia inteiro.
-- SECURITY INVOKER (padrão) + RLS aberto => anon pode gravar. search_path fixo.
create or replace function public.upsert_apple_day(
  p_date             date,
  p_active_energy    integer default null,
  p_exercise_min     integer default null,
  p_stand_hours      integer default null,
  p_cardio_recovery  integer default null,
  p_resting_hr       integer default null,
  p_respiratory      numeric default null,
  p_body_temp        numeric default null,
  p_weight           numeric default null,
  p_sleep_hours      numeric default null,
  p_sleep_score      integer default null,
  p_workout_type     text    default null,
  p_workout_min      integer default null,
  p_workout_cal      integer default null,
  p_workout_dist     integer default null,
  p_hr_max           integer default null,
  p_hr_min           integer default null
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_log   uuid;
  v_owner uuid := '00000000-0000-0000-0000-000000000001';
  v_type  text := case when p_workout_type in ('swim','walk','bike','gym','other','rest')
                       then p_workout_type else 'other' end;
begin
  insert into public.daily_logs (user_id, date) values (v_owner, p_date)
  on conflict (user_id, date) do update set updated_at = now()
  returning id into v_log;

  -- biometria + métricas Apple (merge: só sobrescreve o que vier não-nulo)
  insert into public.biometrics
    (log_id, weight_kg, resting_hr, sleep_hours, sleep_score,
     active_energy_cal, exercise_min, stand_hours, cardio_recovery, respiratory_rate, body_temp_c)
  values
    (v_log, p_weight, p_resting_hr, p_sleep_hours, p_sleep_score,
     p_active_energy, p_exercise_min, p_stand_hours, p_cardio_recovery, p_respiratory, p_body_temp)
  on conflict (log_id) do update set
     weight_kg         = coalesce(excluded.weight_kg,         public.biometrics.weight_kg),
     resting_hr        = coalesce(excluded.resting_hr,        public.biometrics.resting_hr),
     sleep_hours       = coalesce(excluded.sleep_hours,       public.biometrics.sleep_hours),
     sleep_score       = coalesce(excluded.sleep_score,       public.biometrics.sleep_score),
     active_energy_cal = coalesce(excluded.active_energy_cal, public.biometrics.active_energy_cal),
     exercise_min      = coalesce(excluded.exercise_min,      public.biometrics.exercise_min),
     stand_hours       = coalesce(excluded.stand_hours,       public.biometrics.stand_hours),
     cardio_recovery   = coalesce(excluded.cardio_recovery,   public.biometrics.cardio_recovery),
     respiratory_rate  = coalesce(excluded.respiratory_rate,  public.biometrics.respiratory_rate),
     body_temp_c       = coalesce(excluded.body_temp_c,       public.biometrics.body_temp_c);

  -- treino (só se veio algum dado de workout)
  if p_workout_min is not null or p_workout_dist is not null or p_workout_cal is not null then
    insert into public.exercises
      (log_id, type, done, duration_min, calories, hr_max, hr_min, distance_m)
    values
      (v_log, v_type, true, coalesce(p_workout_min,0), coalesce(p_workout_cal,0), p_hr_max, p_hr_min, p_workout_dist)
    on conflict (log_id) do update set
       type         = excluded.type,
       done         = true,
       duration_min = coalesce(excluded.duration_min, public.exercises.duration_min),
       calories     = coalesce(excluded.calories,     public.exercises.calories),
       hr_max       = coalesce(excluded.hr_max,       public.exercises.hr_max),
       hr_min       = coalesce(excluded.hr_min,       public.exercises.hr_min),
       distance_m   = coalesce(excluded.distance_m,   public.exercises.distance_m);
  end if;
end $$;

grant execute on function public.upsert_apple_day to anon, authenticated;

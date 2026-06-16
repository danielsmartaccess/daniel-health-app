-- ============================================================
-- Daniel Health App — Supabase Schema v2.1 (cloud-only, SEM login)
-- ============================================================
-- App de 1 usuário: dono único fixo + acesso aberto via anon key.
-- Estado atual já aplicado no projeto qktebgvnejjhpfdriert.

create extension if not exists "uuid-ossp";

-- Dono único (substitui o vínculo com auth.users)
create table profiles (
  id uuid default uuid_generate_v4() primary key,
  email text unique not null,
  name text not null default 'Daniel',
  created_at timestamptz default now()
);
insert into profiles (id, email, name)
  values ('00000000-0000-0000-0000-000000000001','daniel@local','Daniel')
  on conflict (id) do nothing;

-- ─── DAILY LOGS ──────────────────────────────────────────────
create table daily_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- ─── EXERCISES ───────────────────────────────────────────────
create table exercises (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null unique,
  type text check (type in ('swim','walk','bike','gym','other','rest')),
  done boolean default false,
  duration_min integer default 0,
  calories integer default 0,
  hr_max integer,
  hr_min integer,
  distance_m integer,                 -- v2.1: distância do treino (Apple Watch)
  notes text,
  created_at timestamptz default now()
);

-- ─── MEALS ───────────────────────────────────────────────────
create table meals (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null unique,
  breakfast boolean default false,
  lunch boolean default false,
  dinner boolean default false,
  created_at timestamptz default now()
);

-- ─── BIOMETRICS (inclui métricas Apple Watch v2.1) ───────────
create table biometrics (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null unique,
  weight_kg numeric(5,2),
  resting_hr integer,
  water_glasses integer default 0,
  sleep_hours numeric(4,1),
  sleep_quality text check (sleep_quality in ('great','good','ok','bad')),
  sleep_score integer,                -- v2.1: score de sono Apple (0-100)
  active_energy_cal integer,          -- v2.1: anel Movimento (cal)
  exercise_min integer,               -- v2.1: anel Exercício (min)
  stand_hours integer,                -- v2.1: anel Em Pé (h)
  cardio_recovery integer,            -- v2.1: recuperação cardíaca 1 min (bpm)
  respiratory_rate numeric(4,1),      -- v2.1: respirações/min
  body_temp_c numeric(4,1),           -- v2.1: temperatura corporal (°C)
  created_at timestamptz default now()
);

-- ─── MEDICATIONS ─────────────────────────────────────────────
create table medications (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null unique,
  olmecor_taken boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- ─── ALCOHOL LOG ─────────────────────────────────────────────
create table alcohol_log (
  id uuid default uuid_generate_v4() primary key,
  log_id uuid references daily_logs(id) on delete cascade not null unique,
  type text check (type in ('wine','beer','other','none')),
  amount_doses numeric(4,1) default 0,
  created_at timestamptz default now()
);

-- ─── LAB RESULTS ─────────────────────────────────────────────
create table lab_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  hdl numeric(5,1),
  triglycerides numeric(6,1),
  glucose numeric(6,1),
  vo2_max numeric(5,2),
  weight_kg numeric(5,2),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- ─── RLS: acesso aberto (app sem login) ──────────────────────
-- ⚠️ Trade-off conhecido: sem auth.uid(), as políticas são permissivas.
-- O Supabase Advisor mostra avisos rls_policy_always_true — esperados aqui.
do $$ declare t text;
begin
  foreach t in array array['profiles','daily_logs','exercises','meals','biometrics','medications','alcohol_log','lab_results']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "open_access" on %I', t);
    execute format('create policy "open_access" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ─── TRIGGER: updated_at ─────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger set_updated_at
  before update on daily_logs
  for each row execute procedure update_updated_at();

-- ─── RPC: upsert_apple_day (chamada pelo Atalho do iOS) ──────
-- 1 POST grava o dia inteiro. Merge: só sobrescreve o que vier não-nulo.
create or replace function public.upsert_apple_day(
  p_date date,
  p_active_energy integer default null, p_exercise_min integer default null,
  p_stand_hours integer default null,   p_cardio_recovery integer default null,
  p_resting_hr integer default null,    p_respiratory numeric default null,
  p_body_temp numeric default null,     p_weight numeric default null,
  p_sleep_hours numeric default null,   p_sleep_score integer default null,
  p_workout_type text default null,     p_workout_min integer default null,
  p_workout_cal integer default null,   p_workout_dist integer default null,
  p_hr_max integer default null,        p_hr_min integer default null
) returns void language plpgsql set search_path = '' as $$
declare
  v_log uuid;
  v_owner uuid := '00000000-0000-0000-0000-000000000001';
  v_type text := case when p_workout_type in ('swim','walk','bike','gym','other','rest')
                      then p_workout_type else 'other' end;
begin
  insert into public.daily_logs (user_id, date) values (v_owner, p_date)
  on conflict (user_id, date) do update set updated_at = now() returning id into v_log;

  insert into public.biometrics
    (log_id, weight_kg, resting_hr, sleep_hours, sleep_score, active_energy_cal,
     exercise_min, stand_hours, cardio_recovery, respiratory_rate, body_temp_c)
  values
    (v_log, p_weight, p_resting_hr, p_sleep_hours, p_sleep_score, p_active_energy,
     p_exercise_min, p_stand_hours, p_cardio_recovery, p_respiratory, p_body_temp)
  on conflict (log_id) do update set
     weight_kg=coalesce(excluded.weight_kg, public.biometrics.weight_kg),
     resting_hr=coalesce(excluded.resting_hr, public.biometrics.resting_hr),
     sleep_hours=coalesce(excluded.sleep_hours, public.biometrics.sleep_hours),
     sleep_score=coalesce(excluded.sleep_score, public.biometrics.sleep_score),
     active_energy_cal=coalesce(excluded.active_energy_cal, public.biometrics.active_energy_cal),
     exercise_min=coalesce(excluded.exercise_min, public.biometrics.exercise_min),
     stand_hours=coalesce(excluded.stand_hours, public.biometrics.stand_hours),
     cardio_recovery=coalesce(excluded.cardio_recovery, public.biometrics.cardio_recovery),
     respiratory_rate=coalesce(excluded.respiratory_rate, public.biometrics.respiratory_rate),
     body_temp_c=coalesce(excluded.body_temp_c, public.biometrics.body_temp_c);

  if p_workout_min is not null or p_workout_dist is not null or p_workout_cal is not null then
    insert into public.exercises
      (log_id, type, done, duration_min, calories, hr_max, hr_min, distance_m)
    values
      (v_log, v_type, true, coalesce(p_workout_min,0), coalesce(p_workout_cal,0), p_hr_max, p_hr_min, p_workout_dist)
    on conflict (log_id) do update set
       type=excluded.type, done=true,
       duration_min=coalesce(excluded.duration_min, public.exercises.duration_min),
       calories=coalesce(excluded.calories, public.exercises.calories),
       hr_max=coalesce(excluded.hr_max, public.exercises.hr_max),
       hr_min=coalesce(excluded.hr_min, public.exercises.hr_min),
       distance_m=coalesce(excluded.distance_m, public.exercises.distance_m);
  end if;
end $$;

grant execute on function public.upsert_apple_day to anon, authenticated;

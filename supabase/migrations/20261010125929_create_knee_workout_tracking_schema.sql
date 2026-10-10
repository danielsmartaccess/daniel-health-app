-- BASELINE: já aplicada no Supabase em 2026-10-10. Não reaplicar.
-- Dados iniciais (exercícios e template): ver ../seed/knee_seed.sql

-- Catálogo de exercícios do app de treino (prefixo knee_ para não colidir com tabela existente)
create table knee_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  type text not null check (type in ('time', 'reps')),
  voice_instruction text,
  created_at timestamptz not null default now()
);

create table knee_workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table knee_workout_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references knee_workout_templates(id) on delete cascade,
  exercise_id uuid not null references knee_exercises(id) on delete restrict,
  order_index integer not null,
  sets integer not null default 1,
  duration_seconds integer,
  reps integer,
  rest_seconds integer not null default 30,
  created_at timestamptz not null default now()
);

create table knee_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references knee_workout_templates(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  pain_before integer check (pain_before between 0 and 10),
  pain_after integer check (pain_after between 0 and 10),
  squat_depth_notes text,
  free_notes text,
  created_at timestamptz not null default now()
);

create index idx_knee_workout_sessions_started_at on knee_workout_sessions(started_at);

create table knee_workout_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references knee_workout_sessions(id) on delete cascade,
  exercise_id uuid not null references knee_exercises(id) on delete restrict,
  set_number integer not null,
  planned_duration_seconds integer,
  actual_duration_seconds integer,
  planned_rest_seconds integer,
  actual_rest_seconds integer,
  completed boolean not null default true,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_knee_workout_session_items_session_id on knee_workout_session_items(session_id);

create table knee_spotify_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references knee_workout_sessions(id) on delete cascade,
  playlist_or_track_name text,
  spotify_uri text,
  started_at timestamptz not null default now()
);

create index idx_knee_spotify_sessions_session_id on knee_spotify_sessions(session_id);

alter table knee_exercises enable row level security;
alter table knee_workout_templates enable row level security;
alter table knee_workout_template_items enable row level security;
alter table knee_workout_sessions enable row level security;
alter table knee_workout_session_items enable row level security;
alter table knee_spotify_sessions enable row level security;

-- migration: knee_swim_logs  (PROPOSTA — NÃO APLICADA. Card 0.5, aguarda OK do Dani)
-- ADITIVA: só cria tabela nova na camada knee_*. Nenhuma tabela antiga é alterada.
--
-- Registro manual de natação (não guiada), com os campos do resumo do Apple Watch
-- e as variáveis que importam para o joelho: tipo de pernada, dor e anti-inflamatório.
-- Ritmo médio não é guardado: é derivado (duração / distância × 100).

create table public.knee_swim_logs (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null references public.daily_logs(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null check (duration_seconds > 0),
  distance_m integer not null check (distance_m > 0),
  pool_length_m numeric(4,1) check (pool_length_m > 0),
  laps integer check (laps >= 0),
  active_kcal integer check (active_kcal >= 0),
  total_kcal integer check (total_kcal >= 0),
  avg_hr integer check (avg_hr between 30 and 230),
  effort smallint check (effort between 1 and 10),
  stroke text check (stroke in ('freestyle', 'backstroke', 'breaststroke', 'butterfly', 'mixed')),
  -- 'none' = só braço (pull buoy). É a variável que separa natação segura de natação de risco.
  kick text not null check (kick in ('none', 'flutter', 'dolphin', 'breaststroke', 'fins')),
  pain_before integer check (pain_before between 0 and 10),
  pain_after integer check (pain_after between 0 and 10),
  on_anti_inflammatory boolean,
  notes text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);

create index knee_swim_logs_daily_log_id_idx on public.knee_swim_logs (daily_log_id);

alter table public.knee_swim_logs enable row level security;
revoke all on public.knee_swim_logs from anon, authenticated;

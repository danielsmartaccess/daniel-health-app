-- migration: knee_link_to_daily_logs  (ADITIVA — não altera nenhuma tabela antiga)
-- Status: PENDENTE. Só aplicar após OK explícito do Dani (Card 0.2).
-- Rollback: 20261010140000_knee_link_to_daily_logs.rollback.sql

alter table public.knee_workout_sessions
  add column if not exists daily_log_id uuid references public.daily_logs(id) on delete restrict,
  add column if not exists on_anti_inflammatory boolean;

create index if not exists knee_workout_sessions_daily_log_id_idx
  on public.knee_workout_sessions (daily_log_id);

-- Visão do painel de recuperação (1 linha por sessão)
create or replace view public.knee_recovery_daily
with (security_invoker = true) as
select
  dl.date,
  s.id as session_id,
  s.started_at,
  s.pain_before,
  s.pain_after,
  s.on_anti_inflammatory,
  b.weight_kg,
  b.sleep_hours,
  b.sleep_score,
  b.active_energy_cal,
  a.amount_doses as alcohol_doses
from public.knee_workout_sessions s
join public.daily_logs dl on dl.id = s.daily_log_id
left join public.biometrics b on b.log_id = dl.id
left join public.alcohol_log a on a.log_id = dl.id;

-- Defesa em profundidade: só a chave de serviço (Express) enxerga a camada nova
revoke all on public.knee_recovery_daily from anon, authenticated;
revoke all on public.knee_exercises, public.knee_workout_templates,
  public.knee_workout_template_items, public.knee_workout_sessions,
  public.knee_workout_session_items, public.knee_spotify_sessions
  from anon, authenticated;

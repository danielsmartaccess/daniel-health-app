-- rollback de 20261010140000_knee_link_to_daily_logs
-- Observação: os REVOKEs não são desfeitos de propósito. As tabelas knee_* já são
-- deny-all por RLS sem policies; devolver GRANTs ao anon não traria benefício.
drop view if exists public.knee_recovery_daily;
alter table public.knee_workout_sessions
  drop column if exists daily_log_id,
  drop column if exists on_anti_inflammatory;

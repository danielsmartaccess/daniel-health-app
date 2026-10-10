-- BASELINE: já aplicada no Supabase em 2026-06-16. Não reaplicar.

-- Novas métricas vindas do Apple Saúde / Watch
alter table biometrics
  add column if not exists active_energy_cal integer,   -- energia ativa do dia (anel Movimento)
  add column if not exists exercise_min      integer,   -- minutos de exercício (anel Exercício)
  add column if not exists stand_hours       integer,   -- horas em pé (anel Em Pé)
  add column if not exists cardio_recovery   integer,   -- recuperação cardíaca 1 min (bpm)
  add column if not exists respiratory_rate  numeric(4,1), -- respirações/min
  add column if not exists body_temp_c       numeric(4,1), -- temperatura corporal (°C)
  add column if not exists sleep_score       integer;   -- score de sono Apple (0-100)

alter table exercises
  add column if not exists distance_m integer;           -- distância do treino (metros)

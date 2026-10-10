-- BASELINE: já aplicada no Supabase em 2026-06-16. Não reaplicar.

-- Filhos one-to-one por dia: garante 1 linha por daily_log → permite upsert por log_id
alter table exercises   add constraint exercises_log_id_key   unique (log_id);
alter table meals        add constraint meals_log_id_key        unique (log_id);
alter table biometrics   add constraint biometrics_log_id_key   unique (log_id);
alter table medications  add constraint medications_log_id_key  unique (log_id);
alter table alcohol_log  add constraint alcohol_log_log_id_key  unique (log_id);

-- Exames: 1 painel por data por usuário → permite upsert por (user_id, date)
alter table lab_results  add constraint lab_results_user_date_key unique (user_id, date);

-- Dados iniciais da camada knee_* (inseridos em 2026-10-10, fora de migration).
-- IDs fixos iguais aos do banco de produção. Idempotente: pode rodar de novo sem duplicar.

insert into public.knee_exercises (id, name, category, type, voice_instruction) values
  ('cdc590f7-f2c5-46ba-94d8-8f803fe5e8f1', 'Abdominal tradicional', 'core', 'reps', 'Abdominal tradicional'),
  ('f554ba9d-fbf1-4b49-8177-5219caf36455', 'Prancha',               'core', 'time', 'Prancha'),
  ('61736bd9-a3d0-4531-888c-624b111a7b30', 'Superman',              'core', 'reps', 'Superman'),
  ('a22cb2a4-789b-4027-8190-2df7087b7f17', 'Canoinha',              'core', 'reps', 'Canoinha')
on conflict (id) do nothing;

insert into public.knee_workout_templates (id, name, description) values
  ('6ac8cc81-f371-4a0d-9f2d-f944b7f23148', 'Core — Recuperação de joelho',
   'Circuito de core sem impacto no joelho, para o período de recuperação da lesão no ligamento colateral medial / pata de ganso')
on conflict (id) do nothing;

insert into public.knee_workout_template_items
  (id, template_id, exercise_id, order_index, sets, duration_seconds, reps, rest_seconds) values
  ('58dbc5f0-212c-4488-9dd7-2f3418d01f8f', '6ac8cc81-f371-4a0d-9f2d-f944b7f23148', 'cdc590f7-f2c5-46ba-94d8-8f803fe5e8f1', 1, 3, 30, 15, 30),
  ('cde40f1b-ad99-4987-92a5-2e3811aa0751', '6ac8cc81-f371-4a0d-9f2d-f944b7f23148', 'f554ba9d-fbf1-4b49-8177-5219caf36455', 2, 3, 40, null, 30),
  ('4ebfe32c-c0f3-4299-ae0d-d3f937a6015c', '6ac8cc81-f371-4a0d-9f2d-f944b7f23148', '61736bd9-a3d0-4531-888c-624b111a7b30', 3, 3, 30, 12, 30),
  ('92bce825-8627-4dd5-885d-55584c78dd8e', '6ac8cc81-f371-4a0d-9f2d-f944b7f23148', 'a22cb2a4-789b-4027-8190-2df7087b7f17', 4, 3, 30, 11, 45)
on conflict (id) do nothing;

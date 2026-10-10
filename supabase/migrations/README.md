# Migrations — projeto Supabase `daniel-health-app`

Toda mudança de schema entra aqui como migration versionada, com rollback ao lado
(`<versão>_<nome>.rollback.sql`).

## Já aplicadas no banco (ainda não versionadas neste repo — Card 0.4)

| Versão | Nome |
|---|---|
| 20260616024434 | initial_schema_health_app |
| 20260616025334 | add_unique_constraints_for_upsert |
| 20260616025810 | harden_functions_search_path_and_execute |
| 20260616030554 | remove_auth_single_owner_open_access |
| 20260616032924 | add_ios_health_metrics_columns |
| 20260616032950 | create_upsert_apple_day_rpc |
| 20261010125929 | create_knee_workout_tracking_schema |

O texto delas está em `supabase_migrations.schema_migrations` no banco.
`../schema.sql` é um retrato do schema de v2.0 e não reflete as mudanças posteriores.
Os dados iniciais de `knee_*` (4 exercícios, 1 template) foram inseridos fora de migration.

## Pendentes (aguardando aprovação)

- `20261010140000_knee_link_to_daily_logs.sql` — Card 0.2. Ao aplicar, o Supabase
  atribui a versão real; renomeie o arquivo para bater com ela.

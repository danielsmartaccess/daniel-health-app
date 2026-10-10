# Migrations — projeto Supabase `daniel-health-app`

Toda mudança de schema entra aqui como migration versionada, com rollback ao lado
(`<versão>_<nome>.rollback.sql`). A versão do arquivo é a que o Supabase atribuiu ao aplicar.

## Aplicadas no banco

| Versão | Nome | Observação |
| --- | --- | --- |
| 20260616024434 | initial_schema_health_app | baseline do health app |
| 20260616025334 | add_unique_constraints_for_upsert | baseline |
| 20260616025810 | harden_functions_search_path_and_execute | baseline |
| 20260616030554 | remove_auth_single_owner_open_access | abriu o acesso (Card 6.0) |
| 20260616032924 | add_ios_health_metrics_columns | baseline |
| 20260616032950 | create_upsert_apple_day_rpc | baseline |
| 20261010125929 | create_knee_workout_tracking_schema | camada knee_* |
| 20261010134138 | knee_link_to_daily_logs | Card 0.2, com rollback |

As sete primeiras foram copiadas de `supabase_migrations.schema_migrations` em 2026-10-10.
O conteúdo SQL confere por hash MD5 com o que está no banco; só o cabeçalho de comentário foi acrescentado.

## Propostas (não aplicadas)

Ficam em `_pending/` até a aprovação. Ao aplicar, o arquivo sai de `_pending/` e ganha a versão real.

- `_pending/knee_swim_logs.sql`: Card 0.5, registro manual de natação.

Os dados iniciais de `knee_*` estão em `../seed/knee_seed.sql` (idempotente, com os IDs de produção).
`../schema.sql` é um retrato da v2.0 e está desatualizado: use as migrations como fonte da verdade.

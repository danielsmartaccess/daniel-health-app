# Daniel Health App 🏃‍♂️

Personal health tracking app — built to monitor HDL, exercise, nutrition and key biomarkers.

## Status
`v2.0` — **cloud-only** com Supabase (PostgreSQL + Auth). Login obrigatório por magic link.

🔗 **App online:** <https://danielsmartaccess.github.io/daniel-health-app/saude-app.html>

## Objetivo de Saúde
- HDL: 29 → 40 mg/dL (meta 6 meses)
- VO₂ máx: 27.2 → 35+ mL/kg/min
- Triglicerídeos: 147 → <130 mg/dL
- Glicose: 103 → <100 mg/dL

## Funcionalidades (v1.0)
- [x] Dashboard com coach diário inteligente
- [x] Checklist de missões diárias
- [x] Registro de exercícios (natação, caminhada, bike)
- [x] Log de refeições, água, medicamentos, sono
- [x] Entrada de exames laboratoriais
- [x] Gráficos de progresso (HDL, VO₂, peso, triglicerídeos)
- [x] Streak de dias consecutivos
- [x] Persistência via localStorage

## v2.0 — Supabase (entregue)

- [x] Autenticação com magic link (email)
- [x] Banco de dados PostgreSQL no Supabase (8 tabelas + RLS)
- [x] Persistência cloud-only (cache em memória + saves otimistas)
- [x] Hospedagem via GitHub Pages

## Roadmap (v3.0)

- [ ] Sync em tempo real entre dispositivos (Supabase Realtime)
- [ ] PWA (Progressive Web App) — instalável no iPhone
- [ ] Notificações push (lembrete diário)

## Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Gráficos | Chart.js |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Supabase / Vercel |
| Futuro | React + TypeScript |

## Estrutura de Banco de Dados

```sql
-- Usuário
profiles (id, email, name, created_at)

-- Log diário
daily_logs (id, user_id, date, created_at, updated_at)

-- Exercício
exercises (id, log_id, type, duration_min, calories, hr_max, hr_min, notes)

-- Refeições
meals (id, log_id, breakfast, lunch, dinner)

-- Biometria diária
biometrics (id, log_id, weight_kg, resting_hr, water_glasses, sleep_hours, sleep_quality)

-- Medicamentos
medications (id, log_id, olmecor_taken, notes)

-- Álcool
alcohol_log (id, log_id, type, amount_doses)

-- Exames laboratoriais
lab_results (id, user_id, date, hdl, triglycerides, glucose, vo2_max, weight_kg, notes)
```

## Como usar

Acesse o app online: <https://danielsmartaccess.github.io/daniel-health-app/saude-app.html>

Faça login com seu e-mail (magic link) e seus dados ficam salvos na nuvem.

> **Nota:** o login por magic link exige HTTPS — use a URL do GitHub Pages, não abra o arquivo via `file://`.
> Antes do primeiro acesso, configure o **Site URL** e **Redirect URLs** no painel de Auth do Supabase (ver `CLAUDE.md`).

## Autor
Daniel Steinbruch — Just Go Smart Access

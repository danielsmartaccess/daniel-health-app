# Daniel Health App 🏃‍♂️

Personal health tracking app — built to monitor HDL, exercise, nutrition and key biomarkers.

## Status
`v1.0` — Frontend HTML/JS com localStorage  
`v2.0` — (em breve) Supabase backend + auth + sync em tempo real

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

## Roadmap (v2.0 — Supabase)
- [ ] Autenticação com magic link (email)
- [ ] Banco de dados PostgreSQL no Supabase
- [ ] Sync em tempo real entre dispositivos
- [ ] PWA (Progressive Web App) — instalável no iPhone
- [ ] Notificações push (lembrete diário)
- [ ] Dashboard de histórico completo

## Stack
| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Gráficos | Chart.js |
| Banco de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Supabase / Vercel |
| Futuro | React + TypeScript |

## Estrutura de Banco de Dados (planejada)

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

## Como rodar (v1.0)
Abra `saude-app.html` diretamente no navegador. Sem instalação necessária.

## Autor
Daniel Steinbruch — Just Go Smart Access

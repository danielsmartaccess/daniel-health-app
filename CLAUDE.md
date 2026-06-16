# CLAUDE.md — Daniel Health App

> **Perfil profissional, modo de operação, papéis, playbooks e regra de ouro** estão
> definidos no arquivo global `~/.claude/CLAUDE.md` (Daniel Steinbruch) e são herdados
> automaticamente. Este arquivo contém **apenas** o que é específico deste projeto.

---

## VISÃO GERAL

* **Nome:** Daniel Health App
* **Objetivo:** App pessoal de monitoramento de saúde — rastreia exercícios, alimentação, biometria e exames laboratoriais (HDL, VO₂ Max, triglicerídeos, glicose)
* **Status:** v2.0 — cloud-only com Supabase (login obrigatório por magic link). localStorage removido.
* **App online:** [danielsmartaccess.github.io/daniel-health-app/saude-app.html](https://danielsmartaccess.github.io/daniel-health-app/saude-app.html)

---

## STACK DESTE PROJETO

* Front-end: HTML5 + CSS3 + JavaScript vanilla + Chart.js v4 (CDN)
* Back-end: Supabase (PostgreSQL gerenciado + Auth + RLS)
* Banco de dados: PostgreSQL via Supabase — projeto `daniel-health-app` (region: `sa-east-1`)
* Infra / Cloud: Supabase (Brasil — sa-east-1)

---

## CREDENCIAIS SUPABASE

* **Project ID:** `qktebgvnejjhpfdriert`
* **URL:** `https://qktebgvnejjhpfdriert.supabase.co`
* **Dashboard:** [supabase.com/dashboard/project/qktebgvnejjhpfdriert](https://supabase.com/dashboard/project/qktebgvnejjhpfdriert)
* **Chave pública (anon):** ver `.env.example`

---

## REPOSITÓRIO GITHUB

* **URL:** [github.com/danielsmartaccess/daniel-health-app](https://github.com/danielsmartaccess/daniel-health-app)
* **Branch principal:** `master`

---

## COMANDOS

```bash
# Abrir o app localmente (é um único arquivo HTML)
start saude-app.html          # Windows
open saude-app.html           # Mac

# Subir alterações para o GitHub
git add -A
git commit -m "feat: descrição"
git push origin master
```

---

## ARQUITETURA

```text
Projeto Claude C/
├── saude-app.html        → App completo (single-file, vanilla JS + Chart.js)
├── supabase/
│   └── schema.sql        → Schema PostgreSQL com RLS (já aplicado no Supabase)
├── .env.example          → Template de variáveis de ambiente
├── README.md
└── CLAUDE.md
```

**Fluxo de dados (v1.0):**

* Usuário registra dados → localStorage (`sh_logs`, `sh_metrics`)
* Charts leem do localStorage e renderizam com Chart.js

**Fluxo de dados (v2.0 planejado):**

* Supabase Auth (magic link) → profiles (auto-criado via trigger)
* CRUD via Supabase JS client → PostgreSQL com RLS por usuário

**Tabelas do banco:**

* `profiles` — perfil do usuário (criado automaticamente no signup)
* `daily_logs` — log diário (1 por dia por usuário)
* `exercises` — detalhes do treino
* `meals` — refeições (café, almoço, jantar)
* `biometrics` — peso, FC repouso, água, sono
* `medications` — Olmecor
* `alcohol_log` — tipo e doses
* `lab_results` — HDL, triglicerídeos, glicose, VO₂ Max, peso

---

## CONVENÇÕES ESPECÍFICAS

* Single-file HTML por ora — não criar arquivos JS/CSS separados sem necessidade
* Variáveis de ambiente nunca vão no `saude-app.html` em produção — usar Supabase env vars
* Commits em português ou inglês, prefixo convencional: `feat:`, `fix:`, `chore:`
* Branch principal: `master`

---

## NOTAS E CONTEXTO

* App de uso pessoal (Daniel Steinbruch) — sem multitenancy complexo, RLS garante isolamento
* Olmecor é medicamento cardiovascular — campo `olmecor_taken` na tabela `medications`
* Metas de saúde atuais: HDL 29→40 mg/dL, VO₂ Max 27.2→35+, TG <130, Glicose <100

### Arquitetura v2.0 (cloud-only)

* Login obrigatório via **magic link** (Supabase Auth) — sem senha
* Dados carregados do Supabase para um **cache em memória** no login; getters do app permanecem síncronos
* Saves são **otimistas**: atualizam o cache na hora e persistem no Supabase em segundo plano
* Cada dia (`daily_logs`) faz upsert nas tabelas filhas via `onConflict` em `log_id`

### ⚠️ Passo manual obrigatório (uma vez) — config de Auth

Para o magic link funcionar, configurar em
[Auth → URL Configuration](https://supabase.com/dashboard/project/qktebgvnejjhpfdriert/auth/url-configuration):

* **Site URL:** `https://danielsmartaccess.github.io/daniel-health-app/saude-app.html`
* **Redirect URLs:** `https://danielsmartaccess.github.io/daniel-health-app/**`

### Próximos passos sugeridos

* PWA (manifest + service worker) para instalar no iPhone
* Realtime sync entre dispositivos (Supabase Realtime)
* Migrar a chave para `sb_publishable_...` (key moderna) no lugar da anon legada

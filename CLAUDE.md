# CLAUDE.md — Daniel Health App

> **Perfil profissional, modo de operação, papéis, playbooks e regra de ouro** estão
> definidos no arquivo global `~/.claude/CLAUDE.md` (Daniel Steinbruch) e são herdados
> automaticamente. Este arquivo contém **apenas** o que é específico deste projeto.

---

## VISÃO GERAL

* **Nome:** Daniel Health App
* **Objetivo:** App pessoal de monitoramento de saúde — rastreia exercícios, alimentação, biometria e exames laboratoriais (HDL, VO₂ Max, triglicerídeos, glicose)
* **Status:** v2.1 — cloud-only com Supabase, **sem login** (dono único fixo). localStorage removido.
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

* App de uso pessoal (Daniel Steinbruch) — 1 único usuário, sem multitenancy
* Olmecor é medicamento cardiovascular — campo `olmecor_taken` na tabela `medications`
* Metas de saúde atuais: HDL 29→40 mg/dL, VO₂ Max 27.2→35+, TG <130, Glicose <100

### Arquitetura v2.1 (cloud-only, sem login)

* **Sem autenticação** — abre e usa direto. Usa um **dono único fixo**:
  `OWNER_ID = 00000000-0000-0000-0000-000000000001` (linha em `profiles`)
* Dados carregados do Supabase para um **cache em memória** no boot; getters do app permanecem síncronos
* Saves são **otimistas**: atualizam o cache na hora e persistem no Supabase em segundo plano
* Cada dia (`daily_logs`) faz upsert nas tabelas filhas via `onConflict` em `log_id`
* RLS está **aberto** (`USING (true)`) para o papel `anon` — sem login não há `auth.uid()`

### ⚠️ Trade-off de segurança (decisão consciente)

Sem login, a chave `anon` fica no HTML público e as políticas RLS são permissivas
→ quem descobrir a URL do projeto pode ler/gravar os dados. Aceitável para app
pessoal de 1 usuário. O Supabase Advisor mostra 8 avisos `rls_policy_always_true` —
**esperados** nesta configuração.

---

## TREINO DO JOELHO (branch `feat/knee-workout`, em desenvolvimento)

Monorepo com npm workspaces, ao lado do health app legado (que continua intocado na raiz):

```text
shared/   → domínio puro (máquina de estados, localDate, schemas zod). Sem React, sem Date.now()
server/   → Express + TS. ÚNICA porta de entrada do banco (chave service_role em server/.env)
client/   → React + Vite + TS. Só fala com /api. Nunca recebe chave do Supabase
supabase/migrations/ → migrations versionadas + rollback
```

Comandos: `npm install`, `npm run dev` (server 127.0.0.1:3001 + client 127.0.0.1:5173), `npm run check`.

**Regras invioláveis no banco:**

* Nada de ALTER/DROP/UPDATE/DELETE/TRUNCATE nas 8 tabelas antigas, em `upsert_apple_day` ou nas policies sem aprovação explícita do Dani.
* Única escrita na camada antiga: get-or-create de `daily_logs` (OWNER_ID, data de hoje em America/Sao_Paulo).
* Leitura só de `biometrics` e `alcohol_log`. Não tocar em `medications` nem `lab_results`.
* Sessões guiadas vivem só em `knee_*`. Nunca escrever na `exercises` antiga.
* Toda mudança de schema = arquivo em `supabase/migrations` com rollback.

**Atenção:** o health app calcula "hoje" em UTC (`toISOString`), o Treino do Joelho em America/Sao_Paulo. Entre 21h e 23h59 locais os dois apontam para dias diferentes.

### Próximos passos sugeridos

* PWA (manifest + service worker) para instalar no iPhone
* Blindar sem perder a simplicidade: **anonymous sign-in** do Supabase (cria sessão
  automática sem o usuário fazer nada) → permite voltar ao RLS por `auth.uid()`
* Realtime sync entre dispositivos (Supabase Realtime)

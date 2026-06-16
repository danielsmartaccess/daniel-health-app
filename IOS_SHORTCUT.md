# 🍎 Atalho iOS → Daniel Health App (auto-sync)

Este guia cria um **Atalho do iPhone** que lê o app **Saúde** (Apple Health) e envia
os dados para o Supabase **automaticamente**, sem você digitar nada. Pode rodar via
**Automação** todo dia no fim da noite.

> Como funciona: o Atalho faz **1 chamada HTTP** para a função `upsert_apple_day` do
> Supabase. Essa função grava o dia inteiro (anéis, treino, sono, biometria) de uma vez.
> Se um campo vier vazio, ele **não apaga** o valor que já existe (merge inteligente).

---

## 1. A chamada HTTP (o coração do Atalho)

- **Método:** `POST`
- **URL:** `https://qktebgvnejjhpfdriert.supabase.co/rest/v1/rpc/upsert_apple_day`
- **Headers:**
  - `apikey`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdGViZ3ZuZWpqaHBmZHJpZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjgzOTEsImV4cCI6MjA5NzE0NDM5MX0.P5c5CtzBtWyv0-6f3QobndITAngnHan-Vrr6jlcVeqc`
  - `Authorization`: `Bearer <a mesma chave acima>`
  - `Content-Type`: `application/json`
- **Body (JSON):** veja os campos abaixo. **Só `p_date` é obrigatório.**

```json
{
  "p_date": "2026-06-16",
  "p_active_energy": 514,
  "p_exercise_min": 46,
  "p_stand_hours": 7,
  "p_cardio_recovery": 32,
  "p_resting_hr": 51,
  "p_respiratory": 15.5,
  "p_body_temp": 36.8,
  "p_weight": 80.6,
  "p_sleep_hours": 7.5,
  "p_sleep_score": 68,
  "p_workout_type": "swim",
  "p_workout_min": 46,
  "p_workout_cal": 330,
  "p_workout_dist": 1616,
  "p_hr_max": 154,
  "p_hr_min": 87
}
```

| Campo JSON | Métrica no app Saúde | Tipo de treino válido p/ `p_workout_type` |
|---|---|---|
| `p_date` | data (AAAA-MM-DD) — **obrigatório** | `swim`, `walk`, `bike`, `gym`, `other`, `rest` |
| `p_active_energy` | Energia Ativa (cal) | |
| `p_exercise_min` | Minutos de Exercício | |
| `p_stand_hours` | Horas Em Pé | |
| `p_cardio_recovery` | Recuperação Cardiovascular (BPM) | |
| `p_resting_hr` | FC de Repouso | |
| `p_respiratory` | Frequência Respiratória | |
| `p_body_temp` | Temperatura Corporal (°C) | |
| `p_weight` | Peso (kg) | |
| `p_sleep_hours` / `p_sleep_score` | Sono (horas / pontos) | |
| `p_workout_*` | Treino: tipo, min, cal, distância(m), FC máx/mín | |

Resposta esperada: **HTTP 204** (sucesso, sem corpo).

---

## 2. Montar o Atalho (passo a passo)

No app **Atalhos** → **+** (novo atalho):

1. **Data** — Adicione a ação **Data** (data atual) → **Formatar Data** → formato
   personalizado `yyyy-MM-dd`. Guarde como variável `Hoje`.

2. **Ler o Apple Saúde** — para cada métrica, adicione **Encontrar Amostras de Saúde**:
   - *Tipo*: ex. "Energia Ativa" / "Frequência Cardíaca em Repouso" / "VO2 máx." etc.
   - *Ordenar por*: Data de Término — *Final* (mais recente)
   - *Limite*: 1
   - Depois **Obter Detalhes da Amostra de Saúde** → **Valor**. Guarde em variável
     (ex. `energia`, `fcRepouso`, `sono`...).
   > Dica: comece com 3–4 métricas (energia ativa, FC repouso, peso, treino). Dá pra
   > expandir depois.

3. **Montar o JSON** — ação **Dicionário**. Adicione as chaves (`p_date`,
   `p_active_energy`, ...) e em cada valor selecione a variável correspondente.
   Deixe de fora o que você não coletou.

4. **Enviar** — ação **Obter Conteúdo de URL**:
   - *URL*: a URL do passo 1
   - *Método*: `POST`
   - *Cabeçalhos*: adicione `apikey`, `Authorization` (com `Bearer ...`) e
     `Content-Type: application/json`
   - *Corpo da Requisição*: **JSON** → selecione o **Dicionário** do passo 3

5. (Opcional) **Mostrar Notificação** "Saúde sincronizada ✅" no fim.

---

## 3. Rodar automaticamente todo dia

No app **Atalhos** → aba **Automação** → **+** → **Hora do Dia**:
- Escolha o horário (ex. **23:30**), repetir **Diariamente**
- Ação: **Executar Atalho** → selecione o atalho criado
- **Desligue** "Perguntar Antes de Executar" para rodar sozinho.

Pronto: todo dia às 23:30 o iPhone lê o Apple Saúde e atualiza o app na nuvem.

---

## 4. Testar

Rode o atalho manualmente uma vez. Depois abra o app online e veja os dados do dia:
<https://danielsmartaccess.github.io/daniel-health-app/saude-app.html>

> **Segurança:** a chave acima é a `anon` (pública), a mesma que o app já usa. Como o
> projeto é sem login, trate a URL como semi-secreta. Para blindar no futuro, ver as
> notas em `CLAUDE.md` (anonymous sign-in).

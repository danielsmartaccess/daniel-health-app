/**
 * @knee/shared — domínio puro, usado pelo client e pelo server.
 *
 * Regras (verificadas pelo ESLint):
 *  - sem React, sem timers reais, sem Date.now() / new Date() sem argumento;
 *  - o tempo sempre entra como parâmetro (`now`).
 *
 * Conteúdo previsto (cards 1.1, 1.2, 2.x):
 *  - máquina de estados do treino (idle → running → resting → paused → finished);
 *  - localDate(instant) em America/Sao_Paulo;
 *  - schemas zod dos payloads da API (fonte única para client e server).
 */
export {};

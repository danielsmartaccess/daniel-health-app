/**
 * @knee/shared — domínio puro, usado pelo client e pelo server.
 *
 * Regras (verificadas pelo ESLint):
 *  - sem React, sem timers reais, sem Date.now() / new Date() sem argumento;
 *  - o tempo sempre entra como parâmetro (`now`).
 */
export * from './time';
export * from './schemas';
export * from './api';
export * from './recovery';
export * from './workout/plan';
export * from './workout/machine';

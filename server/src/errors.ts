import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiError } from '@knee/shared';

/** Erro de aplicação com status HTTP. A mensagem é segura para ir ao cliente. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string) => new AppError(404, `${what} não encontrado`);
export const conflict = (message: string) => new AppError(409, message);
export const badRequest = (message: string) => new AppError(400, message);
export const unprocessable = (message: string) => new AppError(422, message);

/**
 * Tradução final de erros para HTTP. Erros inesperados viram 500 com mensagem genérica:
 * detalhes internos (inclusive do Supabase) ficam só no log do servidor, e só a mensagem.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: 'Dados inválidos',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    };
    res.status(400).json(body);
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message } satisfies ApiError);
    return;
  }
  // JSON malformado no corpo (body-parser)
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({ error: 'JSON inválido' } satisfies ApiError);
    return;
  }

  console.error('[api] erro interno:', err instanceof Error ? err.message : 'desconhecido');
  res.status(500).json({ error: 'Erro interno' } satisfies ApiError);
};

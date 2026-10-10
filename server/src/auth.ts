import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { ApiError } from '@knee/shared';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/**
 * Exige a chave do aparelho em `Authorization: Bearer <chave>`.
 * A API fica na internet e devolve dados de saúde; isto não é login, é uma chave longa
 * (≥ 32 caracteres aleatórios) guardada no celular. A comparação é em tempo constante
 * (hash dos dois lados → mesmo tamanho → timingSafeEqual), sem vazar o tamanho da chave.
 */
export function requireDeviceToken(expected: string): RequestHandler {
  const expectedDigest = digest(expected);
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    const ok = scheme === 'Bearer' && !!token && timingSafeEqual(digest(token), expectedDigest);
    if (!ok) {
      res.status(401).json({ error: 'Chave do aparelho ausente ou inválida' } satisfies ApiError);
      return;
    }
    next();
  };
}

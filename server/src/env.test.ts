import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

// Valor falso, de propósito fora do formato sb_secret_ (o check-secrets bloquearia).
const SECRET = 'fake-service-role-key-only-for-tests-0000';
const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: SECRET,
  DEVICE_TOKEN: 'x'.repeat(43),
};

describe('loadEnv', () => {
  it('aplica os defaults de rede e do dono único', () => {
    const env = loadEnv(valid);
    expect(env.HOST).toBe('127.0.0.1');
    expect(env.PORT).toBe(3001);
    expect(env.OWNER_ID).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('falha sem a chave de serviço', () => {
    expect(() => loadEnv({ SUPABASE_URL: valid.SUPABASE_URL })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('exige chave do aparelho longa (≥ 32)', () => {
    expect(() => loadEnv({ ...valid, DEVICE_TOKEN: 'curta' })).toThrow(/DEVICE_TOKEN/);
  });

  it('trata variável vazia como ausente', () => {
    expect(() => loadEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: '' })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('nunca expõe o valor da chave na mensagem de erro', () => {
    try {
      loadEnv({ ...valid, SUPABASE_URL: 'nao-e-url' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(SECRET);
    }
  });
});

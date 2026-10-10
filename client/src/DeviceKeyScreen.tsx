import { useState, type FormEvent } from 'react';
import { saveDeviceKey } from './deviceKey';

/** Pede a chave do aparelho quando ela falta ou foi recusada. Normalmente vem pelo link. */
export function DeviceKeyScreen({ rejected, onSaved }: { rejected: boolean; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim().length < 32) {
      setError('A chave tem pelo menos 32 caracteres.');
      return;
    }
    if (!saveDeviceKey(value)) {
      setError('Este navegador não permite salvar a chave (modo privado?).');
      return;
    }
    onSaved();
  }

  return (
    <form className="screen-message key-form" onSubmit={submit}>
      <h1>Chave do aparelho</h1>
      <p className="muted">
        {rejected
          ? 'A chave salva neste aparelho não foi aceita. Abra de novo o link de configuração ou cole a chave nova.'
          : 'Abra o link de configuração neste aparelho, ou cole a chave abaixo. Ela fica salva só aqui.'}
      </p>
      <input
        className="key-input"
        type="password"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Chave do aparelho"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {error && <p className="key-error">{error}</p>}
      <button className="button button--primary" type="submit">
        Salvar chave
      </button>
    </form>
  );
}

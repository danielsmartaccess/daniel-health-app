import { useCallback, useEffect, useState } from 'react';
import { DeviceKeyScreen } from './DeviceKeyScreen';
import { captureDeviceKeyFromUrl, forgetDeviceKey, readDeviceKey } from './deviceKey';
import { RecoveryScreen } from './recovery/RecoveryScreen';
import { CALLBACK_PATH } from './spotify/auth';
import { SpotifyCallback } from './spotify/SpotifyCallback';
import { TrainingScreen } from './TrainingScreen';

type Tab = 'treino' | 'recuperacao';

const tabFromPath = (): Tab =>
  window.location.pathname.startsWith('/recuperacao') ? 'recuperacao' : 'treino';

captureDeviceKeyFromUrl();

export function App() {
  const [key, setKey] = useState<'ok' | 'missing' | 'rejected'>(() =>
    readDeviceKey() ? 'ok' : 'missing',
  );
  const [tab, setTab] = useState<Tab>(tabFromPath);
  const [spotifyCallback, setSpotifyCallback] = useState(
    () => window.location.pathname === CALLBACK_PATH,
  );

  useEffect(() => {
    const onPop = () => setTab(tabFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onUnauthorized = useCallback(() => {
    forgetDeviceKey();
    setKey('rejected');
  }, []);

  const go = (next: Tab) => {
    if (next === tab) return;
    history.pushState(null, '', next === 'recuperacao' ? '/recuperacao' : '/');
    setTab(next);
  };

  // Volta do login do Spotify (/spotify/callback): conclui e retorna ao treino.
  if (spotifyCallback) {
    return (
      <SpotifyCallback
        onDone={() => {
          history.replaceState(null, '', '/');
          setTab('treino');
          setSpotifyCallback(false);
        }}
      />
    );
  }

  if (key !== 'ok') {
    return <DeviceKeyScreen rejected={key === 'rejected'} onSaved={() => setKey('ok')} />;
  }

  return (
    <div className="app">
      <nav className="tabs" aria-label="Seções">
        <button
          className="tabs__item"
          aria-current={tab === 'treino' ? 'page' : undefined}
          onClick={() => go('treino')}
        >
          Treino
        </button>
        <button
          className="tabs__item"
          aria-current={tab === 'recuperacao' ? 'page' : undefined}
          onClick={() => go('recuperacao')}
        >
          Recuperação
        </button>
      </nav>
      {/* O treino fica montado (só escondido) para não perder um treino em andamento. */}
      <div className="app__screen" hidden={tab !== 'treino'}>
        <TrainingScreen onUnauthorized={onUnauthorized} />
      </div>
      <div className="app__screen" hidden={tab !== 'recuperacao'}>
        <RecoveryScreen active={tab === 'recuperacao'} onUnauthorized={onUnauthorized} />
      </div>
    </div>
  );
}

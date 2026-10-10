import { describe, expect, it } from 'vitest';
import { pickVoice, VoiceCoach, type UtteranceLike, type VoiceLike } from './voiceCoach';

const voice = (name: string, lang: string, localService = true, isDefault = false): VoiceLike => ({
  name,
  lang,
  localService,
  default: isDefault,
});

describe('pickVoice', () => {
  it('prefere pt-BR a pt-PT e a outros idiomas', () => {
    const voices = [voice('Samantha', 'en-US'), voice('Joana', 'pt-PT'), voice('Luciana', 'pt-BR')];
    expect(pickVoice(voices)?.name).toBe('Luciana');
  });

  it('aceita lang com sublinhado (Android)', () => {
    expect(pickVoice([voice('Português', 'pt_BR')])?.name).toBe('Português');
  });

  it('prefere voz local (sem internet, sem atraso) a voz remota', () => {
    const voices = [
      voice('Google português do Brasil', 'pt-BR', false),
      voice('Microsoft Daniel', 'pt-BR', true),
    ];
    expect(pickVoice(voices)?.name).toBe('Microsoft Daniel');
  });

  it('entre vozes locais, usa a lista de preferidas', () => {
    const voices = [voice('Felipe', 'pt-BR'), voice('Luciana', 'pt-BR')];
    expect(pickVoice(voices)?.name).toBe('Luciana');
  });

  it('cai para pt-PT se não houver pt-BR, e null sem português', () => {
    expect(pickVoice([voice('Joana', 'pt-PT'), voice('Alex', 'en-US')])?.name).toBe('Joana');
    expect(pickVoice([voice('Alex', 'en-US')])).toBeNull();
  });
});

type Utt = UtteranceLike<VoiceLike> & { text: string };

function fakeSynth(voices: VoiceLike[] = [voice('Luciana', 'pt-BR')]) {
  const log: string[] = [];
  const spoken: Utt[] = [];
  let onVoices: (() => void) | undefined;
  const synth = {
    voices,
    speak: (u: Utt) => {
      log.push(`speak:${u.text}`);
      spoken.push(u);
    },
    cancel: () => log.push('cancel'),
    getVoices: () => synth.voices,
    addEventListener: (_type: 'voiceschanged', listener: () => void) => {
      onVoices = listener;
    },
  };
  const make = (text: string): Utt => ({ text, lang: '', rate: 0, voice: null });
  return { synth, make, log, spoken, fireVoicesChanged: () => onVoices?.() };
}

describe('VoiceCoach', () => {
  it('fala em pt-BR com a voz escolhida, cancelando a fala anterior', () => {
    const f = fakeSynth();
    const coach = new VoiceCoach(f.synth, f.make);
    coach.speak('Faltam 5 segundos');
    expect(f.log).toEqual(['cancel', 'speak:Faltam 5 segundos']);
    expect(f.spoken[0]).toMatchObject({ lang: 'pt-BR', rate: 1, voice: { name: 'Luciana' } });
  });

  it('pega a voz quando a lista chega depois (voiceschanged)', () => {
    const f = fakeSynth([]);
    const coach = new VoiceCoach(f.synth, f.make);
    coach.speak('a');
    expect(f.spoken[0]?.voice).toBeNull();

    f.synth.voices = [voice('Luciana', 'pt-BR')];
    f.fireVoicesChanged();
    coach.speak('b');
    expect(f.spoken[1]?.voice?.name).toBe('Luciana');
  });

  it('sem speechSynthesis: fica mudo e não quebra', () => {
    const coach = new VoiceCoach<VoiceLike, Utt>(null, () => {
      throw new Error('não deveria criar fala');
    });
    expect(coach.available).toBe(false);
    expect(() => coach.speak('x')).not.toThrow();
  });

  it('erro do motor de voz nunca derruba o treino', () => {
    const f = fakeSynth();
    f.synth.speak = () => {
      throw new Error('motor travado');
    };
    expect(() => new VoiceCoach(f.synth, f.make).speak('x')).not.toThrow();
  });
});

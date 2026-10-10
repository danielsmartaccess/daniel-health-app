/**
 * Card 3.2 — voz em pt-BR via Web Speech API (speechSynthesis).
 *
 * Interfaces mínimas (em vez dos tipos DOM) para testar sem navegador.
 * No iPhone, a primeira fala precisa acontecer dentro de um toque do usuário:
 * por isso o botão "Iniciar treino" chama speak() antes de tudo.
 */
export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface UtteranceLike<V extends VoiceLike> {
  lang: string;
  rate: number;
  voice: V | null;
}

export interface SynthLike<V extends VoiceLike, U extends UtteranceLike<V>> {
  speak(utterance: U): void;
  cancel(): void;
  getVoices(): V[];
  addEventListener?(type: 'voiceschanged', listener: () => void): void;
}

/** Vozes conhecidas e boas em pt-BR (iOS, Android/Chrome, Windows/Edge), em ordem de preferência. */
const PREFERRED_NAMES = [
  'luciana',
  'francisca',
  'thalita',
  'google português do brasil',
  'felipe',
  'antonio',
];

const normalizeLang = (lang: string) => lang.replace('_', '-').toLowerCase();

/**
 * Escolhe a voz: pt-BR antes de outro português; voz local antes de remota (funciona sem
 * internet e sem atraso, o que importa num aviso de 5 s); depois os nomes preferidos.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const ptBR = voices.filter((v) => normalizeLang(v.lang) === 'pt-br');
  const pool =
    ptBR.length > 0 ? ptBR : voices.filter((v) => normalizeLang(v.lang).startsWith('pt'));
  if (pool.length === 0) return null;

  const rank = (v: V) => {
    const i = PREFERRED_NAMES.findIndex((name) => v.name.toLowerCase().includes(name));
    return i === -1 ? PREFERRED_NAMES.length : i;
  };
  return [...pool].sort(
    (a, b) =>
      Number(b.localService) - Number(a.localService) ||
      rank(a) - rank(b) ||
      Number(b.default) - Number(a.default),
  )[0]!;
}

export class VoiceCoach<V extends VoiceLike, U extends UtteranceLike<V>> {
  private voice: V | null = null;

  constructor(
    private readonly synth: SynthLike<V, U> | null,
    private readonly makeUtterance: (text: string) => U,
  ) {
    if (!synth) return;
    this.refreshVoice();
    // Em vários navegadores a lista de vozes chega depois do carregamento.
    synth.addEventListener?.('voiceschanged', () => this.refreshVoice());
  }

  get available(): boolean {
    return this.synth !== null;
  }

  /** Fala o texto, interrompendo qualquer fala anterior (o aviso novo é sempre o que vale). */
  speak(text: string): void {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utterance = this.makeUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1;
      if (this.voice) utterance.voice = this.voice;
      this.synth.speak(utterance);
    } catch {
      // Voz é ajuda, não requisito: uma falha aqui nunca pode travar o treino.
    }
  }

  /** Interrompe a fala em andamento (ex.: ao pausar o treino). */
  silence(): void {
    try {
      this.synth?.cancel();
    } catch {
      // idem speak(): a voz nunca derruba o treino
    }
  }

  private refreshVoice(): void {
    this.voice = this.synth ? pickVoice(this.synth.getVoices()) : null;
  }
}

/** Instância para o navegador; sem speechSynthesis vira um narrador mudo. */
export function createBrowserVoiceCoach() {
  const synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  return new VoiceCoach<SpeechSynthesisVoice, SpeechSynthesisUtterance>(
    synth,
    (text) => new SpeechSynthesisUtterance(text),
  );
}

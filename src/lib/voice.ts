// Text-to-speech (browser voices) and speech recognition.

const PREFERRED = [
  /Google US English/i,
  /Samantha/i,
  /Ava/i,
  /Allison/i,
  /Jenny/i,
  /Aria/i,
  /Natural/i,
  /Google UK English Female/i,
  /Karen/i,
];

let voices: SpeechSynthesisVoice[] = [];
let enVoice: SpeechSynthesisVoice | null = null;
let viVoice: SpeechSynthesisVoice | null = null;
let rate = 0.85;

const synth = (): SpeechSynthesis | null => ('speechSynthesis' in globalThis ? globalThis.speechSynthesis : null);

function pickVoices() {
  const s = synth();
  if (!s) return;
  voices = s.getVoices();
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  enVoice =
    PREFERRED.map((re) => en.find((v) => re.test(v.name))).find(Boolean) ??
    en.find((v) => /en[-_]US/i.test(v.lang)) ??
    en[0] ??
    null;
  viVoice = voices.find((v) => /^vi/i.test(v.lang)) ?? null;
}

export function initVoice() {
  const s = synth();
  if (!s) return;
  pickVoices();
  s.addEventListener?.('voiceschanged', pickVoices);
}

export const setRate = (r: number) => {
  rate = r;
};

export const hasVietnameseVoice = () => !!viVoice;
export const canSpeak = () => !!synth();

/** Speak one or more lines in order. Resolves when done (or after a timeout if the browser stalls). */
export function say(lines: string | string[], opts: { lang?: 'en' | 'vi'; slow?: boolean } = {}): Promise<void> {
  const s = synth();
  const list = Array.isArray(lines) ? lines : [lines];
  if (!s || list.length === 0) return Promise.resolve();
  s.cancel();
  return new Promise((resolve) => {
    let left = list.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const totalChars = list.join(' ').length;
    const guard = setTimeout(finish, 1500 + totalChars * 120);
    for (const text of list) {
      const u = new SpeechSynthesisUtterance(text);
      if (opts.lang === 'vi') {
        if (viVoice) u.voice = viVoice;
        u.lang = 'vi-VN';
        u.rate = 1;
      } else {
        if (enVoice) u.voice = enVoice;
        u.lang = enVoice?.lang ?? 'en-US';
        u.rate = opts.slow ? rate * 0.8 : rate;
        u.pitch = 1.1;
      }
      u.onend = u.onerror = () => {
        left--;
        if (left <= 0) {
          clearTimeout(guard);
          finish();
        }
      };
      s.speak(u);
    }
  });
}

export const stopSpeaking = () => synth()?.cancel();

// ---------- recognition ----------

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

const RecCtor = (): (new () => Rec) | null =>
  (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition ?? null;

export const canListen = () => !!RecCtor();

export interface ListenResult {
  alternatives: string[];
  error?: string;
}

/** Listen for one short phrase. Returns all alternatives heard. */
export function listen(timeoutMs = 6000): { result: Promise<ListenResult>; stop: () => void } {
  const Ctor = RecCtor();
  if (!Ctor) return { result: Promise.resolve({ alternatives: [], error: 'unsupported' }), stop: () => {} };
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  const alternatives: string[] = [];
  let error: string | undefined;
  const result = new Promise<ListenResult>((resolve) => {
    const t = setTimeout(() => rec.stop(), timeoutMs);
    rec.onresult = (e: any) => {
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        for (let j = 0; j < r.length; j++) alternatives.push(r[j].transcript);
      }
    };
    rec.onerror = (e: any) => {
      error = e.error;
    };
    rec.onend = () => {
      clearTimeout(t);
      resolve({ alternatives, error });
    };
    try {
      rec.start();
    } catch {
      clearTimeout(t);
      resolve({ alternatives: [], error: 'start-failed' });
    }
  });
  return { result, stop: () => rec.stop() };
}

// ---------- recording the child's voice (kept in memory only, never saved or sent) ----------

let micStream: MediaStream | null = null;
/** Some phones can't record and recognise at the same time; then we only recognise. */
let recordingClashes = false;

export const canRecord = () =>
  !recordingClashes && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function markRecordingClash() {
  recordingClashes = true;
  closeMic();
}

export async function openMic(): Promise<boolean> {
  if (micStream) return true;
  if (!canRecord()) return false;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return true;
  } catch {
    return false;
  }
}

export function closeMic() {
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
}

const MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];

/** Start recording; `stop()` resolves with the clip (or null if recording isn't possible). */
export function startRecording(): { stop: () => Promise<Blob | null> } {
  if (!micStream) return { stop: async () => null };
  const type = MIME.find((m) => MediaRecorder.isTypeSupported?.(m));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(micStream, type ? { mimeType: type } : undefined);
  } catch {
    return { stop: async () => null };
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        if (rec.state === 'inactive') return resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
        rec.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null);
        rec.stop();
      }),
  };
}

let playing: HTMLAudioElement | null = null;

/** Play a recorded clip. Resolves when it ends (or fails). */
export function playClip(clip: Blob | null): Promise<void> {
  if (!clip) return Promise.resolve();
  playing?.pause();
  const url = URL.createObjectURL(clip);
  const a = new Audio(url);
  playing = a;
  return new Promise((resolve) => {
    const done = () => {
      URL.revokeObjectURL(url);
      if (playing === a) playing = null;
      resolve();
    };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  });
}

export const stopClip = () => playing?.pause();

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

// ---------- pre-generated English voice (public/voice/*.mp3, made by scripts/gen-voice.mjs) ----------
// Câu nào có file thì phát file (giọng đồng đều trên mọi máy); câu nào chưa có thì rơi về TTS của trình duyệt.

const base = import.meta.env?.BASE_URL ?? './';
let clipKeys = new Set<string>();
const clipUrls = new Map<string, Promise<string | null>>();
const DEFAULT_RATE = 0.85;

async function loadManifest() {
  try {
    const r = await fetch(`${base}voice/manifest.json`);
    if (r.ok) clipKeys = new Set<string>(await r.json());
  } catch {
    /* offline lần đầu hoặc không có: dùng TTS */
  }
}

/** Tải file thành blob URL (không dùng Range request, vì Safari phát từ service worker không ổn với Range). */
function clipUrl(key: string): Promise<string | null> {
  let p = clipUrls.get(key);
  if (!p) {
    p = fetch(`${base}voice/${key}.mp3`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        clipUrls.delete(key);
        return null;
      });
    clipUrls.set(key, p);
  }
  return p;
}

/** Same as src/lib/phrases.ts phraseKey; duplicated so the app does not bundle the whole phrase list. */
function phraseKey(text: string): string {
  const b = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const end = text.trim().slice(-1);
  return (b || 'x') + (end === '!' ? '_e' : end === '?' ? '_q' : end === '.' ? '_p' : '');
}

let voiceEl: HTMLAudioElement | null = null;
let sayToken = 0;

/** Play a pre-generated clip. Resolves false if it could not be played (caller then uses TTS). */
async function playVoiceClip(key: string, speed: number, token: number): Promise<boolean> {
  const url = await clipUrl(key);
  if (!url || token !== sayToken) return token === sayToken ? false : true;
  const a = (voiceEl ??= new Audio());
  a.src = url;
  a.playbackRate = speed;
  a.preservesPitch = true;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const end = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      a.onended = a.onerror = a.onpause = null;
      resolve(ok);
    };
    const guard = setTimeout(() => end(true), 10000);
    a.onended = () => end(true);
    a.onerror = () => end(false);
    a.onpause = () => end(true); // bị cắt bởi lời nói mới
    a.play().catch(() => end(false));
  });
}

function speakTts(text: string, opts: { lang?: 'en' | 'vi'; slow?: boolean }, token: number): Promise<void> {
  const s = synth();
  if (!s) return Promise.resolve();
  return new Promise((resolve) => {
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
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };
    const guard = setTimeout(finish, 1500 + text.length * 120);
    u.onend = u.onerror = finish;
    if (token === sayToken) s.speak(u);
    else finish();
  });
}

export function initVoice() {
  void loadManifest();
  const s = synth();
  if (!s) return;
  pickVoices();
  s.addEventListener?.('voiceschanged', pickVoices);
}

export const setRate = (r: number) => {
  rate = r;
};

export const hasVietnameseVoice = () => !!viVoice;
export const canSpeak = () => !!synth() || clipKeys.size > 0;

/** Say one or more lines in order. Resolves when done, or when a newer say() / stopSpeaking() cuts it off. */
export async function say(lines: string | string[], opts: { lang?: 'en' | 'vi'; slow?: boolean } = {}): Promise<void> {
  const list = Array.isArray(lines) ? lines : [lines];
  if (list.length === 0) return;
  const token = ++sayToken;
  synth()?.cancel();
  voiceEl?.pause();
  for (const text of list) {
    if (token !== sayToken) return;
    if (opts.lang !== 'vi') {
      const key = phraseKey(text);
      if (clipKeys.has(key)) {
        const speed = (rate / DEFAULT_RATE) * (opts.slow ? 0.8 : 1);
        if (await playVoiceClip(key, speed, token)) continue;
        if (token !== sayToken) return;
      }
    }
    await speakTts(text, opts, token);
  }
}

export const stopSpeaking = () => {
  sayToken++;
  synth()?.cancel();
  voiceEl?.pause();
};

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

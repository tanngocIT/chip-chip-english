"""Phần Python của gen-voice.mjs: đọc danh sách câu, sinh mp3 bằng Piper.

Từ đơn lẻ (1-2 từ) đọc riêng thì mô hình hay nuốt âm đầu/cuối ("cat" nghe như "tack"),
nên ta sinh "Say, <từ>." rồi cắt bỏ chữ "Say" (dùng Whisper để biết "Say" kết thúc ở đâu,
rồi chọn điểm yên lặng gần nhất làm chỗ cắt). Câu dài hơn thì đọc nguyên.

Cần: pip install piper-tts soundfile scipy faster-whisper
"""
import io
import json
import os
import sys
import wave

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel
from piper import PiperVoice
from scipy.signal import resample_poly

job = json.load(open(sys.argv[1], encoding="utf-8"))
voice = PiperVoice.load(job["model"])
# WHISPER_MODEL: path to a downloaded faster-whisper model, for machines where Python cannot download it.
asr = WhisperModel(os.environ.get("WHISPER_MODEL", "small.en"), compute_type="int8")


def synth(text):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w)
    buf.seek(0)
    d, sr = sf.read(buf, dtype="float32")
    return d, sr


def first_word_end(d, sr):
    """Giây mà từ đầu tiên (chữ "Say") kết thúc, theo Whisper."""
    pad = 0.5
    x = np.concatenate([np.zeros(int(16000 * pad), "float32"), resample_poly(d, 16000, sr).astype("float32")])
    segs, _ = asr.transcribe(x, language="en", word_timestamps=True, temperature=0, condition_on_previous_text=False)
    for s in segs:
        for w in s.words:
            return w.end - pad
    return None


def heard(d, sr):
    x = np.concatenate([np.zeros(8000, "float32"), resample_poly(d, 16000, sr).astype("float32"), np.zeros(8000, "float32")])
    segs, _ = asr.transcribe(x, language="en", temperature=0, condition_on_previous_text=False)
    return " ".join(s.text for s in segs).strip().lower()


def frames(d, sr, ms=5):
    f = int(sr * ms / 1000)
    n = len(d) // f
    return f, np.array([np.sqrt(np.mean(d[i * f : (i + 1) * f] ** 2)) for i in range(n)])


def cut_after_say(d, sr):
    t = first_word_end(d, sr)
    if t is None:
        return None
    f, rms = frames(d, sr)
    lo, hi = max(0, int((t - 0.12) * sr / f)), min(len(rms) - 1, int((t + 0.18) * sr / f))
    if hi <= lo:
        return None
    # điểm yên lặng nhất trong cửa sổ; nếu nhiều điểm bằng nhau lấy điểm giữa
    seg = rms[lo : hi + 1]
    low = np.where(seg <= seg.min() * 1.5 + 1e-4)[0]
    i = lo + int(low[len(low) // 2])
    return d[i * f :]


def tidy(d, sr):
    """Bỏ im lặng thừa, thêm 50 ms đầu (iOS hay cắt âm đầu), chuẩn hoá âm lượng."""
    f, rms = frames(d, sr, 10)
    voiced = np.where(rms > rms.max() * 0.03)[0]
    if len(voiced):
        a = max(0, voiced[0] - 2) * f
        b = min(len(d), (voiced[-1] + 9) * f)
        d = d[a:b]
    fade = int(sr * 0.01)
    d = d.copy()
    d[:fade] *= np.linspace(0, 1, fade)
    d = np.concatenate([np.zeros(int(sr * 0.05), "float32"), d])
    peak = float(np.max(np.abs(d))) or 1.0
    return d * (0.89 / peak)


for n, (key, text) in enumerate(job["items"], 1):
    words = [w for w in text.split() if any(c.isalnum() for c in w)]
    d, sr = synth(text)
    if len(words) <= 2:
        d2, sr2 = synth("Say, " + text[0].lower() + text[1:] if not text.startswith("I") else "Say, " + text)
        cut = cut_after_say(d2, sr2)
        # chỉ nhận kết quả cắt nếu độ dài hợp lý, không thì dùng bản đọc riêng
        # Whisper nghe lại: nếu còn chữ "say" ở đầu thì cắt thêm một lần nữa
        for _ in range(2):
            if cut is not None and heard(cut, sr2).startswith(("say", "stay")):
                cut = cut_after_say(np.concatenate([np.zeros(int(sr2 * 0.1), "float32"), cut]), sr2)
            else:
                break
        if cut is not None and heard(cut, sr2).startswith(("say", "stay")):
            cut = None  # vẫn còn "say": dùng bản đọc riêng
        if cut is not None and 0.15 < len(cut) / sr2 < 2.5:
            d, sr = cut, sr2
    d = tidy(d, sr)
    sf.write(f"{job['dir']}/{key}.mp3", d, sr, format="MP3", bitrate_mode="VARIABLE", compression_level=0.6)
    if n % 25 == 0 or n == len(job["items"]):
        print(f"  {n}/{len(job['items'])}", flush=True)

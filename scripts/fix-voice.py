"""Whisper listens to the voice clips; a clip it mishears is generated again until one is heard right.

The first batch of clips was made before any listening check and some were plainly broken
("rock" came out as 1.46 s of noise that Whisper heard as a whole sentence).

Usage (from the repo root, with the same Python as gen-voice.mjs):
    python scripts/fix-voice.py <texts.json> <model.onnx> words|sentences

<texts.json> maps each clip key to its text; build it from allPhrases() and phraseKey().
Set WHISPER_MODEL to a local faster-whisper model folder if Python cannot download one.
Replaced clips are copied to voice-model/backup-old/ first. A report goes to voice-model/.
"""
import json
import os
import re
import shutil
import sys

texts_path, model_path, mode = sys.argv[1], sys.argv[2], sys.argv[3]
texts = json.load(open(texts_path, encoding="utf-8"))
os.makedirs("voice-model", exist_ok=True)
json.dump({"model": model_path, "dir": "voice-model", "items": []}, open("voice-model/empty-job.json", "w"))

# gen-voice.py holds the synthesis helpers; run it with an empty job to borrow them
sys.argv = ["gen-voice.py", "voice-model/empty-job.json"]
ns = {}
exec(open("scripts/gen-voice.py", encoding="utf-8").read(), ns)
synth, tidy, heard, cut_after_say = ns["synth"], ns["tidy"], ns["heard"], ns["cut_after_say"]
import soundfile as sf  # noqa: E402

NUM = dict(zip("1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20".split(),
               "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split()))
# spellings Whisper prefers that are the same sounds
SAME = {"wheres": "whereis", "its": "itis", "theyre": "theyare", "im": "iam", "lets": "letus", "zee": "z"}
# what Whisper writes when it hears a letter name on its own
LETTER_HEARD = {
    "a": "a ay eh hey", "b": "b be bee", "c": "c see sea", "d": "d dee", "e": "e ee he", "f": "f ef eff", "g": "g gee jee",
    "h": "h aitch age", "i": "i eye aye", "j": "j jay", "k": "k kay okay", "l": "l el elle ell", "m": "m em", "n": "n en",
    "o": "o oh", "p": "p pee pea", "q": "q queue cue", "r": "r are ar", "s": "s es ess", "t": "t tee tea", "u": "u you",
    "v": "v vee", "w": "w doubleu doubleyou", "x": "x ex", "y": "y why", "z": "z zee",
}


def same(heard_text, text):
    """True when Whisper heard the text. A single letter is matched by its name."""
    if len(text) == 1 and text.isupper():
        return norm(heard_text) in LETTER_HEARD[text.lower()].split()
    m = re.match(r"^([A-Z]) (is for .+)$", text)
    if m:  # the letter name may be written as a word: "You is for umbrella."
        words = re.sub(r"[^a-z0-9 ]", "", heard_text.lower().replace("-", " ")).split()
        return bool(words) and words[0] in LETTER_HEARD[m.group(1).lower()].split() and norm(" ".join(words[1:])) == norm(m.group(2))
    return norm(heard_text) == norm(text)


def norm(s):
    s = re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ").replace("&", " and "))
    return "".join(SAME.get(w, NUM.get(w, w)) for w in s.split())


def is_word(t):
    return t.strip()[-1] not in ".!?" and len(t.split()) <= 3


chosen = {k: t for k, t in texts.items() if is_word(t) == (mode == "words")}
os.makedirs("voice-model/backup-old", exist_ok=True)
report = {"ok": [], "fixed": [], "still": []}
for n, (key, text) in enumerate(sorted(chosen.items()), 1):
    path = f"public/voice/{key}.mp3"
    d, sr = sf.read(path, dtype="float32")
    first = heard(d, sr)
    if same(first, text):
        report["ok"].append(key)
        continue
    cap = text[0].upper() + text[1:]
    if mode == "words" and len(text) == 1 and text.isupper():
        sources = [("direct", f"{text}."), ("cut", f"Say, {text}."), ("direct", f"{text}!"), ("cut", f"Say, {text}!")]
        rounds, longest = 4, 1.4
    elif mode == "words":
        sources = [("cut", f"Say, {text}!"), ("cut", f"Say, {text}."), ("direct", cap + "."), ("direct", cap + "!"), ("cut", f"Say: {text}.")]
        rounds, longest = 3, 2.0
    else:
        sources = [("direct", text)]
        rounds, longest = 6, 6.0
    done = None
    for _ in range(rounds):
        for kind, src in sources:
            x, xsr = synth(src)
            if kind == "cut":
                x = cut_after_say(x, xsr)
                if x is None:
                    continue
            x = tidy(x, xsr)
            if not 0.2 < len(x) / xsr < longest:
                continue
            if same(heard(x, xsr), text):
                done = (x, xsr, src)
                break
        if done:
            break
    if done:
        shutil.copy(path, f"voice-model/backup-old/{key}.mp3")
        sf.write(path, done[0], done[1], format="MP3", bitrate_mode="VARIABLE", compression_level=0.6)
        report["fixed"].append([key, first, done[2]])
        print(f"FIXED {text!r}: was heard {first!r}", flush=True)
    else:
        report["still"].append([key, first, round(len(d) / sr, 2)])
        print(f"STILL {text!r}: heard {first!r} ({len(d) / sr:.2f}s)", flush=True)
json.dump(report, open(f"voice-model/fix-report-{mode}.json", "w"), indent=1)
print(f"DONE {mode}: ok={len(report['ok'])} fixed={len(report['fixed'])} still={len(report['still'])} of {len(chosen)}")

// Say it: speech recognition with playback of the child's voice.

import { h, wait, pulse, confetti } from '../lib/dom';
import { wordsIn, type Topic } from '../lib/content';
import { levelConfig, recordAnswer, pickTargets } from '../lib/progress';
import { say, stopSpeaking, listen, canRecord, openMic, startRecording, playClip, stopClip, markRecordingClash } from '../lib/voice';
import { passes } from '../lib/match';
import { sfx } from '../lib/sfx';
import { icon, picture, roundBtn } from '../ui';
import { P, screenId, alive, show, persist, leave, lessonBar, pick } from './core';
import { finishQuiz } from './quiz';

// ---------- say it ----------

export function sayIt(t: Topic) {
  const pool = wordsIn(t.id);
  const rounds = levelConfig(P.settings.age).sayRounds;
  const targets = pickTargets(pool, rounds, P);
  let round = 0;
  let firstTry = 0;

  const play = () => {
    const w = targets[round];
    let tries = 0;
    let busy = false;

    const status = h('p', { class: 'heard', 'aria-live': 'polite' }, '');
    const card = h('div', { class: 'card flash pop-in' }, picture(w, 'lg'), h('span', { class: 'word' }, w.word));
    const hear = roundBtn(icon.speaker(), 'Hear the word', () => {
      sfx.tap();
      void say(w.word, { slow: true });
    }, 'soft big');

    const mic = h('button', { class: 'mic', 'aria-label': 'Say it' }, icon.mic(), h('i', { class: 'ring' }));

    // The child's own voice from the last try, so they can compare it with the model.
    let clip: Blob | null = null;
    const mine = roundBtn(icon.voice(), 'Hear my voice', () => {
      if (!clip || busy) return;
      sfx.tap();
      stopSpeaking();
      void playClip(clip);
    }, 'soft big mine');
    mine.disabled = true;
    const playBack = P.settings.playback;
    if (!playBack || !canRecord()) mine.hidden = true;

    const next = async (ok: boolean) => {
      const id = screenId;
      recordAnswer(P, w.id, ok && tries === 1);
      if (ok && tries === 1) firstTry++;
      persist();
      await wait(400);
      if (!alive(id)) return;
      round++;
      if (round < targets.length) play();
      else finishQuiz(t, 'say', firstTry, targets.length);
    };

    /** Play back what the child said, then the model word. */
    const echo = async (heardSomething: boolean) => {
      if (playBack && clip && heardSomething) {
        await playClip(clip);
        await wait(150);
      }
    };

    mic.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const id = screenId;
      stopSpeaking();
      stopClip();
      const recording = playBack && (await openMic());
      if (!alive(id)) return;
      sfx.listen();
      mic.classList.add('on');
      status.textContent = '';
      await wait(250);
      const recorder = recording ? startRecording() : null;
      let r = await listen(5000).result;
      clip = recorder ? await recorder.stop() : null;
      if (recorder && r.error === 'audio-capture') {
        // This device can't share the microphone: stop recording and listen again.
        markRecordingClash();
        mine.hidden = true;
        clip = null;
        r = await listen(5000).result;
      }
      if (!alive(id)) return;
      mic.classList.remove('on');
      if (clip) mine.disabled = false;
      tries++;
      if (r.error === 'not-allowed' || r.error === 'service-not-allowed') {
        status.textContent = 'Cần cho phép micro trong trình duyệt.';
        tries--;
        busy = false;
        return;
      }
      const heard = r.alternatives.length > 0;
      if (r.alternatives[0]) status.textContent = `“${r.alternatives[0]}”`;
      if (passes(w.word, r.alternatives)) {
        sfx.right();
        confetti(card);
        pulse(card, 'wiggle');
        await say(pick(['Great job!', 'Yes!', 'Super!', 'Wonderful!']));
        await echo(heard);
        if (!alive(id)) return;
        await say(w.word);
        void next(true);
      } else if (tries < 2) {
        sfx.oops();
        await echo(heard);
        if (!alive(id)) return;
        await say(['Try again.', w.word], { slow: true });
        busy = false;
      } else {
        // Never leave the child stuck: praise the effort, model the word, move on.
        sfx.star();
        await echo(heard);
        if (!alive(id)) return;
        await say(['Good try!', w.word]);
        void next(false);
      }
    });

    show(
      h(
        'main',
        { class: 'screen lesson sayit', style: `--tint:${t.color}` },
        lessonBar(() => leave(t), targets.length, round),
        h('section', { class: 'stage' }, card),
        h('nav', { class: 'pager' }, hear, mic, mine),
        status,
      ),
    );
    setTimeout(() => void say(['Can you say', w.word]), 300);
  };
  play();
}

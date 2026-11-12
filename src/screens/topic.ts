// The list of games in one topic.

import { h } from '../lib/dom';
import { wordById, imgUrl, type Topic } from '../lib/content';
import { overLimit, type Activity } from '../lib/progress';
import { canListen } from '../lib/voice';
import { sfx } from '../lib/sfx';
import { icon, picture, starsRow, roundBtn } from '../ui';
import { P, show, endSession, startActivity } from './core';
import { home, rest } from './home';

// ---------- topic ----------

const ACTIVITIES: { id: Activity; name: string; img: string; silhouette?: boolean }[] = [
  { id: 'learn', name: 'Look and listen', img: imgUrl('eye') },
  { id: 'listen', name: 'Listen and tap', img: imgUrl('ear') },
  { id: 'match', name: 'Find the shadow', img: '', silhouette: true },
  { id: 'find', name: 'Find it', img: imgUrl('find') },
  { id: 'memory', name: 'Memory', img: imgUrl('puzzle-piece') },
  { id: 'say', name: 'Say it', img: imgUrl('mouth') },
  { id: 'sing', name: 'Sing along', img: imgUrl('drum') },
];

export function topicScreen(t: Topic) {
  endSession();
  if (overLimit(P)) return rest();
  const iconWord = wordById(t.icon)!;
  const acts = ACTIVITIES.filter((a) => (a.id !== 'say' || canListen()) && !(a.id === 'match' && t.noShadow)).map((a, i) => {
    const best = P.best[`${t.id}:${a.id}`] ?? 0;
    const art = a.silhouette ? picture(iconWord, 'shadow') : h('div', { class: 'pic' }, h('img', { src: a.img, alt: '' }));
    return h(
      'button',
      {
        class: `activity act-${a.id}`,
        style: `--i:${i}`,
        onclick: () => {
          sfx.tap();
          startActivity(t, a.id);
        },
      },
      art,
      h('span', { class: 'label' }, a.name),
      starsRow(best, 3, 'sm'),
    );
  });

  show(
    h(
      'main',
      { class: 'screen topic-screen', style: `--tint:${t.color}` },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Home', () => {
          sfx.tap();
          home();
        }),
        h('h2', {}, picture(iconWord, 'xs'), t.en),
        h('span', { class: 'spacer' }),
      ),
      h('section', { class: 'activities' }, acts),
    ),
  );
}

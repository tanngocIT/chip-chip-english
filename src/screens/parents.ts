// Grown-ups: the gate and the settings.

import { h } from '../lib/dom';
import { topics, wordsIn, wordById, stickers, type Word } from '../lib/content';
import { exportCode, importCode, topicStars, learnedCount, emptyProgress, type AgeLevel } from '../lib/progress';
import { say, setRate, canListen, hasVietnameseVoice, canSpeak, canRecord } from '../lib/voice';
import { viNumber } from '../lib/vi';
import { installState, promptInstall, onInstallChange } from '../lib/install';
import { icon, roundBtn, setChipLook } from '../ui';
import { app, P, inParentArea, show, persist, setInParentArea } from './core';
import { home } from './home';

// ---------- grown-ups ----------

export function parentGate() {
  setInParentArea(true);
  const target = 21 + Math.floor(Math.random() * 78);
  const set = new Set([target]);
  while (set.size < 4) set.add(21 + Math.floor(Math.random() * 78));
  const nums = [...set].sort(() => Math.random() - 0.5);
  show(
    h(
      'main',
      { class: 'screen grown gate' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Về trang chính', () => {
          setInParentArea(false);
          home();
        }),
        h('h2', {}, 'Dành cho bố mẹ'),
        h('span', { class: 'spacer' }),
      ),
      h('p', { class: 'ask' }, 'Chạm vào số ', h('b', {}, viNumber(target))),
      h(
        'div',
        { class: 'numpad' },
        nums.map((n) =>
          h('button', { onclick: () => (n === target ? parentArea() : (setInParentArea(false), home())) }, String(n)),
        ),
      ),
    ),
    () => {},
  );
}

export function parentArea() {
  setInParentArea(true);
  const s = P.settings;
  const field = (label: string, control: HTMLElement, hint?: string) =>
    h('label', { class: 'field' }, h('span', { class: 'flabel' }, label), control, hint && h('small', {}, hint));

  const age = h(
    'div',
    { class: 'seg', role: 'radiogroup' },
    (
      [
        ['small', '2–3 tuổi'],
        ['middle', '4–5 tuổi'],
        ['big', '6 tuổi'],
      ] as [AgeLevel, string][]
    ).map(([v, l]) =>
      h(
        'button',
        {
          role: 'radio',
          'aria-checked': String(s.age === v),
          class: s.age === v ? 'sel' : '',
          onclick: () => {
            s.age = v;
            persist();
            parentArea();
          },
        },
        l,
      ),
    ),
  );

  const rate = h('input', { type: 'range', min: '0.6', max: '1.1', step: '0.05', value: String(s.rate) }) as HTMLInputElement;
  rate.addEventListener('change', () => {
    s.rate = Number(rate.value);
    setRate(s.rate);
    persist();
    void say(['Hello!', 'Where is the cat?']);
  });

  const vi = h('input', { type: 'checkbox', checked: s.vietnamese, disabled: !hasVietnameseVoice() }) as HTMLInputElement;
  vi.addEventListener('change', () => {
    s.vietnamese = vi.checked;
    persist();
  });

  const playback = h('input', { type: 'checkbox', checked: s.playback, disabled: !canRecord() }) as HTMLInputElement;
  playback.addEventListener('change', () => {
    s.playback = playback.checked;
    persist();
  });

  const limit = h(
    'select',
    {},
    [0, 10, 15, 20, 30, 45, 60].map((m) =>
      h('option', { value: String(m), selected: s.limitMinutes === m }, m === 0 ? 'Không giới hạn' : `${m} phút`),
    ),
  ) as HTMLSelectElement;
  limit.addEventListener('change', () => {
    s.limitMinutes = Number(limit.value);
    persist();
  });

  const extra = h('button', {
    class: 'ghost',
    onclick: () => {
      P.minutesToday.minutes = 0;
      persist();
      parentArea();
    },
  }, 'Cho chơi thêm hôm nay');

  const rows = topics.map((t) => {
    const ids = wordsIn(t.id).map((w) => w.id);
    return h(
      'tr',
      {},
      h('td', {}, t.vi),
      h('td', {}, `${learnedCount(P, ids)} / ${ids.length}`),
      h('td', {}, `${topicStars(P, t.id)}`),
    );
  });

  const weak = Object.entries(P.words)
    .filter(([, st]) => st.wrong > 0 && st.box < 2)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 8)
    .map(([id]) => wordById(id))
    .filter(Boolean) as Word[];

  const reset = h('button', {
    class: 'danger',
    onclick: () => {
      if (confirm('Xóa toàn bộ tiến độ, sao và sticker của bé?')) {
        const keep = P.settings;
        Object.assign(P, emptyProgress(), { settings: keep });
        persist();
        setChipLook(P.look);
        parentArea();
      }
    },
  }, 'Xóa tiến độ');

  // Sao lưu: chép mã ở máy này, dán vào máy khác. Không qua máy chủ nào.
  const backupNote = h('small', { class: 'backup-note', 'aria-live': 'polite' }, '');
  const codeOut = h('textarea', { class: 'code', rows: '3', readonly: true, 'aria-label': 'Mã sao lưu' }) as HTMLTextAreaElement;
  codeOut.value = exportCode(P);
  const copyBtn = h('button', {
    class: 'ghost',
    onclick: async () => {
      codeOut.select();
      try {
        await navigator.clipboard.writeText(codeOut.value);
        backupNote.textContent = 'Đã sao chép. Dán mã này vào tin nhắn hoặc ghi chú để giữ lại.';
      } catch {
        backupNote.textContent = 'Chưa sao chép tự động được. Mã đã được chọn sẵn, hãy bấm giữ rồi chọn Sao chép.';
      }
    },
  }, 'Sao chép mã');
  const codeIn = h('textarea', { class: 'code', rows: '3', placeholder: 'Dán mã sao lưu vào đây', 'aria-label': 'Dán mã sao lưu' }) as HTMLTextAreaElement;
  const restoreBtn = h('button', {
    class: 'ghost',
    onclick: () => {
      const loaded = importCode(codeIn.value);
      if (!loaded) {
        backupNote.textContent = 'Mã không đúng. Hãy dán lại toàn bộ mã, bắt đầu bằng CHIP1:';
        return;
      }
      if (!confirm('Thay toàn bộ tiến độ trên máy này bằng bản sao lưu?')) return;
      Object.assign(P, loaded);
      persist();
      setRate(P.settings.rate);
      setChipLook(P.look);
      parentArea();
    },
  }, 'Khôi phục từ mã');

  // Cài app ra màn hình chính
  const refresh = () => {
    if (inParentArea && app.querySelector('.grown:not(.gate)')) parentArea();
  };
  const inst = installState();
  const installBtn = h('button', { class: 'primary', onclick: () => void promptInstall().then(refresh) }, 'Cài app ra màn hình chính');
  const installBody =
    inst === 'installed'
      ? [h('p', {}, 'App đã được cài trên máy này.')]
      : inst === 'prompt'
        ? [h('p', {}, 'Thêm Chip Chip English ra màn hình chính để bé mở như một app, chơi được cả khi không có mạng.'), installBtn]
        : inst === 'ios'
          ? [
              h('p', {}, 'Trên iPhone và iPad, hãy mở trang này bằng Safari rồi:'),
              h(
                'ol',
                { class: 'steps' },
                h('li', {}, 'Bấm nút ', h('b', {}, 'Chia sẻ'), ' ', icon.share(), ' (ô vuông có mũi tên lên).'),
                h('li', {}, 'Chọn ', h('b', {}, 'Thêm vào Màn hình chính'), '.'),
                h('li', {}, 'Bấm ', h('b', {}, 'Thêm'), '.'),
              ),
            ]
          : [h('p', {}, 'Mở menu của trình duyệt rồi chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”. Nên dùng Chrome (Android, máy tính) hoặc Safari (iPhone, iPad).')];
  // Trình duyệt có thể báo cài được sau khi màn này đã mở
  onInstallChange(refresh);

  show(
    h(
      'main',
      { class: 'screen grown' },
      h(
        'header',
        { class: 'bar' },
        roundBtn(icon.home(), 'Về trang chính', () => {
          setInParentArea(false);
          home();
        }),
        h('h2', {}, 'Cài đặt cho bố mẹ'),
        h('span', { class: 'spacer' }),
      ),
      h(
        'section',
        { class: 'panel' },
        field('Độ tuổi của bé', age, '2–3 tuổi: 2 hình, 8 câu, 10 thẻ từ; 4–5 tuổi: 3 hình, 10 câu, 12 thẻ từ; 6 tuổi: 4 hình, 12 câu, 15 thẻ từ. Bài Say it ít hơn 2 câu. Bài Find it có 6, 9 hoặc 12 hình trong tranh; Memory có 3, 4 hoặc 6 cặp thẻ. Từ 4–5 tuổi có thêm bài Sentences (câu ngắn) ở màn hình chính.'),
        field('Tốc độ đọc', rate, 'Kéo xong sẽ đọc thử.'),
        field(
          'Đọc thêm nghĩa tiếng Việt ở thẻ từ',
          vi,
          hasVietnameseVoice() ? undefined : 'Máy này chưa có giọng đọc tiếng Việt.',
        ),
        field(
          'Phát lại giọng bé ở bài Say it',
          playback,
          canRecord()
            ? 'Bé nghe lại mình vừa nói rồi nghe giọng mẫu để so sánh. Tiếng chỉ giữ tạm trong lúc chơi, không lưu và không gửi đi.'
            : 'Máy này không ghi âm được cùng lúc với nhận giọng nói.',
        ),
        field('Giới hạn mỗi ngày', limit, `Hôm nay đã chơi ${P.minutesToday.date === todayStr() ? P.minutesToday.minutes : 0} phút.`),
        extra,
      ),
      h(
        'section',
        { class: 'panel' },
        h('h3', {}, 'Tiến độ'),
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Chủ đề'), h('th', {}, 'Đã thuộc'), h('th', {}, 'Sao'))),
          h('tbody', {}, rows),
        ),
        h('p', {}, `Sticker: ${P.stickers.length} / ${stickers.length}`),
        weak.length > 0 &&
          h('p', {}, 'Từ bé hay nhầm: ', h('b', {}, weak.map((w) => `${w.word} (${w.vi})`).join(', '))),
      ),
      h(
        'section',
        { class: 'panel backup' },
        h('h3', {}, 'Sao lưu tiến độ'),
        h('p', {}, 'Tiến độ chỉ nằm trên máy này. Sao chép mã dưới đây và giữ ở nơi khác; khi đổi máy hoặc lỡ xóa dữ liệu trình duyệt thì dán mã vào để lấy lại sao, sticker và các từ bé đã học.'),
        codeOut,
        copyBtn,
        codeIn,
        restoreBtn,
        backupNote,
      ),
      h('section', { class: 'panel install' }, h('h3', {}, 'Cài app'), installBody),
      h(
        'section',
        { class: 'panel' },
        h('h3', {}, 'Thiết bị'),
        h('p', {}, canSpeak() ? 'Giọng đọc tiếng Anh: có.' : 'Không có giọng đọc. Hãy dùng Chrome hoặc Safari.'),
        h('p', {}, canListen() ? 'Nhận giọng nói (bài “Say it”): có.' : 'Trình duyệt này không nhận giọng nói nên bài “Say it” bị ẩn. Dùng Chrome để bật.'),
        reset,
        h('p', { class: 'credit' }, 'Hình minh họa: Fluent Emoji của Microsoft (giấy phép MIT).'),
      ),
    ),
    () => onInstallChange(null),
  );
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

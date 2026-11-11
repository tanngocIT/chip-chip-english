# CLAUDE.md — Chip Chip English

Ghi chú cho Claude (và người mới) khi bắt đầu một phiên làm việc với repo này. Đọc hết file này trước khi sửa code.

## Dự án là gì

App web (PWA) cho bé **2–6 tuổi** học tiếng Anh bằng hình hoạt hình và âm thanh. Chủ repo là một developer, làm trước hết **cho con mình học**, nên ưu tiên trải nghiệm của bé thật hơn là tính năng cho nhiều người dùng.

- Repo: https://github.com/tanngocIT/chip-chip-english
- Bản chạy thật: https://tanngocit.github.io/chip-chip-english/ (GitHub Pages, tự deploy khi push lên `main`)
- Thư mục trên máy chủ repo: `D:\products\chip-chip-english` (Windows)

## Cách làm việc với chủ repo

- **Trao đổi bằng tiếng Việt.** Nội dung cho bé là tiếng Anh, chữ trong phần bố mẹ là tiếng Việt.
- Chủ repo giao quyền tự làm: tự tìm resource, chạy, test. Nhưng **khi họ nói "khoan commit", hãy chờ** góp ý rồi mới commit.
- Commit message viết tiếng Việt, dòng đầu ngắn gọn, phần thân liệt kê thay đổi.
- Sau mỗi thay đổi đáng kể: chạy `npm test` và `npm run build`. Với thay đổi giao diện, chạy thêm `npm run shots` rồi xem ảnh trong `shots/`.
- Mỗi tính năng mới: cập nhật README (bảng trò chơi, bảng độ tuổi, phần bố mẹ) và file này nếu có quyết định mới.

## Lệnh

```bash
npm install
npm run dev        # http://localhost:5173, có --host để mở từ iPad/điện thoại cùng wifi
npm test           # vitest: src/lib/logic.test.ts
npm run build      # tsc + vite build -> dist/ (có service worker, chạy offline)
npm run shots      # cần build trước; Chrome headless tự chơi qua mọi màn và chụp ảnh vào shots/
                   # thêm tham số: node scripts/screenshots.mjs [phone|tablet] [small|middle|big]
                   # Windows: đặt biến CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Micro (bài Say it) chỉ chạy trên https hoặc localhost. Muốn thử trên iPad thì dùng bản GitHub Pages.

## Kiến trúc

Vanilla TypeScript + Vite, không dùng framework. Dựng DOM bằng hàm `h()` tự viết.

```
src/data/words.json     chủ đề + 334 từ (id, topic, vi, asset, cờ)
src/data/stickers.json  31 sticker thưởng (tên thư mục Fluent Emoji)
src/lib/content.ts      Word/Topic, dựng câu: nounPhrase (a/an/the), describe, question
src/lib/progress.ts     levelConfig theo tuổi, starsFor, Leitner (recordAnswer), pickTargets,
                        pickLearnSet, pickScene (Find it), pickReviewSet, pickTodayTopic, choicesFor, sticker, lưu localStorage, giới hạn phút/ngày
src/lib/match.ts        chấm phát âm dễ tính: bảng đồng âm SOUNDS_LIKE + Levenshtein
src/lib/voice.ts        say(): phát mp3 sinh sẵn, thiếu thì TTS (speechSynthesis); SpeechRecognition; ghi âm MediaRecorder + phát lại
src/lib/phrases.ts      danh sách mọi câu cần giọng + phraseKey (tên file); dùng cho script và test
src/lib/sfx.ts          hiệu ứng âm thanh và giai điệu Sing along bằng Web Audio (không có file âm thanh)
src/lib/install.ts      cài app: beforeinstallprompt (Android/desktop), nhận biết iOS và chế độ đã cài
src/lib/vi.ts           viết số bằng chữ tiếng Việt (cho cổng phụ huynh)
src/ui.ts               icon SVG, picture() (hình sticker; số = chữ số + N ngôi sao), stars, dots
src/screens/core.ts     trạng thái chung (app, P, screenId, session, inParentArea), show(), persist(), startActivity,
                        buổi học Play (startToday, nextStep, leave), announce, lessonBar
src/screens/home.ts     splash, home, holdButton, stickerBook, rest
src/screens/topic.ts    topicScreen (danh sách trò của một chủ đề)
src/screens/learn.ts    Look and listen
src/screens/quiz.ts     runQuiz dùng chung cho Listen and tap, Find the shadow và Review
src/screens/find.ts     Find it
src/screens/sing.ts     Sing along
src/screens/say.ts      Say it
src/screens/result.ts   result (theo chủ đề hoặc buổi học) và resultScreen
src/screens/parents.ts  parentGate, parentArea
src/main.ts             nạp CSS, bộ đếm phút chơi, gọi splash()
src/style.css           toàn bộ giao diện
scripts/copy-assets.mjs chép SVG từ checkout Fluent Emoji vào public/img (theo words.json + stickers.json)
scripts/make-icons.mjs  tạo icon-192/512 từ mascot
scripts/gen-voice.mjs   sinh public/voice/*.mp3 + manifest.json bằng Piper (gọi gen-voice.py)
scripts/screenshots.mjs chơi thử tự động bằng puppeteer-core (giả lập TTS, nhận giọng và micro)
.github/workflows/deploy.yml  test → build → deploy Pages
```

`screens/core.ts` có biến `screenId`. Mỗi lần `show()` sẽ tăng nó lên, và các bước async kiểm tra `alive(id)` để dừng khi bé đã sang màn khác. Mọi `await` dài trong một màn đều phải giữ cách làm này.

Các file trong `screens/` import vòng lẫn nhau (home → topic → trò chơi → result → home). Việc này chạy được vì chúng chỉ gọi hàm của nhau lúc bé thao tác, không gọi ở cấp cao nhất của file. Giữ nguyên tắc đó: code cấp cao nhất của một file màn hình chỉ được dùng `lib/` và `ui.ts`. Các biến `session`, `inParentArea`, `screenId` chỉ được gán trong `core.ts` (qua `endSession()`, `setInParentArea()`, `show()`); file khác chỉ đọc.

## Quyết định đã chốt (đừng đổi khi chưa hỏi)

**Ràng buộc chi phí: 0 đồng.** Mọi giải pháp phải miễn phí hoàn toàn, cả lúc làm lẫn lúc chạy. Không dùng dịch vụ trả phí hay cần thẻ thanh toán (kể cả gói free tier bắt buộc gắn thẻ), không backend phải trả tiền, không tài khoản nhà phát triển trả phí. Hosting hiện tại là GitHub Pages. Khi đề xuất giải pháp, kiểm tra điều này trước và ghi rõ nếu có chi phí ẩn.

**Ràng buộc công sức: AI làm 100%.** Chủ repo chỉ đưa ý tưởng và ý kiến, không làm việc tay nào: không tự tìm nguồn (hình, âm thanh, dữ liệu), không thu âm, không tải hay chuyển file thủ công. Giải pháp nào đòi chủ repo ghi âm, tìm tài nguyên hay thao tác thủ công thì loại. AI phải tự tìm nguồn, tự tạo nội dung, tự chạy và kiểm tra. Việc thật sự không tự động hoá được (ví dụ cần đăng nhập tài khoản của họ) thì nói rõ ngay từ lúc đề xuất.

**Nội dung**
- 13 chủ đề. Mỗi chủ đề 12–40 từ:

  | Chủ đề | Số từ |
  |---|---|
  | Con vật | 40 |
  | Đồ chơi & nhà | 40 |
  | Đồ ăn | 37 |
  | Rau củ quả | 36 |
  | Thiên nhiên | 36 |
  | Xe cộ | 34 |
  | Gia đình & nghề | 24 |
  | Số 1–20 | 20 |
  | Cơ thể | 16 |
  | Hành động | 15 |
  | Màu sắc | 12 |
  | Hình khối | 12 |
  | Cảm xúc | 12 |

  Màu, số và cơ thể ít từ hơn vì thiếu từ hoặc hình phù hợp.
- Ba chủ đề thêm sau (Hình khối, Cảm xúc, Hành động) đem lại loại từ mới ngoài danh từ:
  - **Hình khối:** 12 hình do AI tự vẽ bằng SVG phẳng, mỗi hình một màu (`public/img/shape-*.svg`, cờ `custom`), vì Fluent Emoji không có đủ (chữ nhật, bầu dục, xoắn ốc). `star-shape` và `heart-shape` đọc là "star", "heart" (cờ `word`) vì id `star`, `heart` đã dùng ở chủ đề khác.
  - **Cảm xúc** (`kind: "feeling"`): "I am happy." / "Who is happy?". Chủ đề có cờ `noShadow` nên ẩn Find the shadow (mặt nào cũng tròn, bóng giống nhau).
  - **Hành động** (`kind: "action"`): "I can run." / "Who can run?". Dùng "I can" để không phải chia động từ và không phụ thuộc giới tính nhân vật trong hình. Đã bỏ "write" (nghe gần giống "ride") và đổi "wave" (trùng id với sóng biển ở Thiên nhiên) thành "juggle".
- Hình lấy từ **Fluent Emoji Flat** (Microsoft, MIT). Người và tay chân dùng tông da **Medium-Light** (cờ `skin`).
- Viền trắng kiểu sticker cắt rời là dấu ấn thị giác chính. Nó được làm bằng nhiều lớp `drop-shadow` trắng trong CSS.
- Giọng đọc tiếng Anh dùng file mp3 sinh sẵn bằng Piper (giọng `en_US-kristin-medium`, public domain) trong `public/voice/`. Câu nào chưa có file thì rơi về TTS của trình duyệt. Tiếng Việt vẫn dùng TTS trình duyệt. Thêm từ mới thì chạy lại `node scripts/gen-voice.mjs <python> <model.onnx>` (chỉ sinh câu còn thiếu; cần piper-tts, soundfile, scipy, faster-whisper). Từ 1-2 chữ được sinh qua câu "Say, X." rồi cắt bỏ chữ "Say", vì đọc riêng từ đơn thì mô hình nuốt âm (cat nghe như tack); `npm test` sẽ báo nếu thiếu file.
- Cài Piper trên máy mới (miễn phí, đã làm được trên máy Windows có proxy công ty):
  1. `python -m venv .venv-voice` rồi `.venv-voice/Scripts/pip install piper-tts soundfile scipy faster-whisper`. Thư mục `.venv-voice` và `voice-model` đã nằm trong `.gitignore`.
  2. Tải `en_US-kristin-medium.onnx` và `.onnx.json` từ `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/` vào `voice-model/`.
  3. Nếu Python không tải được từ Hugging Face (lỗi chứng chỉ SSL do proxy), tải bằng Node (`fetch`) và tải luôn mô hình Whisper: 4 file `config.json`, `tokenizer.json`, `vocabulary.txt`, `model.bin` từ `https://huggingface.co/Systran/faster-whisper-small.en/resolve/main/` vào `voice-model/whisper-small.en/`, rồi đặt biến `WHISPER_MODEL` trỏ tới thư mục đó khi chạy `gen-voice.mjs`. Không tắt kiểm tra chứng chỉ.
  4. Mốc so sánh khi nghe lại: Whisper nghe lệch khoảng 29% số từ đơn của lô cũ (24/83, ví dụ pig → "PEGI", owl → "I'll"), nên một từ đơn lệch chưa chắc là file hỏng. Khi lệch, sinh lại vài bản (Piper mỗi lần ra hơi khác) với câu mồi "Say, X!" và chọn bản Whisper nghe đúng; walk, row, ride đã được thay theo cách này.
  5. Sau khi sinh, **dùng Whisper nghe lại từng file mới** và so với câu gốc. Câu 1–2 từ đi qua bước cắt chữ "Say" và có thể bị cắt lố: "Let's practice!" từng chỉ còn "practice". Gặp vậy thì đổi sang câu từ 3 từ trở lên (được đọc nguyên câu) hoặc đổi câu khác.

**Trò chơi** (mỗi chủ đề có 6 trò)
1. Look and listen (thẻ từ)
2. Listen and tap: hiện **chữ to của từ đang hỏi** để bé nhận mặt chữ; chạm vào chữ thì đọc chậm.
3. Find the shadow: chữ của từ chỉ hiện **sau khi bé ghép đúng**. Hiện trước thì bé biết đọc sẽ đọc chữ thay vì nhìn hình dáng.
4. Find it (tìm trong tranh): một tranh nhiều hình, nghe câu hỏi rồi tìm. Không hiện chữ. Hình đã tìm được thì mờ đi, hình sai chỉ lắc (không làm mờ, vì có thể là đáp án của câu sau). Ý tưởng ban đầu chỉ dành cho bé 5–6 tuổi, nhưng đã làm cho mọi tuổi với số hình tăng dần để màn chủ đề giống nhau ở mọi độ tuổi.
5. Say it: phát lại giọng bé rồi đọc giọng mẫu, có nút bong bóng để nghe lại.
6. Sing along: đọc theo nhịp trên giai điệu "Twinkle, twinkle" (dân gian, phạm vi công cộng) phát bằng Web Audio. Đây là đọc theo nhạc, không phải bài hát có giọng hát, vì chưa có cách miễn phí nào tạo giọng hát mà AI tự kiểm tra được chất lượng. Mỗi từ 4 ô nhịp (2 giây một ô): từ, từ, câu mô tả, nghỉ. Lời đọc quyết định nhịp: câu nào đọc lâu hơn một ô thì chờ đến vạch ô kế tiếp, nên tốc độ đọc chậm không bị cắt lời. Luôn được 3 sao, không có sticker (để bé không cày sticker bằng trò không cần làm gì).

**Màn hình chính** có thêm hai nút to phía trên các chủ đề:
- **Play** (buổi học một chạm, biến `session` trong `screens/core.ts`): chạy 4 trò liền nhau trong một chủ đề theo thứ tự cố định Look and listen → Listen and tap → Find it → Sing along. Không có Say it (cần xin quyền micro) và Find the shadow (để buổi học ngắn, khoảng 5 phút). Trong buổi học, màn kết quả chỉ có nút đi tiếp và các chấm tiến độ, không có nút chơi lại; nút Back đưa về màn hình chính. `pickTodayTopic` chọn chủ đề: đang học dở (nhiều từ đã gặp nhất) → chủ đề chưa mở kế tiếp → chủ đề thuộc ít nhất.
- **Review**: Listen and tap với từ lấy từ mọi chủ đề (`pickReviewSet`): chỉ từ đã gặp và chưa thuộc (hộp < 3), từ hay nhầm trước, mỗi từ một câu. Hình gây nhiễu lấy từ cùng chủ đề với từ đang hỏi để câu hỏi vẫn hợp lý. Nút chỉ hiện khi có ít nhất 4 từ (`REVIEW_MIN`). Có sao và sticker, nhưng sao không cộng vào chủ đề nào.
- Chạm Play thì Chip nói "Let's play!", chạm Review thì nói "Let's play again!", nói xong mới vào trò (`announce()` trong `screens/core.ts`, bỏ qua các lần chạm thừa trong lúc đang nói).

**Theo độ tuổi** (`levelConfig`)

| Tuổi | Hình/câu | Listen & Shadow | Say it | Look and listen | Find it (hình/câu tìm) | Sing along |
|---|---|---|---|---|---|---|
| 2–3 | 2 | 8 | 6 | 10 thẻ | 6 / 4 | 6 từ |
| 4–5 | 3 | 10 | 8 | 12 thẻ | 9 / 6 | 8 từ |
| 6 | 4 | 12 | 10 | 15 thẻ | 12 / 8 | 8 từ |

**Chấm điểm và chọn từ**
- Sao được tính theo tỉ lệ câu đúng ngay lần đầu: ≥85% được 3 sao, ≥50% được 2 sao, còn lại 1 sao. Bé luôn được ít nhất 1 sao.
- Từ 2 sao trở lên thì được sticker. Look and listen chỉ cho sticker ở lần học xong đầu tiên của chủ đề.
- Sai không trừ điểm và không dùng màu đỏ. Bài Say it chỉ cho tối đa 2 lần thử, sau đó khen "Good try!" rồi chuyển câu.
- Leitner có 5 hộp (0–4): đúng thì lên một hộp, sai thì về 0.
- `pickTargets` dùng trọng số: từ đã xem và hay sai được hỏi nhiều nhất, từ chưa xem có trọng số 0.4. Nhờ vậy trò chơi chủ yếu hỏi những gì Look and listen đã dạy. Không lặp một từ hai câu liền.
- `pickLearnSet` xếp từ hay nhầm lên trước, rồi đến từ chưa xem, rồi từ ít thuộc nhất; các từ cùng mức được xáo. Sing along cũng dùng hàm này.
- `pickScene` (Find it) chọn các từ cần tìm theo cùng trọng số với `pickTargets` nhưng không lặp, rồi thêm hình gây nhiễu ngẫu nhiên.

**Phần bố mẹ**
- Cách mở: giữ nút bánh răng 1,5 giây, rồi chạm đúng con số được viết bằng chữ tiếng Việt.
- Cài đặt gồm: độ tuổi, tốc độ đọc, nghĩa tiếng Việt, phát lại giọng bé (mặc định bật), giới hạn phút mỗi ngày (mặc định 20).
- Hết giờ không bao giờ cắt ngang một trò hay màn kết quả: bé chơi nốt, xem sao và sticker, bấm nút nào ở màn kết quả cũng chuyển sang màn nghỉ. Màn hình chính và màn chủ đề thì chuyển sang màn nghỉ ngay.
- Phần này còn có bảng tiến độ và nút xóa tiến độ.
- Mục "Cài app": có `beforeinstallprompt` thì hiện nút cài; trên iOS hiện các bước Chia sẻ → Thêm vào Màn hình chính; đã cài thì chỉ báo đã cài. Đặt trong phần bố mẹ để bé không bấm nhầm.

**Quyền riêng tư**
- Không có tài khoản và không có backend. Tiến độ lưu ở `localStorage` với key `be-hoc-tieng-anh:v1`.
- Tiếng ghi âm của bé chỉ nằm trong bộ nhớ trong lúc làm một câu, không lưu và không gửi đi.
- Không quảng cáo và không có link ra ngoài trong phần của bé.

## Thêm từ mới

1. Tìm tên thư mục hình trên https://github.com/microsoft/fluentui-emoji/tree/main/assets.
2. Thêm dòng vào `src/data/words.json`. Các cờ có thể dùng:

   | Cờ | Tác dụng |
   |---|---|
   | `plural` | "They're grapes." / "Where are the …?" |
   | `mass` | Không có mạo từ ("It's milk.") |
   | `the` | Dùng "the" ("the sun") |
   | `skin` | Dùng hình tông da Medium-Light |
   | `kind`: `"color"` | Câu kiểu màu sắc |
   | `kind`: `"number"` + `count` | Câu kiểu con số |
   | `kind`: `"person"` | Không có mạo từ ("This is mom.") |
   | `kind`: `"feeling"` | Tính từ cảm xúc ("I am happy." / "Who is happy?") |
   | `kind`: `"action"` | Động từ ("I can run." / "Who can run?") |
   | `custom` | Hình tự vẽ, đã nằm sẵn trong `public/img`; `copy-assets.mjs` bỏ qua |

   Chủ đề có thể đặt `"noShadow": true` để ẩn trò Find the shadow.
   | `word` | Khi từ đọc ra khác `id` (ví dụ `orange-color` đọc là "orange") |

3. Lấy hình về (nếu máy không clone được do proxy, tải từng file SVG qua `gh api repos/microsoft/fluentui-emoji/contents/assets/<tên>/Flat` rồi `fetch` bằng Node):
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/fluentui-emoji.git /tmp/fe
   cd /tmp/fe && git sparse-checkout set --no-cone '/assets/*/Flat/*' '/assets/*/Medium-Light/Flat/*' '/LICENSE'
   node scripts/copy-assets.mjs /tmp/fe
   ```
4. Tránh hai từ quá giống nhau trong cùng chủ đề, ví dụ "eye" và "eyes" (đã bỏ "eyes" vì lý do này). Với từ dễ nhận nhầm, thêm cách đọc gần giống vào `SOUNDS_LIKE` trong `match.ts`.
5. Chạy `npm test`. Test kiểm tra mọi từ đều có file hình, `id` không trùng, mỗi chủ đề có ít nhất 12 từ.

## Giới hạn đã biết

- Một số Android không cho ghi âm và nhận giọng nói cùng lúc. Khi gặp lỗi `audio-capture`, app tự tắt ghi âm (`markRecordingClash`).
- Bài Say it bị ẩn trên trình duyệt không có SpeechRecognition (ví dụ Firefox).
- Giọng tiếng Anh là mp3 nên giống nhau trên mọi máy. Giọng Việt (nếu bật) và câu chưa có mp3 vẫn phụ thuộc máy.
- File mp3 phát qua blob URL (không dùng Range request) vì Safari phát từ service worker dễ lỗi với Range.
- Cache offline thêm khoảng 8 MB cho giọng (1.028 file).
- Bản cài như app chạy offline, nên sau khi deploy có thể phải mở lại app một lần mới thấy bản mới.

## Ý tưởng tiếp theo (chưa làm)

- Giọng đọc đồng đều hơn bằng cách miễn phí (xem `IMPROVEMENTS.md`). Azure, ElevenLabs và Azure Pronunciation Assessment bị loại vì trái ràng buộc 0 đồng.
- Bài hát có giọng hát thật (hiện Sing along chỉ là đọc theo nhịp). Cần một cách miễn phí tạo giọng hát và cách tự kiểm tra chất lượng.
- Giọng tiếng Việt bằng mp3 sinh sẵn (Piper có giọng `vi_VN`), để mục "nghĩa tiếng Việt" chạy trên cả máy không có giọng Việt. Chưa làm vì cần kiểm tra giấy phép từng giọng và AI chưa có cách tự đánh giá giọng Việt nghe có tự nhiên không.
- Đóng gói thành app Android/iOS bằng Capacitor. Lưu ý: đưa lên App Store cần tài khoản Apple Developer trả phí và Google Play cần phí đăng ký một lần, nên trái ràng buộc 0 đồng. Cứ dùng PWA.

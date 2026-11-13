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
src/data/words.json     chủ đề + 358 từ (id, topic, vi, asset, cờ)
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
src/lib/update.ts       tự cập nhật: phát hiện bản mới, chuyển sang lúc an toàn (initUpdate, applyUpdate, BUILD_TIME)
src/lib/focus.ts        nextInDirection: nút gần nhất theo hướng phím mũi tên
src/lib/sentences.ts    bộ 96 câu ngắn (allSentences), chọn câu cho một ván (pickSentences), chọn hình đáp án (sentenceOptions)
src/lib/odd.ts          Odd one out: ODD_FROM (chủ đề nào lấy hình lạc loài từ chủ đề nào), pickOddRounds
src/lib/challenges.ts   105 thử thách ngoài màn hình (allChallenges), pickChallenge
src/lib/stories.ts      6 truyện tranh (stories), questionOptions, storyPhrases
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
src/screens/memory.ts   Memory (lật thẻ ghép đôi)
src/screens/sentences.ts  Sentences (câu ngắn, mở từ màn hình chính)
src/screens/odd.ts      Odd one out (cái nào khác loại)
src/screens/stories.ts  Stories: storyList, readStory (4 trang rồi 2 câu hỏi)
src/screens/challenge.ts  thử thách ngoài màn hình ở cuối buổi Play
src/screens/wordbook.ts Sổ từ của bé (wordBook, metCount)
src/screens/scene.ts    Tranh của bé: dán sticker lên nền (stickerScene)
src/screens/print.ts    in thẻ từ của một chủ đề (printCards), gọi từ phần bố mẹ
src/screens/result.ts   result (theo chủ đề hoặc buổi học) và resultScreen
src/screens/parents.ts  parentGate, parentArea
src/screens/keys.ts     điều khiển bằng bàn phím (initKeys), một trình nghe keydown chung cho mọi màn
src/main.ts             nạp CSS, bộ đếm phút chơi, gọi splash()
src/style.css           toàn bộ giao diện
scripts/copy-assets.mjs chép SVG từ checkout Fluent Emoji vào public/img (theo words.json + stickers.json)
scripts/art-prompts.mjs ghi art-inbox/PROMPTS.md: prompt vẽ hình cho các chủ đề chưa có hình riêng
scripts/cut-all-art.mjs cắt các tấm hình trong art-inbox/ (theo sheets.json) thành public/img/art/*.webp, gọi cut-art.py
scripts/make-icons.mjs  tạo icon-192/512 từ mascot
scripts/gen-voice.mjs   sinh public/voice/*.mp3 + manifest.json bằng Piper (gọi gen-voice.py)
scripts/fix-voice.py    Whisper nghe lại các file giọng, file lệch thì sinh lại cho tới khi nghe đúng
scripts/screenshots.mjs chơi thử tự động bằng puppeteer-core (giả lập TTS, nhận giọng và micro)
.github/workflows/deploy.yml  test → build → deploy Pages
```

`screens/core.ts` có biến `screenId`. Mỗi lần `show()` sẽ tăng nó lên, và các bước async kiểm tra `alive(id)` để dừng khi bé đã sang màn khác. Mọi `await` dài trong một màn đều phải giữ cách làm này.

Các file trong `screens/` import vòng lẫn nhau (home → topic → trò chơi → result → home). Việc này chạy được vì chúng chỉ gọi hàm của nhau lúc bé thao tác, không gọi ở cấp cao nhất của file. Giữ nguyên tắc đó: code cấp cao nhất của một file màn hình chỉ được dùng `lib/` và `ui.ts`. Các biến `session`, `inParentArea`, `screenId` chỉ được gán trong `core.ts` (qua `endSession()`, `setInParentArea()`, `show()`); file khác chỉ đọc.

## Quyết định đã chốt (đừng đổi khi chưa hỏi)

**Ràng buộc chi phí: 0 đồng.** Mọi giải pháp phải miễn phí hoàn toàn, cả lúc làm lẫn lúc chạy. Không dùng dịch vụ trả phí hay cần thẻ thanh toán (kể cả gói free tier bắt buộc gắn thẻ), không backend phải trả tiền, không tài khoản nhà phát triển trả phí. Hosting hiện tại là GitHub Pages. Khi đề xuất giải pháp, kiểm tra điều này trước và ghi rõ nếu có chi phí ẩn.

**Ràng buộc công sức: AI làm 100%.** Chủ repo chỉ đưa ý tưởng và ý kiến, không làm việc tay nào: không tự tìm nguồn (hình, âm thanh, dữ liệu), không thu âm, không tải hay chuyển file thủ công. Giải pháp nào đòi chủ repo ghi âm, tìm tài nguyên hay thao tác thủ công thì loại. AI phải tự tìm nguồn, tự tạo nội dung, tự chạy và kiểm tra. Việc thật sự không tự động hoá được (ví dụ cần đăng nhập tài khoản của họ) thì nói rõ ngay từ lúc đề xuất.

**Nội dung**
- 14 chủ đề. Mỗi chủ đề 12–40 từ:

  | Chủ đề | Số từ |
  |---|---|
  | Con vật | 40 |
  | Đồ chơi & nhà | 40 |
  | Đồ ăn | 37 |
  | Rau củ quả | 36 |
  | Thiên nhiên | 35 |
  | Xe cộ | 33 |
  | Chữ cái ABC | 26 |
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
- **Chữ cái ABC** (`kind: "letter"`, id `letter-a`…`letter-z`): mỗi chữ có từ đọc là tên chữ ("A"), trường `example` là từ minh họa và hình là hình của từ đó. "A is for apple." / "Find the letter A.". Hình vẽ là chữ hoa to, chữ thường nhỏ bên cạnh và hình minh họa bên dưới (`picture()` trong `ui.ts`).
  - Từ minh họa lấy trong vốn từ đã có, trừ Q ("queen", dùng hình công chúa) và X ("fox", vì không có từ thông dụng bắt đầu bằng x).
  - Thẻ từ ghi từ minh họa ("apple") dưới hình, không lặp lại chữ cái.
  - Listen and tap **không viết chữ đang hỏi** phía trên như các chủ đề khác, vì nếu viết thì bé chỉ cần so hình dáng chữ mà không cần nghe.
  - Find the shadow dùng dáng chữ (không có hình minh họa trong bóng).
  - Giọng: bộ phiên âm của mô hình đọc "A is…" thành mạo từ và chữ Z thành "zed" (kiểu Anh), nên `spoken()` trong `gen-voice.py` đổi "X is for" thành "X, is for" (có nhịp ngắt sau chữ cái, cũng giúp chữ cái không dính vào "is") và "Z" thành "Zee". Trước khi thêm kiểu câu mới có chữ cái đứng riêng, hãy xem `voice.phonemize()`.
  - Whisper luôn viết "zee" thành "see" (không có từ "zee"), nên file "Z" không tự kiểm tra được; phiên âm của nó là `zˈiː`. "R is for rabbit." cũng còn bị nghe lệch.
- **Hình phải tự nói lên nghĩa của từ.** Chủ repo đã báo "fog" có hình khó hiểu (vài vòng tròn xám), và AI đã xem lại toàn bộ hình bằng bảng hình theo chủ đề. Đã sửa: bỏ "fog" (không có hình sương mù nào rõ) và "lorry" (trùng nghĩa với "truck" trong cùng chủ đề); "seed" có hình cây con nên đổi thành "plant" với hình chậu cây; "hat" đổi từ hình mũ lưỡi trai sang hình mũ rộng vành (hình mũ lưỡi trai là món "cap" của Chip); "dad" đổi sang hình có râu vì trước đó giống hệt "brother". Khi thêm từ, hãy dựng bảng hình và xem: nếu không đoán được từ khi che chữ thì đổi hình hoặc bỏ từ.
- **Hình vẽ riêng bằng Gemini** (cờ `art`, file `public/img/art/<id>.webp`, 320 px, khoảng 13 KB mỗi hình): chủ repo thấy nhiều hình Fluent Emoji khó phân biệt (mom, sister, brother, dad gần như một khuôn mặt; train / tram / subway / fast train; run / walk). Chủ repo có tài khoản Gemini và tự nguyện dán prompt, tải hình về; đây là ngoại lệ do chủ repo đề nghị đối với ràng buộc "AI làm 100%", không phải tiền lệ để giao việc tay khác.
  - Đã thay trọn 10 chủ đề (288 hình): Gia đình & nghề, Xe cộ, Hành động, Cơ thể, Đồ ăn, Con vật, Rau củ quả, Thiên nhiên, Đồ chơi & nhà, Cảm xúc. Cảm xúc là cùng một bé trai với 12 nét mặt, để thứ duy nhất khác nhau là cảm xúc (chủ đề vẫn giữ `noShadow`). Sticker thưởng: 27/31 đã có hình vẽ riêng (`public/img/art/stickers/<id>.webp`, danh sách id trong `src/data/sticker-art.json`; `content.ts` dùng hình vẽ nếu id có trong danh sách, không thì dùng emoji). Còn 4 sticker (ferris wheel, sparkles, rocket, rainbow) và Chip cùng đồ của Chip có prompt sẵn. Id sticker không đổi, chỉ đổi hình. Màu sắc, Số, Hình khối giữ hình cũ vì là hình trừu tượng. Màu sắc, Số, Hình khối, Cảm xúc, Chữ cái giữ hình cũ.
  - **Chỉ thay khi đủ cả chủ đề**: các hình đứng cạnh nhau trong một câu hỏi phải cùng phong cách (có test). Chữ cái dùng hình của từ minh họa, theo bộ mà từ đó đang dùng (`pictureOf` trong `content.ts`).
  - Quy trình: `node scripts/art-prompts.mjs` ghi `art-inbox/PROMPTS.md` (mỗi prompt một tấm lưới 3×3, mô tả riêng cho các từ dễ nhầm trong bảng `HINT`); chủ repo lưu hình vào `art-inbox/` (không vào git); ghi tên file và danh sách từ theo thứ tự đọc vào `art-inbox/sheets.json`; `node scripts/cut-all-art.mjs <python>` cắt bằng `scripts/cut-art.py` (cần pillow, numpy, scipy; đã cài trong `.venv-voice`) rồi thêm `"art": true` vào từ trong `words.json`. Sau đó AI phải **xem bảng hình đã cắt** trước khi đưa vào app.
  - `cut-art.py`: nền là vùng cùng màu nối với mép tấm hình, nên vật màu xanh vẫn an toàn bên trong viền trắng của nó. Những điều đã gặp: Gemini luôn đóng dấu ngôi sao mờ ở góc dưới phải và đôi khi để lại bóng mờ của hình mẫu (đều là xanh trên xanh, được coi là nền); ô được bảo để trống thì nó chép hình từ ảnh mẫu vào (cắt theo thứ tự đọc và bỏ phần thừa; có lần chép cả mảng nền xanh lên tấm nền hồng, phải tô che phần đó rồi mới cắt, xem `animals-5-fixed.png`); bóng mờ của ảnh mẫu đủ to để bị tính là một hình và làm lệch thứ tự, nên script chỉ nhận mảng nào có viền trắng; một hình bị vẽ thành hai mảnh rời ("desert": mặt trời tách khỏi đồi cát) cũng làm lệch thứ tự, khi đó ghi tấm ấy trong `sheets.json` dạng `{ "ids": [...], "join": 60 }` để gộp các mảnh cách nhau dưới 60 px; nền bị kẹt bên trong hình (giữa nan hoa, dưới cánh tay) không có viền trắng nên phải khoét theo màu. Chủ đề nhiều vật màu xanh (con vật, rau củ quả, thiên nhiên) dùng nền hồng cánh sen.
  - Hình Fluent cũ của các từ đã có hình vẽ riêng đã bị xóa khỏi `public/img` (231 file, theo yêu cầu dọn dẹp của chủ repo), và `copy-assets.mjs` bỏ qua từ có cờ `art`. Còn giữ: hình của các chủ đề chưa thay, sticker, Chip, và icon trò chơi trong `topic.ts` (eye, ear, mouth, drum, puzzle-piece). Muốn quay một từ về hình Fluent thì bỏ cờ `art` rồi chạy lại `copy-assets.mjs`. Ảnh nguồn Gemini trong `art-inbox/` cũng đã xóa sau khi cắt; muốn cắt lại thì phải vẽ lại.
  - Chưa đọc kỹ điều khoản của Gemini về dùng hình trong app phát hành rộng; với app cho con dùng thì không sao. README có ghi nguồn.
- Hình còn lại (Màu sắc, ngôi sao của Số, sticker, Chip, icon trò chơi) lấy từ **Fluent Emoji Flat** (Microsoft, MIT). Người và tay chân dùng tông da **Medium-Light** (cờ `skin`).
- Viền trắng kiểu sticker cắt rời là dấu ấn thị giác chính. Nó được làm bằng nhiều lớp `drop-shadow` trắng trong CSS.
- Giọng đọc tiếng Anh dùng file mp3 sinh sẵn bằng Piper (giọng `en_US-kristin-medium`, public domain) trong `public/voice/`. Câu nào chưa có file thì rơi về TTS của trình duyệt. Tiếng Việt vẫn dùng TTS trình duyệt. Thêm từ mới thì chạy lại `node scripts/gen-voice.mjs <python> <model.onnx>` (chỉ sinh câu còn thiếu; cần piper-tts, soundfile, scipy, faster-whisper). Từ 1-2 chữ được sinh qua câu "Say, X." rồi cắt bỏ chữ "Say", vì đọc riêng từ đơn thì mô hình nuốt âm (cat nghe như tack); `npm test` sẽ báo nếu thiếu file.
- Cài Piper trên máy mới (miễn phí, đã làm được trên máy Windows có proxy công ty):
  1. `python -m venv .venv-voice` rồi `.venv-voice/Scripts/pip install piper-tts soundfile scipy faster-whisper`. Thư mục `.venv-voice` và `voice-model` đã nằm trong `.gitignore`.
  2. Tải `en_US-kristin-medium.onnx` và `.onnx.json` từ `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/` vào `voice-model/`.
  3. Nếu Python không tải được từ Hugging Face (lỗi chứng chỉ SSL do proxy), tải bằng Node (`fetch`) và tải luôn mô hình Whisper: 4 file `config.json`, `tokenizer.json`, `vocabulary.txt`, `model.bin` từ `https://huggingface.co/Systran/faster-whisper-small.en/resolve/main/` vào `voice-model/whisper-small.en/`, rồi đặt biến `WHISPER_MODEL` trỏ tới thư mục đó khi chạy `gen-voice.mjs`. Không tắt kiểm tra chứng chỉ.
  4. Mốc so sánh khi nghe lại: Whisper nghe lệch khoảng 29% số từ đơn của lô cũ (24/83, ví dụ pig → "PEGI", owl → "I'll"), nên một từ đơn lệch chưa chắc là file hỏng. Khi lệch, sinh lại vài bản (Piper mỗi lần ra hơi khác) với câu mồi "Say, X!" và chọn bản Whisper nghe đúng; walk, row, ride đã được thay theo cách này.
  5. Whisper hay nghe "the" trước nguyên âm thành "this/that" ("The apple is small." lệch qua 8 lần sinh lại) và "and a" thành "in a"; các lệch kiểu này không phải file hỏng. Tên ghép như "ladybug" sinh tốt hơn khi viết tách "Lady bug.".
  6. Lô giọng đầu tiên (trước khi có bước nghe lại) có file hỏng thật: chủ repo báo "rock" và "fog" đọc sai, Whisper nghe "rock" (dài 1,46 giây) thành một câu vô nghĩa. Vì vậy đã rà toàn bộ từ đơn bằng `scripts/fix-voice.py` (chạy với `words` hoặc `sentences`): Whisper nghe từng file, file lệch thì sinh lại tối đa 15 bản ("Say, X!", "Say, X.", "X.", "X!", "Say: X.") và giữ bản nghe đúng. File dài bất thường (trên khoảng 1,3 giây cho một từ) gần như chắc chắn hỏng.
  7. Kết quả lần rà toàn bộ (11/2026): từ đơn 361 file, 48 hỏng đã sinh lại, 12 còn lệch do đồng âm (ant/and, bee/b, eye/I, whale/wail, peas/peace, van/than, deer/tear, corn/con, croissant, trolleybus). Câu 770 file, 38 hỏng đã sinh lại (ví dụ "It's salt." chỉ còn "salt"), 16 còn lệch do đồng âm (pear/pair, pig/peg, panda/pander, "They're"/"their", "Find two"/"fine too").
  8. Lần rà này cũng lộ ra lỗi ngữ pháp: từ chỉ nghề dùng chung kiểu câu với "mom" nên thành "Where is scientist?". Đã tách `kind: "job"`. Khi Whisper nghe một câu thành thứ khác hẳn, hãy đọc lại chính câu đó trước khi cho là file hỏng.
  10. Lô 150 câu của thử thách và truyện (13/11/2026): Whisper nghe đúng 141, 8 file lệch đã sinh lại ("Touch your leg!" thành "touch a lad", "What does the monkey eat?" thành "…need?"), còn "The frog and the rain." bị nghe thành "in the rain" (kiểu lệch "and" → "in" đã biết). Cách rà chỉ các file mới: lập `voice-model/new-texts.json` (key → câu) cho các file mp3 git chưa theo dõi rồi chạy `fix-voice.py` với cả `sentences` lẫn `words`.
  9. Sau khi sinh, **dùng Whisper nghe lại từng file mới** và so với câu gốc. Câu 1–2 từ đi qua bước cắt chữ "Say" và có thể bị cắt lố: "Let's practice!" từng chỉ còn "practice". Gặp vậy thì đổi sang câu từ 3 từ trở lên (được đọc nguyên câu) hoặc đổi câu khác.

**Trò chơi** (mỗi chủ đề có 8 trò)
1. Look and listen (thẻ từ)
2. Listen and tap: hiện **chữ to của từ đang hỏi** để bé nhận mặt chữ; chạm vào chữ thì đọc chậm.
3. Find the shadow: chữ của từ chỉ hiện **sau khi bé ghép đúng**. Hiện trước thì bé biết đọc sẽ đọc chữ thay vì nhìn hình dáng.
4. Find it (tìm trong tranh): một tranh nhiều hình, nghe câu hỏi rồi tìm. Không hiện chữ. Hình đã tìm được thì mờ đi, hình sai chỉ lắc (không làm mờ, vì có thể là đáp án của câu sau). Ý tưởng ban đầu chỉ dành cho bé 5–6 tuổi, nhưng đã làm cho mọi tuổi với số hình tăng dần để màn chủ đề giống nhau ở mọi độ tuổi.
5. Say it: phát lại giọng bé rồi đọc giọng mẫu, có nút bong bóng để nghe lại.
6. Sing along: đọc theo nhịp trên giai điệu "Twinkle, twinkle" (dân gian, phạm vi công cộng) phát bằng Web Audio. Đây là đọc theo nhạc, không phải bài hát có giọng hát, vì chưa có cách miễn phí nào tạo giọng hát mà AI tự kiểm tra được chất lượng. Mỗi từ 4 ô nhịp (2 giây một ô): từ, từ, câu mô tả, nghỉ. Lời đọc quyết định nhịp: câu nào đọc lâu hơn một ô thì chờ đến vạch ô kế tiếp, nên tốc độ đọc chậm không bị cắt lời. Luôn được 3 sao, không có sticker (để bé không cày sticker bằng trò không cần làm gì).
7. Memory (lật thẻ ghép đôi): 3/4/6 cặp theo tuổi, chọn từ bằng `pickScene` (ưu tiên từ bé chưa thuộc). Mỗi thẻ lật lên đọc tên; hai thẻ khác nhau thì đọc tên rồi úp lại, không có tiếng "sai". Sao theo số lượt lật (`memoryStars`): tối đa 2 lượt mỗi cặp được 3 sao, tối đa 3 lượt được 2 sao. Trò này phần lớn là may rủi nên chỉ ghi `recordSeen`, không đổi hộp Leitner.
8. Odd one out (cái nào khác loại): 3 hình (2–3 tuổi) hoặc 4 hình, trong đó đúng một hình lấy từ chủ đề khác; câu hỏi luôn là "Which one is different?" (chỉ đọc ở câu đầu, sau đó bé tự nhìn; nút loa để nghe lại). Mục đích là bé phải hiểu nghĩa của từ. Chọn đúng thì đọc tên hình lạc loài.
   - `ODD_FROM` trong `lib/odd.ts` ghi rõ mỗi chủ đề được lấy hình lạc loài từ chủ đề nào. Chỉ ghép các cặp khác nhau rõ ràng: Đồ ăn không ghép với Rau củ quả (đều ăn được), Thiên nhiên không ghép với Con vật (có ong, bướm), Hành động không ghép với Xe cộ ("row" có hình thuyền). Chữ cái và Số ghép với nhau có chủ ý. Thêm chủ đề mới thì phải thêm dòng vào bảng này (test sẽ báo).
   - Bỏ hẳn các hình nằm giữa hai nhóm (`SKIP`: teddy bear, robot, chicken leg).
   - Không ghi vào Leitner (trò này không hỏi một từ cụ thể). Có sao theo chủ đề và sticker như các trò khác.

**Album sticker:** sticker bé đã có hiện tên tiếng Anh và đọc tên khi chạm; màn kết quả cũng đọc tên sticker mới. Tên lấy từ `STICKER_NAMES` trong `content.ts` khi tên thư mục hình không phải từ của bé ("Spouting whale" → "whale", "Hibiscus" → "flower"). **Không đổi id sticker** (suy ra từ tên thư mục), vì id nằm trong tiến độ đã lưu của bé.

**Màn hình chính** có thêm bốn nút phía trên các chủ đề:
- **Play** (buổi học một chạm, biến `session` trong `screens/core.ts`): chạy 4 trò liền nhau trong một chủ đề theo thứ tự cố định Look and listen → Listen and tap → Find it → Sing along. Không có Say it (cần xin quyền micro) và Find the shadow (để buổi học ngắn, khoảng 5 phút). Trong buổi học, màn kết quả chỉ có nút đi tiếp và các chấm tiến độ, không có nút chơi lại; nút Back đưa về màn hình chính. `pickTodayTopic` chọn chủ đề: đang học dở (nhiều từ đã gặp nhất) → chủ đề chưa mở kế tiếp → chủ đề thuộc ít nhất.
- **Review**: Listen and tap với từ lấy từ mọi chủ đề (`pickReviewSet`): chỉ từ đã gặp và chưa thuộc (hộp < 3), từ hay nhầm trước, mỗi từ một câu. Hình gây nhiễu lấy từ cùng chủ đề với từ đang hỏi để câu hỏi vẫn hợp lý. Nút chỉ hiện khi có ít nhất 4 từ (`REVIEW_MIN`). Có sao và sticker, nhưng sao không cộng vào chủ đề nào.
- **Sentences** (câu ngắn, ý tưởng ban đầu là cho bé 5–6 tuổi): chỉ hiện ở nhóm 4–5 và 6 tuổi (`sentenceRounds` > 0). Bé nghe và đọc một câu rồi chạm hình đúng. Ba kiểu câu, chọn vì vẽ được bằng hình sẵn có: số lượng ("I see three cats.", vẽ 3 con mèo), hai vật ("I see a cat and a dog."), kích thước ("The dog is big.", vẽ hình to hoặc nhỏ). Bộ câu **cố định 96 câu** từ 12 danh từ (`SENTENCE_NOUNS`: số nhiều chỉ thêm "s", hình rõ khi vẽ nhỏ), vì mỗi câu cần một file mp3; thêm danh từ hay kiểu câu thì phải sinh giọng. `sentenceOptions` luôn đưa một hình sai cùng vật nhưng khác số lượng/kích thước, và (khi có 3 hình) một hình khác vật, để bé phải hiểu cả câu chứ không chỉ danh từ. Có sao và sticker, không ghi vào Leitner.
- **Stories** (truyện tranh ngắn): hiện cùng điều kiện với Sentences (`sentenceRounds` > 0). 6 truyện cố định trong `lib/stories.ts`, mỗi truyện 4 trang (một câu + 1–2 hình sẵn có đặt cạnh nhau) rồi 2 câu hỏi về nội dung, đáp án là hình (2 hoặc 3 hình theo `sentenceChoices`). Câu chuyện được viết quanh những gì bộ hình vẽ được (con vật + khuôn mặt cảm xúc, con vật + đồ vật), vì AI không tự vẽ được nhân vật. Sao theo số câu hỏi đúng ngay lần đầu; sticker chỉ ở lần đầu đọc xong mỗi truyện (`P.stories`), để bé đọc lại vì truyện chứ không để cày sticker. Tên truyện có từ 3 từ trở lên để file giọng được đọc nguyên câu. Thêm truyện thì phải sinh giọng (7 câu mỗi truyện).
- **Thử thách ngoài màn hình** (`lib/challenges.ts`, `screens/challenge.ts`): sau trò cuối của buổi Play, Chip nói "Now it is your turn!" rồi giao một việc làm ngoài đời bằng từ của chủ đề đó; bé bấm dấu tích khi xong (không kiểm tra, tin bé và bố mẹ), rồi về màn hình chính. Mục đích: biến từ vừa học thành việc làm thật và kết thúc buổi học bằng việc rời màn hình. `pickChallenge` ưu tiên thử thách có từ bé đã gặp và không lặp lại thử thách vừa giao. Chủ đề có từ làm được thì sinh từ từ (màu: "Find something red!", cơ thể: "Touch your nose!", số: "Show me three fingers!", con vật: "What does the cow say?"…); chủ đề không làm được (đồ ăn, xe cộ, thiên nhiên, gia đình, ABC, rau củ quả) có vài câu chung. Dòng tiếng Việt dưới câu tiếng Anh là cho bố mẹ, ngoại lệ có chủ ý của quy tắc "phần của bé chỉ có tiếng Anh". Tắt được trong phần bố mẹ (`settings.challenges`). Chỉ có ở buổi Play, không có sau từng trò lẻ.
- Chạm Play thì Chip nói "Let's play!", chạm Review thì nói "Let's play again!", nói xong mới vào trò (`announce()` trong `screens/core.ts`, bỏ qua các lần chạm thừa trong lúc đang nói).

**Theo độ tuổi** (`levelConfig`)

| Tuổi | Hình/câu | Listen & Shadow | Say it | Look and listen | Find it (hình/câu tìm) | Sing along | Memory | Sentences (câu / hình) | Odd one out (câu / hình) | Stories |
|---|---|---|---|---|---|---|---|---|---|---|
| 2–3 | 2 | 8 | 6 | 10 thẻ | 6 / 4 | 6 từ | 3 cặp | không có | 6 / 3 | không có |
| 4–5 | 3 | 10 | 8 | 12 thẻ | 9 / 6 | 8 từ | 4 cặp | 6 / 2 | 8 / 4 | câu hỏi 2 hình |
| 6 | 4 | 12 | 10 | 15 thẻ | 12 / 8 | 8 từ | 6 cặp | 8 / 3 | 10 / 4 | câu hỏi 3 hình |

**Chấm điểm và chọn từ**
- Sao được tính theo tỉ lệ câu đúng ngay lần đầu: ≥85% được 3 sao, ≥50% được 2 sao, còn lại 1 sao. Bé luôn được ít nhất 1 sao.
- Từ 2 sao trở lên thì được sticker. Look and listen chỉ cho sticker ở lần học xong đầu tiên của chủ đề.
- **Đúng thì chỉ phát tiếng "ting" (`sfx.right()`), không đọc lời khen** ("Yes!", "Great!"…). Chủ repo góp ý lời khen sau mỗi câu là thừa và làm chậm nhịp chơi. Sau câu đúng app chỉ đọc lại từ vừa chọn (để bé nghe từ gắn với hình); bài Sentences thì không đọc lại gì. Lời nói ở màn kết quả cuối ván ("Great job!") vẫn giữ. Đừng thêm lại lời khen vào trò mới.
- Sai không trừ điểm và không dùng màu đỏ. Bài Say it chỉ cho tối đa 2 lần thử, sau đó khen "Good try!" rồi chuyển câu.
- Leitner có 5 hộp (0–4): đúng thì lên một hộp, sai thì về 0.
- **Ôn tập theo thời gian:** mỗi lần trả lời đặt ngày hẹn `due` cho từ, theo hộp nó rơi vào: `INTERVAL_DAYS = [0, 1, 3, 7, 14]`. Từ đã thuộc (hộp ≥ 3) chưa tới hẹn thì gần như không bị hỏi (`weightOf` = 0.3), tới hẹn thì được ưu tiên. `pickReviewSet` lấy từ chưa thuộc và từ đã thuộc nhưng tới hẹn; thứ tự: từ vừa nhầm, từ đã thuộc tới hẹn, rồi từ ít thuộc nhất. Tiến độ lưu từ trước khi có tính năng này không có `due`, và được coi là tới hẹn.
- `pickTargets` dùng trọng số: từ đã xem và hay sai được hỏi nhiều nhất, từ chưa xem có trọng số 0.4. Nhờ vậy trò chơi chủ yếu hỏi những gì Look and listen đã dạy. Không lặp một từ hai câu liền.
- `pickLearnSet` xếp từ hay nhầm lên trước, rồi đến từ chưa xem, rồi từ ít thuộc nhất; các từ cùng mức được xáo. Sing along cũng dùng hàm này.
- `pickScene` (Find it) chọn các từ cần tìm theo cùng trọng số với `pickTargets` nhưng không lặp, rồi thêm hình gây nhiễu ngẫu nhiên.

**Chuyển động**
- Nguyên tắc: chuyển động là phản hồi cho việc bé làm (chạm, trả lời đúng, xong ván). Lúc app đang hỏi thì màn hình đứng yên để bé nhìn hình và nghe từ; không làm nền chuyển động liên tục.
- Trả lời đúng: Chip nhảy lên từ mép dưới bên phải rồi tụt xuống (`chipCheer()` trong `ui.ts`, khoảng 1 giây, không nhận chạm).
- Màn kết quả: 3 sao thì có mưa confetti (`confettiRain`). Sticker mới nằm trong hộp quà (`public/img/gift.svg`, Fluent Emoji "Wrapped gift"); bé chạm để mở, không chạm thì tự mở sau khoảng 2 giây để bé nhỏ không bị kẹt.
- Thẻ từ: hình tự cử động một lần sau khi hiện và mỗi lần bé chạm, mỗi chủ đề một kiểu (`REACTIONS` trong `learn.ts`: con vật nhảy, xe chạy đi rồi về, quả lăn, hình khối xoay…).
- Màn hình chính: các ô chủ đề hiện lần lượt; tổng số sao đếm lên từng nấc khi bé vừa được thêm sao.
- Chuyển màn: màn mới mờ dần và trượt lên, nhưng chỉ khi loại màn đổi (so `className`), nên giữa hai câu của cùng một trò không bị nháy.
- Mọi hiệu ứng tắt khi máy bật `prefers-reduced-motion`.
- `.chip-peek` phải là `position: fixed`. Quy tắc `.chip.chip-peek` nằm sau `.chip { position: relative }` trong `style.css`; nếu bị đè, Chip nhảy lên sẽ chen vào bố cục và làm trang dài ra (đã từng xảy ra).

**Có gì để bé mong chờ**
- **Chuỗi ngày học** (`P.streak`, `markDay`, `currentStreak` trong `progress.ts`): tăng 1 khi bé chơi xong trò đầu tiên trong ngày (gọi ở `resultScreen`). Hôm nay chưa chơi thì chuỗi vẫn hiện số của hôm qua; bỏ trọn một ngày thì về 0. Chỉ hiện ở màn hình chính, không có thông báo nhắc và không phạt khi đứt chuỗi.
- **Sổ từ của bé** (`screens/wordbook.ts`, nút quyển sách cạnh nút album, kèm số từ đã gặp): mọi từ có `seen > 0`, xếp theo chủ đề; từ đã thuộc (hộp ≥ 3) có ngôi sao, từ chưa gặp là ô "?" giữ chỗ (như ô trống trong album), chủ đề chưa học chỉ là một dòng. Chạm thì đọc từ. Không có trò chơi hay điểm ở đây.
- **Tranh của bé** (`screens/scene.ts`, nút khung tranh trong album sticker, chỉ hiện khi có ít nhất 1 sticker): chơi tự do, không điểm, không thưởng. Chạm sticker trong khay để dán vào chỗ ngẫu nhiên, hoặc kéo ra khỏi khay để dán đúng chỗ thả; kéo để di chuyển; thả ra ngoài tranh để gỡ (không có nút xóa hết, tránh bé lỡ tay); chạm sticker trên tranh thì đọc tên. 3 nền vẽ bằng CSS gradient (không thêm file). Lưu trong `P.scene` (tối đa `SCENE_MAX` = 30 miếng, tọa độ phần trăm) và `P.sceneBg`. Hàm `drag()` giữ con trỏ (`setPointerCapture`) ngay từ `pointerdown`: nếu chờ tới khi đã kéo quá ngưỡng thì chuột vẩy nhanh sẽ rời khỏi ô sticker nhỏ trước khi kịp bắt. Vị trí dùng thuộc tính `translate` chứ không dùng `transform`, vì các hiệu ứng `pop-in`, `wiggle` ghi đè `transform`. Hết giờ chơi thì màn này chuyển sang màn nghỉ ngay (không có màn kết quả để chờ).
- **Đồ cho Chip** (`LOOKS` trong `progress.ts`): nơ 3 sticker, mũ lưỡi trai 7, kính 12, mũ cao 18, vương miện 25 (album có 31). Bé chọn ở đầu album sticker; chạm món đang mặc thì cởi ra. `P.look` lưu món đang mặc, `P.looksSeen` để biết khi nào hiện chấm "có món mới" trên nút album. Mọi chỗ vẽ Chip đều đi qua `chip()` trong `ui.ts` (màn chào, màn hình chính, kết quả, Chip nhảy lên, lưng thẻ Memory), nên món đồ hiện ở khắp nơi; đổi `P.look` thì phải gọi `setChipLook`. Vị trí từng món là phần trăm theo bề rộng Chip, nằm trong `style.css` (`.look-*`). Hình lấy từ Fluent Emoji (`public/img/look-*.svg`).

**Bàn phím** (`screens/keys.ts`)
- Phím số 1–9 bấm phần tử thứ N của nhóm đầu tiên có mặt trên màn, theo thứ tự trong `NUMBERED`: `.option`, `.spot`, `.flip`, `.activity`, `.numpad button`, `.topic`, `.tray-item`. Trò mới có lưới đáp án thì dùng lại một trong các class này, hoặc thêm class của nó vào `NUMBERED` và vào phần CSS `.keys …` để có số gợi ý.
- Enter (khi chưa có nút nào đang được chọn) bấm nút chính theo thứ tự `.play-big`, `.gift`, `.pager .go`, `.mic`, `.quick.today`. Phím cách bấm nút nghe lại. Esc bấm nút đầu tiên của `.bar`. ← → lật thẻ từ và chọn ở màn kết quả; ở màn khác bốn phím mũi tên di chuyển focus (`nextInDirection`).
- Số gợi ý vẽ bằng CSS counter, chỉ hiện khi `body` có class `keys`. Class này bật khi có phím được bấm và tắt khi có `pointerdown`, nên người dùng cảm ứng không bao giờ thấy.
- Khi đang gõ trong ô nhập (phần bố mẹ) thì chỉ Esc còn tác dụng.

**Kích thước màn hình**
- Mọi trò phải vừa một màn hình, không cuộn, kể cả cửa sổ rộng mà thấp (trình duyệt máy tính thu nhỏ, điện thoại xoay ngang). Kích thước hình, chữ và nút trong trò chơi tính theo cả bề rộng lẫn chiều cao: `min(…vw, …dvh)`. Đừng thêm kích thước chỉ theo `vw`.
- Chỉ các màn danh sách (màn hình chính, danh sách trò của chủ đề, album, phần bố mẹ) được cuộn.
- Đã đo ở 1411×628, 1024×520, 1280×720, 844×390, 390×844, 1024×768 với nhóm 2–3 và 6 tuổi: mọi trò và màn kết quả đều vừa.

**Phần bố mẹ**
- Cách mở: giữ nút bánh răng 1,5 giây, rồi chạm đúng con số được viết bằng chữ tiếng Việt.
- Cài đặt gồm: độ tuổi, tốc độ đọc, nghĩa tiếng Việt, phát lại giọng bé (mặc định bật), thử thách ngoài màn hình (mặc định bật), giới hạn phút mỗi ngày (mặc định 20).
- **In thẻ từ** (`screens/print.ts`): chọn chủ đề, bấm in. Tờ in là một khối `.print-sheet` nằm ngoài `#app`, ẩn trên màn hình và chỉ hiện trong `@media print` (lúc đó `#app` ẩn); mỗi trang 9 thẻ (3×3, hàng cao 84 mm để vừa cả A4 lẫn Letter), viền nét đứt để cắt, có hình, từ và nghĩa tiếng Việt. Chờ mọi hình `decode()` xong mới gọi `window.print()`, gỡ khối khi có `afterprint`. Không tạo file PDF trong app: hộp thoại in của trình duyệt đã có "Lưu thành PDF", miễn phí và không cần thư viện.
- Hết giờ không bao giờ cắt ngang một trò hay màn kết quả: bé chơi nốt, xem sao và sticker, bấm nút nào ở màn kết quả cũng chuyển sang màn nghỉ. Màn hình chính và màn chủ đề thì chuyển sang màn nghỉ ngay.
- Phần này còn có bảng tiến độ và nút xóa tiến độ.
- **7 ngày qua** (`weekReport`): `P.days` ghi mỗi ngày số phút, số trò xong, số câu đúng/sai ngay lần đầu và các từ vừa thuộc (lên hộp 3); giữ khoảng 35 ngày. Biểu đồ cột chỉ có một chuỗi số liệu nên dùng một màu (`--leaf-deep`, đã kiểm tra độ tương phản với nền trắng), không có chú giải; số phút ghi ngay trên cột vì màn cảm ứng không có hover.
- **Tự cập nhật** (`lib/update.ts`, `registerType: 'prompt'` trong `vite.config.ts`): app kiểm tra bản mới khi được mở lại và mỗi 30 phút. Có bản mới thì chỉ chuyển sang (nạp lại trang) khi app bị ẩn hoặc đang ở màn chào; không bao giờ nạp lại giữa trò chơi. Trang chưa được service worker quản lý (lần mở đầu tiên) không nhận tín hiệu nạp lại, nên `applyUpdate` tự nạp lại sau 3 giây. Đừng đổi về `autoUpdate`: nó nạp lại trang ngay khi có bản mới, kể cả lúc bé đang chơi.
- **Sao lưu tiến độ** (`exportCode` / `importCode`): một đoạn mã `CHIP1:` + base64 của JSON gọn (từ, sao, sticker, cài đặt, chuỗi ngày, đồ của Chip, truyện đã đọc, tranh của bé; không gồm số phút hôm nay). Chọn dạng mã để chép và dán vì chạy được trên mọi trình duyệt, kể cả bản đã cài trên iOS, và không cần máy chủ. `importCode` không tin dữ liệu bên trong: giá trị lạ bị bỏ hoặc kẹp về khoảng hợp lệ, mã sai trả về null. Thêm trường mới vào `Progress` thì thêm vào cả hai hàm này và test.
- Mục "Cài app": có `beforeinstallprompt` thì hiện nút cài; trên iOS hiện các bước Chia sẻ → Thêm vào Màn hình chính; đã cài thì chỉ báo đã cài. Đặt trong phần bố mẹ để bé không bấm nhầm.

**Quyền riêng tư**
- Không có tài khoản và không có backend. Tiến độ lưu ở `localStorage` với key `be-hoc-tieng-anh:v1`. Mã sao lưu chỉ được chép và dán bằng tay, app không gửi nó đi đâu.
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
   | `kind`: `"person"` | Tên gọi người thân, không có mạo từ ("This is mom." / "Where is mom?") |
   | `kind`: `"job"` | Nghề và vai (doctor, baby, prince…): có mạo từ ("This is a doctor." / "Where is the doctor?") |
   | `kind`: `"feeling"` | Tính từ cảm xúc ("I am happy." / "Who is happy?") |
   | `kind`: `"action"` | Động từ ("I can run." / "Who can run?") |
   | `kind`: `"letter"` + `example` | Chữ cái ("A is for apple." / "Find the letter A."); `asset` là hình của từ minh họa |
   | `custom` | Hình tự vẽ, đã nằm sẵn trong `public/img`; `copy-assets.mjs` bỏ qua |
   | `art` | Hình vẽ riêng: dùng `public/img/art/<id>.webp` thay cho emoji trong `asset` |

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
- Cache offline thêm khoảng 12 MB cho giọng (1.358 file).
- Tranh của bé chưa dùng được bằng bàn phím ngoài việc dán (phím số) và quay lại (Esc): di chuyển và gỡ sticker cần chuột hoặc ngón tay.
- In thẻ từ phụ thuộc hộp thoại in của trình duyệt; mới kiểm tra bằng Chrome (xuất PDF A4), chưa in thử trên iOS.
- Sau khi deploy, app tự chuyển sang bản mới ở lần bị ẩn hoặc lần mở kế tiếp. Máy còn giữ bản rất cũ (trước 13/11/2026, khi chưa có `update.ts`) thì phải đóng hẳn rồi mở lại một lần.

## Ý tưởng tiếp theo (chưa làm)

- Giọng đọc đồng đều hơn bằng cách miễn phí (xem `IMPROVEMENTS.md`). Azure, ElevenLabs và Azure Pronunciation Assessment bị loại vì trái ràng buộc 0 đồng.
- Bài hát có giọng hát thật (hiện Sing along chỉ là đọc theo nhịp). Cần một cách miễn phí tạo giọng hát và cách tự kiểm tra chất lượng.
- Giọng tiếng Việt bằng mp3 sinh sẵn (Piper có giọng `vi_VN`), để mục "nghĩa tiếng Việt" chạy trên cả máy không có giọng Việt. Chưa làm vì cần kiểm tra giấy phép từng giọng và AI chưa có cách tự đánh giá giọng Việt nghe có tự nhiên không.
- Đóng gói thành app Android/iOS bằng Capacitor. Lưu ý: đưa lên App Store cần tài khoản Apple Developer trả phí và Google Play cần phí đăng ký một lần, nên trái ràng buộc 0 đồng. Cứ dùng PWA.

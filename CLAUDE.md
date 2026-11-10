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
                   # Windows: đặt biến CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

Micro (bài Say it) chỉ chạy trên https hoặc localhost. Muốn thử trên iPad thì dùng bản GitHub Pages.

## Kiến trúc

Vanilla TypeScript + Vite, không dùng framework. Dựng DOM bằng hàm `h()` tự viết.

```
src/data/words.json     chủ đề + 295 từ (id, topic, vi, asset, cờ)
src/data/stickers.json  31 sticker thưởng (tên thư mục Fluent Emoji)
src/lib/content.ts      Word/Topic, dựng câu: nounPhrase (a/an/the), describe, question
src/lib/progress.ts     levelConfig theo tuổi, starsFor, Leitner (recordAnswer), pickTargets,
                        pickLearnSet, choicesFor, sticker, lưu localStorage, giới hạn phút/ngày
src/lib/match.ts        chấm phát âm dễ tính: bảng đồng âm SOUNDS_LIKE + Levenshtein
src/lib/voice.ts        TTS (speechSynthesis), SpeechRecognition, ghi âm MediaRecorder + phát lại
src/lib/sfx.ts          hiệu ứng âm thanh bằng Web Audio (không có file âm thanh)
src/lib/vi.ts           viết số bằng chữ tiếng Việt (cho cổng phụ huynh)
src/ui.ts               icon SVG, picture() (hình sticker; số = chữ số + N ngôi sao), stars, dots
src/main.ts             tất cả màn hình: splash, home, topic, learn, quiz (listen/match), sayIt,
                        result, stickerBook, rest, parentGate, parentArea
src/style.css           toàn bộ giao diện
scripts/copy-assets.mjs chép SVG từ checkout Fluent Emoji vào public/img (theo words.json + stickers.json)
scripts/make-icons.mjs  tạo icon-192/512 từ mascot
scripts/screenshots.mjs chơi thử tự động bằng puppeteer-core (giả lập TTS, nhận giọng và micro)
.github/workflows/deploy.yml  test → build → deploy Pages
```

`main.ts` có biến `screenId`. Mỗi lần `show()` sẽ tăng nó lên, và các bước async kiểm tra `alive(id)` để dừng khi bé đã sang màn khác. Mọi `await` dài trong một màn đều phải giữ cách làm này.

## Quyết định đã chốt (đừng đổi khi chưa hỏi)

**Nội dung**
- 10 chủ đề. Mỗi chủ đề 12–40 từ:

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
  | Màu sắc | 12 |

  Màu, số và cơ thể ít từ hơn vì thiếu từ hoặc hình phù hợp.
- Hình lấy từ **Fluent Emoji Flat** (Microsoft, MIT). Người và tay chân dùng tông da **Medium-Light** (cờ `skin`).
- Viền trắng kiểu sticker cắt rời là dấu ấn thị giác chính. Nó được làm bằng nhiều lớp `drop-shadow` trắng trong CSS.
- Giọng đọc dùng TTS của trình duyệt (miễn phí, offline). Chưa dùng file MP3.

**Trò chơi** (mỗi chủ đề có 4 trò)
1. Look and listen (thẻ từ)
2. Listen and tap: hiện **chữ to của từ đang hỏi** để bé nhận mặt chữ; chạm vào chữ thì đọc chậm.
3. Find the shadow
4. Say it: phát lại giọng bé rồi đọc giọng mẫu, có nút bong bóng để nghe lại.

**Theo độ tuổi** (`levelConfig`)

| Tuổi | Hình/câu | Listen & Shadow | Say it | Look and listen |
|---|---|---|---|---|
| 2–3 | 2 | 8 | 6 | 10 thẻ |
| 4–5 | 3 | 10 | 8 | 12 thẻ |
| 6 | 4 | 12 | 10 | 15 thẻ |

**Chấm điểm và chọn từ**
- Sao được tính theo tỉ lệ câu đúng ngay lần đầu: ≥85% được 3 sao, ≥50% được 2 sao, còn lại 1 sao. Bé luôn được ít nhất 1 sao.
- Từ 2 sao trở lên thì được sticker. Look and listen chỉ cho sticker ở lần học xong đầu tiên của chủ đề.
- Sai không trừ điểm và không dùng màu đỏ. Bài Say it chỉ cho tối đa 2 lần thử, sau đó khen "Good try!" rồi chuyển câu.
- Leitner có 5 hộp (0–4): đúng thì lên một hộp, sai thì về 0.
- `pickTargets` dùng trọng số: từ đã xem và hay sai được hỏi nhiều nhất, từ chưa xem có trọng số 0.4. Nhờ vậy trò chơi chủ yếu hỏi những gì Look and listen đã dạy. Không lặp một từ hai câu liền.
- `pickLearnSet` xếp từ hay nhầm lên trước, rồi đến từ chưa xem, rồi từ ít thuộc nhất; các từ cùng mức được xáo.

**Phần bố mẹ**
- Cách mở: giữ nút ổ khóa 1,5 giây, rồi chạm đúng con số được viết bằng chữ tiếng Việt.
- Cài đặt gồm: độ tuổi, tốc độ đọc, nghĩa tiếng Việt, phát lại giọng bé (mặc định bật), giới hạn phút mỗi ngày (mặc định 20).
- Phần này còn có bảng tiến độ và nút xóa tiến độ.

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
   | `word` | Khi từ đọc ra khác `id` (ví dụ `orange-color` đọc là "orange") |

3. Lấy hình về:
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
- Chất lượng giọng đọc phụ thuộc máy. Tốt nhất là "Google US English" (Chrome) hoặc Samantha (iOS).
- Bản cài như app chạy offline, nên sau khi deploy có thể phải mở lại app một lần mới thấy bản mới.

## Ý tưởng tiếp theo (chưa làm)

- Thay TTS bằng MP3 tạo sẵn (Azure Neural TTS hoặc ElevenLabs) cho giọng đồng đều.
- Chấm phát âm kỹ hơn bằng Azure Pronunciation Assessment.
- Thêm trò "Find it in the picture" cho bé 5–6 tuổi, và bài hát ngắn.
- Hiện chữ dưới cái bóng ở bài Find the shadow (đã hỏi chủ repo, chưa có câu trả lời).
- Đóng gói thành app Android/iOS bằng Capacitor.

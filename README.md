# Chip Chip English 🐥

App web (PWA) cho bé **2–6 tuổi** học tiếng Anh bằng **hình hoạt hình** và **âm thanh**. Bé không cần biết đọc: mọi hướng dẫn đều bằng giọng nói, mỗi màn hình chỉ có vài hình to, màu dịu mắt, không quảng cáo, không link ra ngoài.

Chạy được trên iPad, tablet Android, điện thoại và máy tính. Có thể "Thêm vào màn hình chính" để mở toàn màn hình như app và chơi **offline**.

## Bé học được gì

**10 chủ đề, 295 từ:**

| Chủ đề | Số từ |
|---|---|
| Con vật | 40 |
| Đồ chơi & đồ trong nhà | 40 |
| Đồ ăn | 37 |
| Rau củ quả | 36 |
| Thiên nhiên | 36 |
| Xe cộ | 34 |
| Gia đình & nghề | 24 |
| Con số 1–20 (có chữ số và số ngôi sao để đếm) | 20 |
| Cơ thể | 16 |
| Màu sắc | 12 |

Mỗi chủ đề có 4 trò:

| Trò | Bé làm gì | Chấm điểm |
|---|---|---|
| **Look and listen** (thẻ từ) | Mỗi lượt 10–15 thẻ (theo tuổi): từ bé hay nhầm ra trước, rồi đến từ chưa học, thứ tự xáo mỗi lần. Xem hình, nghe từ và một câu ngắn ("It's a cat."), chạm vào thẻ để nghe lại. | Học xong lần đầu được 1 sticker |
| **Listen and tap** | Nghe "Where is the cat?" rồi chạm đúng hình | 1–3 sao |
| **Find the shadow** | Kéo (hoặc chạm) hình vào đúng cái bóng | 1–3 sao |
| **Say it** | Nghe mẫu, bấm micro và nói từ đó | 1–3 sao |

**Cách chấm điểm**

- Sao tính theo số câu bé làm đúng **ngay lần đầu**: từ 85% trở lên được 3 sao, từ 50% được 2 sao, còn lại 1 sao. Bé luôn được ít nhất 1 sao.
- Đạt từ 2 sao trở lên được thưởng **một sticker mới** cho album (31 sticker).
- Chọn sai không bị trừ điểm. App chỉ phát tiếng "boop" nhẹ, làm mờ hình sai và đọc lại câu hỏi.
- Bài **Say it** chấm dễ: chấp nhận từ đồng âm ("for" → four, "I" → eye) và phát âm gần đúng. Nói hai lần chưa được thì app vẫn khen "Good try!", đọc mẫu rồi chuyển câu, để bé không bị kẹt.
- App ghi nhớ từ nào bé hay nhầm (theo kiểu hộp Leitner) và cho từ đó xuất hiện nhiều hơn ở các lần chơi sau. Các trò chơi chủ yếu hỏi những từ bé đã xem ở Look and listen, thỉnh thoảng mới có từ mới.

**Độ khó theo tuổi** (bố mẹ chọn trong phần cài đặt):

| Tuổi | Look and listen | Số hình mỗi câu | Listen and tap / Find the shadow | Say it |
|---|---|---|---|---|
| 2–3 | 10 thẻ | 2 | 8 câu | 6 câu |
| 4–5 | 12 thẻ | 3 | 10 câu | 8 câu |
| 6 | 15 thẻ | 4 | 12 câu | 10 câu |

## Phần dành cho bố mẹ

Giữ nút ổ khóa ở góc dưới bên phải khoảng 1,5 giây, rồi chạm vào con số được viết bằng chữ (ví dụ "ba mươi bảy"). Bé nhỏ chưa đọc được nên sẽ không tự vào được.

Trong đó có:

- Chọn độ tuổi.
- Chỉnh tốc độ đọc. Kéo xong app sẽ đọc thử.
- Bật đọc thêm nghĩa tiếng Việt ở thẻ từ (cần máy có giọng đọc tiếng Việt).
- Giới hạn thời gian chơi mỗi ngày (mặc định 20 phút). Hết giờ, bạn gà Chip sẽ nói "Time to rest" và đưa bé ra màn hình nghỉ.
- Xem tiến độ: số từ đã thuộc và số sao của từng chủ đề, các từ bé hay nhầm, số sticker đã có.
- Xóa tiến độ.

Toàn bộ tiến độ chỉ lưu trên máy (localStorage). App không có tài khoản và không gửi dữ liệu đi đâu. Giọng nói của bé chỉ được nhận dạng ngay trong trình duyệt, không ghi âm lại.

## Âm thanh và hình ảnh đến từ đâu

- **Hình:** [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) của Microsoft, phong cách *Flat*, giấy phép **MIT**, dùng miễn phí cả cho mục đích thương mại. File SVG nằm trong `public/img`, nên app nhẹ (khoảng 2 MB) và nét ở mọi kích thước. Kiểu viền trắng như sticker cắt rời được làm bằng CSS.
- **Giọng đọc:** giọng tiếng Anh có sẵn trên máy (Web Speech API). App tự chọn giọng tốt nhất nếu có, ví dụ "Google US English", Samantha (iOS) hoặc Aria/Jenny (Windows). Cách này không tốn tiền và chạy offline.
- **Nhận giọng nói:** SpeechRecognition của trình duyệt. Có trên Chrome (Android, máy tính) và Safari mới. Trình duyệt nào không hỗ trợ thì bài Say it tự ẩn đi.
- **Hiệu ứng âm thanh** (đúng, sai, sao, sticker): tạo bằng Web Audio, không cần file.

## Chạy và phát triển

Cần Node.js 20 trở lên.

```bash
npm install
npm run dev        # mở http://localhost:5173 (dùng --host nên mở được từ iPad/điện thoại cùng mạng wifi)
npm test           # unit test: chấm điểm, chọn từ, khớp giọng nói, nội dung
npm run build      # build ra thư mục dist/ (đã có service worker để chạy offline)
npm run shots      # tự chơi thử bằng Chrome headless và chụp màn hình vào shots/ (cần build trước)
```

Muốn mở trên iPad hoặc điện thoại: chạy `npm run dev` hoặc `npm run preview`, mở địa chỉ IP của máy tính trên trình duyệt của thiết bị, rồi chọn **Chia sẻ → Thêm vào màn hình chính**.

> Lưu ý: micro (bài Say it) chỉ hoạt động trên **https** hoặc `localhost`. Khi mở qua IP trong mạng nhà, hãy dùng bản deploy GitHub Pages (https) để bé dùng được micro.

### Deploy lên GitHub Pages

Workflow `.github/workflows/deploy.yml` tự chạy test, build và deploy mỗi khi push lên `main`. Lần đầu cần vào **Settings → Pages → Source** và chọn **GitHub Actions**.

## Cấu trúc

```
src/
  data/words.json      # chủ đề + từ vựng (thêm từ ở đây)
  data/stickers.json   # danh sách sticker thưởng
  lib/content.ts       # dựng câu: a/an/the, câu hỏi, câu mô tả
  lib/progress.ts      # chấm sao, hộp Leitner, chọn từ, sticker, lưu tiến độ, giới hạn giờ
  lib/match.ts         # chấm phát âm dễ tính (đồng âm + khoảng cách Levenshtein)
  lib/voice.ts         # đọc (TTS) và nghe (SpeechRecognition)
  lib/sfx.ts           # hiệu ứng âm thanh Web Audio
  main.ts              # các màn hình
  style.css            # giao diện
scripts/
  copy-assets.mjs      # chép hình từ bộ Fluent Emoji vào public/img
  make-icons.mjs       # tạo icon app
  screenshots.mjs      # chơi thử tự động + chụp màn hình
```

### Thêm từ mới

1. Tìm tên hình trong [thư mục assets của Fluent Emoji](https://github.com/microsoft/fluentui-emoji/tree/main/assets), ví dụ `Penguin`.
2. Thêm một dòng vào `src/data/words.json`:
   `{ "id": "penguin", "topic": "animals", "vi": "chim cánh cụt", "asset": "Penguin" }`
3. Chép lại hình:
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/fluentui-emoji.git /tmp/fe
   (cd /tmp/fe && git sparse-checkout set --no-cone '/assets/*/Flat/*' '/assets/*/Medium-Light/Flat/*' '/LICENSE')
   node scripts/copy-assets.mjs /tmp/fe
   npm test
   ```

Các cờ có thể dùng: `"plural": true` (grapes → "They're grapes"), `"mass": true` (milk → "It's milk"), `"the": true` (the sun), `"skin": true` (hình người dùng màu da trung tính), `"kind": "color" | "number" | "person"`.

## Hướng phát triển tiếp

- Thay giọng đọc của máy bằng file MP3 tạo sẵn từ Azure Neural TTS hoặc ElevenLabs (giọng trẻ em, đồng đều trên mọi máy).
- Chấm phát âm chi tiết hơn bằng Azure Pronunciation Assessment.
- Thêm trò "Find it in the picture" (tìm đồ vật trong một cảnh lớn) cho bé 5–6 tuổi, và các bài hát ngắn.
- Gói thành app Android/iOS bằng Capacitor.

## Giấy phép

Mã nguồn: MIT. Hình minh họa: Fluent Emoji © Microsoft, MIT (`public/img/LICENSE-fluentui-emoji.txt`).

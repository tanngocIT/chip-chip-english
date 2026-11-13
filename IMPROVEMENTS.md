# Kế hoạch cải tiến

Các việc để làm sau, chưa triển khai.

**Ràng buộc: chi phí 0 đồng.** Mọi giải pháp dưới đây phải miễn phí hoàn toàn, không cần thẻ thanh toán, không backend trả phí. Hosting là GitHub Pages.

**Ràng buộc: AI làm 100%.** Chủ repo chỉ đưa ý tưởng và ý kiến, không tìm nguồn, không ghi âm, không thao tác thủ công. AI tự tìm tài nguyên, tự tạo nội dung, tự chạy và kiểm tra.

## 0. Giọng đọc tự nhiên và đồng đều hơn (miễn phí) — ĐÃ LÀM hướng B

Đã làm: 1.358 file mp3 trong `public/voice/` sinh bằng Piper, giọng `en_US-kristin-medium` (public domain). Đã thử `ljspeech` và `cori` nhưng đọc từ đơn kém hơn. Còn có thể làm: thử giọng khác nếu thấy giọng này chưa hợp, và thêm mục chọn giọng cho câu tiếng Việt. Phần dưới là phân tích ban đầu.

Hiện app dùng TTS của trình duyệt, chất lượng tuỳ máy. Các hướng, theo thứ tự nên thử:

**A. Chọn giọng tốt nhất có sẵn trên máy (làm trước)**
- Ưu tiên giọng chất lượng cao: "Google US English" (Chrome), Samantha hoặc giọng Enhanced (iOS), giọng "Natural" (Edge). Thứ tự ưu tiên `en-US` rồi `en-GB`.
- Thêm mục chọn giọng và nghe thử trong khu vực bố mẹ.
- Chi phí 0, không tăng dung lượng. Nhược điểm: vẫn khác nhau giữa các máy.

**B. Tạo mp3 một lần bằng TTS mã nguồn mở chạy trên máy mình**
- Dùng công cụ như Piper (chạy local, không cần mạng hay tài khoản) để sinh file âm thanh cho 295 từ và câu mẫu bằng script, rồi commit vào `public/`.
- Phải kiểm tra giấy phép của từng giọng trước khi dùng, vì mỗi giọng có điều khoản riêng.
- Không dùng các API "miễn phí không chính thức" (ví dụ gọi dịch vụ đọc của trình duyệt qua thư viện bên thứ ba) vì điều khoản không rõ và có thể ngừng bất cứ lúc nào.
- Dung lượng ước vài MB, service worker cache để chơi offline. GitHub Pages đủ chỗ.

**Loại vì trái ràng buộc:**
- Azure Neural TTS, ElevenLabs, Google Cloud TTS, OpenAI TTS (cần thẻ hoặc trả phí).
- Thu giọng người thật (cần chủ repo ghi âm, trái ràng buộc AI làm 100%).

Khuyên: A trước. B chỉ làm khi thấy giọng hiện tại thực sự là điểm yếu.

## 1. Nút "Cài app ra màn hình chính" (PWA install prompt) — ĐÃ LÀM

Đã làm trong `src/lib/install.ts` và mục "Cài app" ở phần bố mẹ. Khác kế hoạch một chỗ: manifest giữ `display: fullscreen` (vẫn cài được), và khi bố mẹ từ chối thì mục này chuyển sang hướng dẫn cài bằng menu trình duyệt thay vì ẩn hẳn. Phần dưới là kế hoạch ban đầu.

**Mục tiêu:** bố mẹ chỉ cần bấm xác nhận là icon app được thêm ra màn hình chính điện thoại, không phải tự tìm trong menu trình duyệt.

**Android (Chrome, Edge, Samsung Internet):**
- Lắng nghe `beforeinstallprompt`, gọi `preventDefault()` và giữ lại event.
- Hiện nút "Cài app" của riêng mình. Khi bấm thì gọi `prompt()`, rồi đọc `userChoice` (`accepted` hoặc `dismissed`).
- Nghe `appinstalled` để ẩn nút sau khi cài xong.

**iPhone / iPad (Safari):**
- Apple không cho web gọi hộp thoại cài đặt và không có `beforeinstallprompt`.
- Hiện banner hướng dẫn có hình: "Bấm Chia sẻ → Thêm vào Màn hình chính".
- Nhận biết iOS qua user agent. Chỉ hiện khi chưa chạy ở chế độ standalone (`navigator.standalone` hoặc `matchMedia('(display-mode: standalone)')`).

**Chỗ đặt và quy tắc hiển thị:**
- Đặt trong khu vực bố mẹ (sau ổ khóa), để bé không bấm nhầm.
- Chỉ hiện khi app chưa được cài. Ẩn sau khi cài hoặc khi bị từ chối.

**Cần kiểm tra trước khi làm:**
- Manifest trong `vite.config` đủ tên, icon 192/512, `display: standalone`, `start_url`.
- Service worker của vite-plugin-pwa đang hoạt động.
- Chạy trên HTTPS (bản deploy qua GitHub Actions).

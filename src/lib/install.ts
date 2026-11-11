// "Cài app ra màn hình chính": Android/desktop Chromium dùng beforeinstallprompt,
// iPhone/iPad không có API nên chỉ hiện hướng dẫn.

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let deferred: InstallEvent | null = null;
let installed = false;
let onChange: (() => void) | null = null;

export type InstallState = 'installed' | 'prompt' | 'ios' | 'manual';

export function isStandalone(win: any = globalThis): boolean {
  try {
    if (win.navigator?.standalone === true) return true;
    return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => win.matchMedia?.(`(display-mode: ${m})`).matches);
  } catch {
    return false;
  }
}

export function isIos(nav: { userAgent?: string; platform?: string; maxTouchPoints?: number } = globalThis.navigator ?? {}): boolean {
  const ua = nav.userAgent ?? '';
  // iPadOS tự nhận là Mac, phân biệt bằng màn cảm ứng
  return /iPad|iPhone|iPod/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

export function initInstall() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    onChange?.();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    onChange?.();
  });
}

/** Gọi lại khi trạng thái cài đặt đổi (chỉ giữ một hàm; truyền null để bỏ). */
export const onInstallChange = (fn: (() => void) | null) => {
  onChange = fn;
};

export function installState(): InstallState {
  if (installed || isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  if (isIos()) return 'ios';
  return 'manual';
}

/** Mở hộp thoại cài của trình duyệt. Trả về true nếu bố mẹ đồng ý. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // mỗi event chỉ dùng được một lần
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') installed = true;
    return outcome === 'accepted';
  } catch {
    return false;
  } finally {
    onChange?.();
  }
}

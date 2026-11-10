const VI_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Vietnamese words for 10..99, e.g. 45 -> "bốn mươi lăm". Used by the grown-ups gate. */
export function viNumber(n: number): string {
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const head = tens === 1 ? 'mười' : `${VI_DIGITS[tens]} mươi`;
  if (ones === 0) return head;
  if (ones === 5) return `${head} lăm`;
  if (ones === 1 && tens > 1) return `${head} mốt`;
  if (ones === 4 && tens > 1) return `${head} tư`;
  return `${head} ${VI_DIGITS[ones]}`;
}

const digits = (s: string) => (s || "").replace(/\D/g, "");

/** 실시간 전화번호 포매팅
 * - 휴대폰/일반: 3-4-4 (최대 11자리)
 * - 050 안심번호: 3-5-4 (최대 12자리, 예: 050-44040-8990)
 */
export function formatPhoneAuto(v: string): string {
  const raw = digits(v);
  const is050 = raw.startsWith("050");
  const d = raw.slice(0, is050 ? 12 : 11);

  if (d.length <= 3) return d;

  if (is050) {
    // 050: 3-5-4
    if (d.length <= 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 8)}-${d.slice(8)}`;
  }

  // 일반: 3-4-4
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** YYYY.MM.DD 실시간 포매팅 (4/2/2) */
export function formatYmdDots(v: string): string {
  const d = digits(v).slice(0, 8);
  const y = d.slice(0, 4),
    m = d.slice(4, 6),
    day = d.slice(6, 8);
  let out = y;
  if (m) out += `.${m}`;
  if (day) out += `.${day}`;
  return out;
}
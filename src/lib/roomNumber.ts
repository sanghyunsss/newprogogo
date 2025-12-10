// src/lib/roomNumber.ts
/**
 * 문자열/숫자에서 객실 번호 정수만 추출
 * 예) "310호" -> 310, "  402 " -> 402, 403 -> 403, "호402호" -> 402
 * 숫자가 없으면 null
 */
export function extractRoomNumberInt(
  v: string | number | null | undefined
): number | null {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0 ? Math.trunc(v) : null;
  }
  if (typeof v !== "string") return null;

  const s = v.trim();
  if (!s) return null;

  // 첫 번째 연속 숫자 추출
  const m = s.match(/\d{1,5}/);
  if (!m) return null;

  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
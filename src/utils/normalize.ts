export function normalizeRoomNo(input: string) {
  const s = String(input).trim().replace(/\s+/g, "");
  return s.replace(/호$/, "") + "호"; // 끝 '호'는 제거 후 1번만 붙임
}
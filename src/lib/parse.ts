import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(tz);

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

const HEADERS = {
  roomType: ["객실타입", "객실 타입", "roomType"],
  assignedRoom: ["호실", "배정객실", "room", "객실"],
  checkIn: ["입실일시", "체크인", "checkin"],
  checkOut: ["퇴실일시", "체크아웃", "checkout"],
  guestName: ["예약자명", "이름", "name"],
  phone: ["연락처", "전화번호", "phone"],
};

function pick(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return String(v).trim();
  }
  return "";
}

/** "P동 433호" 등 → "P-433" */
function normalizeAssignedRoom(raw: string) {
  const s = raw.replace(/\s+/g, " ").trim();
  if (/^[A-Za-z가-힣]-\d+$/.test(s)) return s.toUpperCase();
  const m =
    s.match(/^([A-Za-z가-힣])\s*[-\s]*\s*(?:동)?\s*[-\s]*\s*(\d+)\s*(?:호)?$/) ||
    s.match(/^([A-Za-z가-힣])\s*(?:동)\s*(\d+)\s*(?:호)?$/);
  if (m) return `${String(m[1]).toUpperCase()}-${parseInt(String(m[2]), 10)}`;
  const m2 = s.match(/^([A-Za-z가-힣])\s*(?:동)?\s*(\d+)\D+(\d+)\s*(?:호)?$/);
  if (m2) return `${String(m2[1]).toUpperCase()}-${parseInt(m2[2], 10)}${parseInt(m2[3], 10)}`;
  const compact = s.replace(/[동호]/g, "").replace(/\s+/g, "");
  const m3 = compact.match(/^([A-Za-z가-힣])[-]?(\d+)$/);
  if (m3) return `${String(m3[1]).toUpperCase()}-${parseInt(m3[2], 10)}`;
  return s.toUpperCase().replace(/[동호]/g, "").replace(/\s+/g, "").replace(/([A-Z가-힣])(\d+)/, "$1-$2");
}

function normalizePhone(raw: string) {
  const d = raw.replace(/[^0-9]/g, "");
  if (d.length === 11 && d.startsWith("010")) return d.replace(/(\d{3})(\d{4})(\d{4})/, "010-$2-$3");
  if (d.length === 10) return d.replace(/(\d{2,3})(\d{3,4})(\d{4})/, "$1-$2-$3");
  return raw.trim();
}

function parseKST(s: string) {
  const t = s.replace("T", " ").replace(/\//g, "-").trim();
  const d = dayjs.tz(t, "YYYY-MM-DD HH:mm", "Asia/Seoul");
  if (!d.isValid()) throw new Error(`날짜 파싱 실패: ${s}`);
  return d;
}

export type ParsedBooking = {
  dateKey: string;         // YYYY-MM-DD (입실 기준, KST)
  roomType: string | null;
  assignedRoom: string;    // "P-433"
  checkIn: Date;
  checkOut: Date;
  guestName: string;
  phone: string;
};

export function mapRows(rows: Row[]): ParsedBooking[] {
  const out: ParsedBooking[] = [];
  for (const r of rows) {
    const roomType = pick(r, HEADERS.roomType) || null;
    const assignedRoomRaw = pick(r, HEADERS.assignedRoom);
    const assignedRoom = assignedRoomRaw ? normalizeAssignedRoom(assignedRoomRaw) : "";
    const checkInStr = pick(r, HEADERS.checkIn);
    const checkOutStr = pick(r, HEADERS.checkOut);
    const guestName = pick(r, HEADERS.guestName);
    const phone = normalizePhone(pick(r, HEADERS.phone));

    if (!assignedRoom || !checkInStr || !checkOutStr || !guestName || !phone) continue;

    const inKST = parseKST(checkInStr);
    const outKST = parseKST(checkOutStr);

    out.push({
      dateKey: inKST.format("YYYY-MM-DD"),
      roomType,
      assignedRoom,
      checkIn: inKST.toDate(),
      checkOut: outKST.toDate(),
      guestName,
      phone,
    });
  }
  return out;
}
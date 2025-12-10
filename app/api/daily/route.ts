// app/api/daily/route.ts
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import type { Prisma } from "@prisma/client";

/* ---------- utils ---------- */
function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  throw new Error("Invalid date from DB");
}
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseYmdLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}
function parseLocalDateTime(s: string): Date {
  const [datePart, timePart] = s.split("T");
  const [y, m, d] = (datePart ?? "").split("-").map(Number);
  let hh = 0, mm = 0;
  if (timePart) {
    const [h, mi] = timePart.split(":").map(Number);
    hh = Number.isFinite(h) ? h : 0;
    mm = Number.isFinite(mi) ? mi : 0;
  }
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh, mm, 0, 0);
}
/** 오늘 YYYY-MM-DD (서버 로컬 타임존 기준) */
function todayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const GUEST_BASE = process.env.NEXT_PUBLIC_GUEST_BASE_URL ?? "";
const guestUrl = (id: number) => (GUEST_BASE ? `${GUEST_BASE}/g/${id}` : `/g/${id}`);

/* ---------- GET: 조회 ---------- */
/** 쿼리 규칙
 * - ?todayCheckin=1 : 오늘 입실(startDate가 오늘)만
 * - ?start=YYYY-MM-DD&end=YYYY-MM-DD : "입실일(startDate)"만 기준으로 범위 조회 (end 생략 시 start로 대체)
 * - ?all=1 : 전체
 * - 위가 없으면 기본은 오늘 입실
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const hasRange = url.searchParams.has("start") || url.searchParams.has("end");
    const isAll = url.searchParams.get("all") === "1";
    const isTodayCheckin = url.searchParams.get("todayCheckin") === "1";
    const isTodayCheckout = url.searchParams.get("todayCheckout") === "1"; // ✅ 추가

    let where: Prisma.DailyGuestWhereInput | undefined;

    if (isTodayCheckin) {
      // 오늘 '입실' 기준
      const t = todayYmd();
      const start = parseYmdLocal(t);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      where = { startDate: { gte: start, lte: end } };
    } else if (isTodayCheckout) {
      // ✅ 오늘 '퇴실' 기준
      const t = todayYmd();
      const start = parseYmdLocal(t);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      where = { endDate: { gte: start, lte: end } };
    } else if (hasRange) {
      const startQ = url.searchParams.get("start");
      const endQ = url.searchParams.get("end") || startQ;
      if (startQ && endQ) {
        const start = parseYmdLocal(startQ);
        const end = parseYmdLocal(endQ); end.setHours(23, 59, 59, 999);
        where = { startDate: { gte: start, lte: end } };
      }
    } else if (!isAll) {
      // 기본: 오늘 '입실'
      const t = todayYmd();
      const start = parseYmdLocal(t);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      where = { startDate: { gte: start, lte: end } };
    }

    const rows = await prisma.dailyGuest.findMany({
      where,
      include: { room: true },
      orderBy: [{ startDate: "asc" }, { roomId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      rows: rows.map((r) => {
        const s = asDate(r.startDate);
        const e = asDate(r.endDate);
        return {
          id: r.id,
          roomId: r.roomId ?? null,
          room: r.room ? { number: r.room.number } : null,
          roomType: r.roomType ?? "",
          name: r.name,
          contact: r.contact,
          carNo: r.carNo ?? "",
          startDate: toYmd(s),
          endDate: toYmd(e),
          startTime: toHm(s),
          endTime: toHm(e),
          guestUrl: guestUrl(r.id),
        };
      }),
    });
  } catch (e) {
    console.error("GET /api/daily error:", e);
    return NextResponse.json({ error: "Failed to load daily guests" }, { status: 500 });
  }
}

/* ---------- POST: upsert ---------- */
export async function POST(req: Request) {
  try {
    const raw = await req.json();

    const b = raw as Partial<{
      id: number | string;
      roomId: number | string;   // 선택값
      roomType?: string;
      startDate: string;         // YYYY-MM-DDTHH:mm
      endDate: string;           // YYYY-MM-DDTHH:mm
      name: string;
      contact?: string;
      carNo?: string | null;
    }>;

    // 필수값: 이름/입실/퇴실
    if (typeof b.startDate !== "string" || typeof b.endDate !== "string" || typeof b.name !== "string") {
      return NextResponse.json({ error: "startDate, endDate, name는 필수입니다." }, { status: 400 });
    }

    // 날짜 검증
    const start = parseLocalDateTime(b.startDate);
    const end = parseLocalDateTime(b.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return NextResponse.json({ error: "날짜/시간 형식이 올바르지 않습니다." }, { status: 400 });
    if (start > end)
      return NextResponse.json({ error: "입실 시각이 퇴실 시각보다 늦을 수 없습니다." }, { status: 400 });

    // roomId 숫자 변환(없으면 undefined 유지)
    const roomId =
      b.roomId === undefined || b.roomId === null || b.roomId === ""
        ? undefined
        : Number(b.roomId);

    // 공통 데이터
    const baseData = {
      roomType: (b.roomType ?? "").trim() || null,
      startDate: start,
      endDate: end,
      name: b.name,
      contact: b.contact ?? "",
      carNo: b.carNo ?? "",
    } as const;

    let saved;

    if (b.id) {
      // ===== UPDATE =====
      const updData: Prisma.DailyGuestUpdateInput = { ...baseData };
      if (Number.isFinite(roomId)) {
        if ((roomId as number) <= 0) return NextResponse.json({ error: "유효한 호실을 선택해 주세요." }, { status: 400 });
        const exists = await prisma.room.count({ where: { id: roomId as number } });
        if (!exists) return NextResponse.json({ error: "존재하지 않는 호실입니다." }, { status: 400 });
        updData.room = { connect: { id: roomId as number } };
      } else if (b.roomId === null || b.roomId === "") {
        // 명시적으로 해제 요청 시 연결 제거
        updData.room = { disconnect: true };
      }
      saved = await prisma.dailyGuest.update({
        where: { id: Number(b.id) },
        data: updData,
        include: { room: true },
      });
    } else {
      // ===== CREATE =====
      const createData: Prisma.DailyGuestCreateInput = { ...baseData };
      if (Number.isFinite(roomId) && (roomId as number) > 0) {
        const exists = await prisma.room.count({ where: { id: roomId as number } });
        if (exists) {
          createData.room = { connect: { id: roomId as number } };
        }
      }
      saved = await prisma.dailyGuest.create({
        data: createData,
        include: { room: true },
      });
    }

    // 응답
    const s = asDate(saved.startDate);
    const e = asDate(saved.endDate);
    return NextResponse.json(
      {
        success: true,
        entry: {
          id: saved.id,
          roomId: saved.roomId ?? null,
          room: saved.room ? { number: saved.room.number } : null,
          roomType: saved.roomType ?? "",
          name: saved.name,
          contact: saved.contact,
          carNo: saved.carNo ?? "",
          startDate: toYmd(s),
          endDate: toYmd(e),
          startTime: toHm(s),
          endTime: toHm(e),
          guestUrl: guestUrl(saved.id),
        },
      },
      { status: b.id ? 200 : 201 }
    );
  } catch (e) {
    console.error("POST /api/daily error:", e);
    return NextResponse.json({ error: "DB 처리 중 오류" }, { status: 500 });
  }
}

/* ---------- DELETE: 단건 삭제 ---------- */
/** 주의: Next App Router에서 /api/daily/:id 로 호출하는 케이스를 위해
 * 여기서 pathname 마지막 세그먼트에서 id를 파싱합니다.
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = Number(url.pathname.split("/").pop());
    if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    await prisma.dailyGuest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/daily error:", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
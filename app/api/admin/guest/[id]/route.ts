// /app/api/guest/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/src/lib/prisma";

/** ── 유틸: App Router의 params가 Promise인 경우까지 안전 처리 ── */
type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

function isPromise<T>(v: unknown): v is Promise<T> {
  return !!v && typeof (v as Promise<T>).then === "function";
}
async function readParams(ctx: Ctx): Promise<{ id: string }> {
  const raw = (ctx as { params: unknown }).params;
  return isPromise<{ id: string }>(raw) ? await raw : (raw as { id: string });
}

/** 포맷터 */
const toYmd = (d: Date | string) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const toHm = (d: Date | string) => {
  const x = d instanceof Date ? d : new Date(d);
  return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await readParams(ctx);
    const guestId = Number(id);
    if (!Number.isFinite(guestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const g = await prisma.dailyGuest.findUnique({
      where: { id: guestId },
      include: { room: true },
    });
    if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 계획(예약) 시각
    const startDate = toYmd(g.startDate);
    const startTime = toHm(g.startDate);
    const endDate = toYmd(g.endDate);
    const endTime = toHm(g.endDate);

    // 실제 이벤트(손님 기준)
    const evts = await prisma.event.findMany({
      where: { guestId: g.id },
      orderBy: { ts: "asc" },
      select: { id: true, type: true, ts: true },
    });
    const firstCheckin = evts.find((e) => e.type === "checkin");
    const lastCheckout = [...evts].reverse().find((e) => e.type === "checkout");

    const actual = {
      checkinDate: firstCheckin ? toYmd(firstCheckin.ts) : null,
      checkinTime: firstCheckin ? toHm(firstCheckin.ts) : null,
      checkoutDate: lastCheckout ? toYmd(lastCheckout.ts) : null,
      checkoutTime: lastCheckout ? toHm(lastCheckout.ts) : null,
    };

    // 상태 플래그(단순 존재 여부)
    const checkedIn = !!firstCheckin;
    const checkedOut = !!lastCheckout;

    return NextResponse.json({
      guest: {
  id: g.id,
  room: g.room ? { number: g.room.number } : null, // ← null-safe
  name: g.name,
  startDate,
  startTime,
  endDate,
  endTime,
},
      actual,
      checkedIn,
      checkedOut,
    });
  } catch (err) {
    console.error("GET /api/guest/[id] error:", err);
    return NextResponse.json({ error: "Failed to load guest" }, { status: 500 });
  }
}
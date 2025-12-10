// app/api/guest/by-token/[token]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/src/lib/prisma"; // 경로는 프로젝트에 맞게
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TZ = "Asia/Seoul";

function fmtYmd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtHm(d: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const g = await prisma.dailyGuest.findUnique({
    where: { token },
    select: {
      id: true,
      roomId: true,          // ✅ 제어용 roomId 포함
      name: true,
      contact: true,
      carNo: true,
      startDate: true,
      endDate: true,
      roomType: true,
      room: { select: { number: true } },
    },
  });
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 만료: 체크아웃일 23:59:59 (KST)
  const exp = new Date(g.endDate); exp.setHours(23,59,59,999);
  if (new Date() > exp) return NextResponse.json({ error: "Link expired" }, { status: 403 });

  // ✅ 이벤트로 체크인/아웃 상태 복원
  const evts = await prisma.event.findMany({
    where: { guestId: g.id, verified: true },
    orderBy: { ts: "asc" },
  });
  const checkinEvt  = evts.find(e => e.type === "checkin");
  const checkoutEvt = evts.find(e => e.type === "checkout");

  const checkedIn  = !!checkinEvt;
  const checkedOut = !!checkoutEvt;

  const start = new Date(g.startDate);
  const end   = new Date(g.endDate);

  const res = {
    guest: {
      id: g.id,
      roomId: g.roomId ?? null,      // ✅ 클라가 이 값으로 제어 요청
      name: g.name,
      contact: g.contact,
      roomType: g.roomType,
      room: { number: g.room ? g.room.number : "" },
      startDate: fmtYmd(start),
      endDate: fmtYmd(end),
      startTime: fmtHm(start),
      endTime: fmtHm(end),
    },
    actual: checkinEvt || checkoutEvt ? {
      checkinDate:  checkinEvt  ? fmtYmd(new Date(checkinEvt.ts))  : null,
      checkinTime:  checkinEvt  ? fmtHm(new Date(checkinEvt.ts))   : null,
      checkoutDate: checkoutEvt ? fmtYmd(new Date(checkoutEvt.ts)) : null,
      checkoutTime: checkoutEvt ? fmtHm(new Date(checkoutEvt.ts))  : null,
    } : null,
    checkedIn,
    checkedOut,
    carNo: g.carNo ?? null,
  };

  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
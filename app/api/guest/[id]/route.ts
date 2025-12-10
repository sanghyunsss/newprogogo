// app/api/guest/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

/* ---------- utils ---------- */
const two = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
const toHm = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const todayYmd = () => toYmd(new Date());

/* ───────────────── GET: 게스트 상세 + 실제기록 상태 ───────────────── */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const guestId = Number(id);
    if (!Number.isFinite(guestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const g = await prisma.dailyGuest.findUnique({
      where: { id: guestId },
      include: { room: true },
    });
    if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const s = new Date(g.startDate);
    const e = new Date(g.endDate);

    const evts = await prisma.event.findMany({
      where: { guestId: g.id },
      orderBy: { ts: "asc" },
    });
    const ci = evts.find((ev) => ev.type === "checkin");
    const co = evts.find((ev) => ev.type === "checkout");

    const actual = {
      checkinDate: ci ? toYmd(new Date(ci.ts)) : null,
      checkinTime: ci ? toHm(new Date(ci.ts)) : null,
      checkoutDate: co ? toYmd(new Date(co.ts)) : null,
      checkoutTime: co ? toHm(new Date(co.ts)) : null,
    };

    return NextResponse.json({
      guest: {
        id: g.id,
        room: g.room ? { number: g.room.number } : null,
        name: g.name,
        startDate: toYmd(s),
        startTime: toHm(s),
        endDate: toYmd(e),
        endTime: toHm(e),
      },
      actual,
      checkedIn: !!ci,
      checkedOut: !!co,
    });
  } catch (err) {
    console.error("GET /api/guest/[id] error:", err);
    return NextResponse.json({ error: "Failed to load guest" }, { status: 500 });
  }
}

/* ───────────────── POST: 체크인/체크아웃 수행(1회만) ───────────────── */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const guestId = Number(id);
    if (!Number.isFinite(guestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as { action?: "checkin" | "checkout" };
    if (body?.action !== "checkin" && body?.action !== "checkout") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const guest = await prisma.dailyGuest.findUnique({
      where: { id: guestId },
      include: { room: true },
    });
    if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 중복 방지: 게스트별 각 액션은 1회만 허용
    const existing = await prisma.event.findFirst({
      where: { guestId: guest.id, type: body.action },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Already ${body.action}ed` },
        { status: 409 }
      );
    }

    // ✅ 스키마 변경 없이: roomId가 없으면 기록 금지(명확히 400 반환)
    if (guest.roomId == null) {
      return NextResponse.json(
        { error: "호실이 지정되지 않아 체크인/아웃을 기록할 수 없습니다." },
        { status: 400 }
      );
    }

    // 이벤트 기록
    await prisma.event.create({
      data: {
        roomId: guest.roomId,   // 위에서 null 아님 보장
        guestId: guest.id,
        type: body.action,
        ts: new Date(),
        verified: true,
        dateKey: todayYmd(),
      },
    });

    // 현재 상태 재계산(응답 편의)
    const [ci, co] = await Promise.all([
      prisma.event.findFirst({ where: { guestId: guest.id, type: "checkin" } }),
      prisma.event.findFirst({ where: { guestId: guest.id, type: "checkout" } }),
    ]);

    return NextResponse.json({
      success: true,
      checkedIn: !!ci,
      checkedOut: !!co,
    });
  } catch (err) {
    console.error("POST /api/guest/[id] error:", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
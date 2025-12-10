// app/api/guest/[id]/car/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

// 프로젝트 타입 보강에 맞춘 컨텍스트 타입
type Ctx = { params: Promise<{ id: string }> };

// GET /api/guest/:id/car  -> { carNo: string }
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guestId = Number(id);
  if (!Number.isFinite(guestId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const g = await prisma.dailyGuest.findUnique({
    where: { id: guestId },
    select: { carNo: true },
  });
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ carNo: g.carNo ?? "" });
}

// POST /api/guest/:id/car  body: { carNo: string }
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const guestId = Number(id);
  if (!Number.isFinite(guestId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let carNo = "";
  try {
    const body = (await req.json()) as { carNo?: string };
    carNo = (body.carNo ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!carNo) {
    return NextResponse.json({ error: "차량번호를 입력하세요." }, { status: 400 });
  }
  if (carNo.length > 30) {
    return NextResponse.json({ error: "차량번호가 너무 깁니다." }, { status: 400 });
  }

  // 게스트 + 객실 조회 (로그용 정보 확보)
  const guest = await prisma.dailyGuest.findUnique({
    where: { id: guestId },
    include: { room: true },
  });
  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 차량번호 업데이트
  const updated = await prisma.dailyGuest.update({
    where: { id: guestId },
    data: { carNo },
    select: { carNo: true },
  });

  // 🔹 주차등록 로그 적재
  await prisma.parkingLog.create({
    data: {
      guestId: guest.id,
      roomId: guest.roomId,
      roomNumber: guest.room?.number ?? null,
      guestName: guest.name,
      carNo,
      source: "guest",     // 게스트 화면에서 등록
      note: null,
    },
  });

  return NextResponse.json({ success: true, carNo: updated.carNo ?? "" });
}
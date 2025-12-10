// app/api/cleaning/autolist/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { getAdmin } from "../_auth";

const J = (d: unknown, s = 200) => NextResponse.json(d, { status: s, headers: { "Cache-Control": "no-store" } });

function parseDate(ymd?: string | null) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function GET(req: Request) {
  const me = await getAdmin();
  if (!me) return J({ error: "unauth" }, 401);

  const { searchParams } = new URL(req.url);
  const date = parseDate(searchParams.get("date")); // 현지 자정 기준
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

  // endDate 가 해당 날짜 안에 들어오는 투숙 = "오늘 퇴실"
  const rows = await prisma.dailyGuest.findMany({
    where: { endDate: { gte: date, lt: next } },
    include: { room: { select: { id: true, number: true } } },
    orderBy: [{ endDate: "asc" }, { id: "asc" }],
  });

  // UI에서 쓰는 필드로 매핑
  const out = rows.map(r => ({
    id: r.id,
    roomId: r.roomId,
    room: r.room ? { number: r.room.number } : null,
    roomType: r.roomType ?? null,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    startTime: null as string | null,
    endTime: null as string | null,
  }));

  return J({ rows: out });
}
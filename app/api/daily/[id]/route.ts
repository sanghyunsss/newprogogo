// /app/api/daily/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

/** Next.js 15: params는 Promise 형태 */
type RouteParams = { params: Promise<{ id: string }> };

/** 게스트 링크 생성 (환경변수 기반) */
const GUEST_BASE = process.env.NEXT_PUBLIC_GUEST_BASE_URL ?? "";
const buildGuestUrl = (id: number) => (GUEST_BASE ? `${GUEST_BASE}/r/${id}` : `/r/${id}`);

/** Prisma가 Date | string | number 로 들어와도 Date 로 보장 */
function asDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  throw new Error("Invalid date from DB");
}

/** YYYY-MM-DDTHH:mm (로컬 기준) */
function toLocalYmdHm(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd}T${hh}:${mi}`;
}

/** GET /api/daily/:id — 단건 조회 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;             // ✅ Promise 해제
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json({ error: "유효하지 않은 id" }, { status: 400 });
  }

  const row = await prisma.dailyGuest.findUnique({
    where: { id: idNum },
    include: { room: true },
  });

  if (!row) return NextResponse.json({ error: "존재하지 않는 항목" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    roomId: row.roomId,
    room: row.room ? { id: row.room.id, number: row.room.number } : null,
    name: row.name,
    contact: row.contact,
    carNo: row.carNo ?? "",
    startDate: toLocalYmdHm(asDate(row.startDate)),
    endDate: toLocalYmdHm(asDate(row.endDate)),
    guestUrl: buildGuestUrl(row.id),
  });
}

/** DELETE /api/daily/:id — 단건 삭제 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;             // ✅ Promise 해제
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json({ error: "유효하지 않은 id" }, { status: 400 });
  }

  const exists = await prisma.dailyGuest.count({ where: { id: idNum } });
  if (!exists) return NextResponse.json({ error: "이미 삭제되었거나 존재하지 않습니다." }, { status: 404 });

  await prisma.dailyGuest.delete({ where: { id: idNum } });
  return NextResponse.json({ success: true });
}
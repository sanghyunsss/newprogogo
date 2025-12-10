import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import type { Prisma } from "@prisma/client";

/** YYYY-MM-DD 형식인지 대충 검증 */
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** GET /api/admin/events
 * query:
 *  - page, pageSize
 *  - type: "checkin" | "checkout"
 *  - roomId: number
 *  - guestId: number
 *  - start, end: YYYY-MM-DD (dateKey 범위)
 *  - debug=1
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    // 페이지네이션
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));

    // 필터
    const where: Prisma.EventWhereInput = {};

    const type = url.searchParams.get("type");
    if (type === "checkin" || type === "checkout") {
      where.type = type;
    }

    const roomId = Number(url.searchParams.get("roomId"));
    if (Number.isFinite(roomId) && roomId > 0) {
      where.roomId = roomId;
    }

    const guestId = Number(url.searchParams.get("guestId"));
    if (Number.isFinite(guestId) && guestId > 0) {
      where.guestId = guestId;
    }

    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (start && isYmd(start)) {
      // end 없으면 start와 동일한 하루
      const endKey = end && isYmd(end) ? end : start;
      where.dateKey = { gte: start, lte: endKey };
    }

    // 정렬(최신 먼저)
    const orderBy: Prisma.EventOrderByWithRelationInput[] = [{ dateKey: "desc" }, { ts: "desc" }];

    const [total, list] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy,
        include: { room: { select: { number: true } }, guest: { select: { id: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const rows = list.map((e) => ({
      id: e.id,
      room: e.room?.number ?? String(e.roomId),
      type: (e.type === "checkin" || e.type === "checkout" ? e.type : "checkin") as "checkin" | "checkout",
      ts: (e.ts instanceof Date ? e.ts : new Date(e.ts as unknown as string)).toISOString(),
      verified: !!e.verified,
      guestId: e.guestId ?? null,
      dateKey: e.dateKey,
    }));

    return NextResponse.json({ rows, total, page });
  } catch (err) {
    console.error("GET /api/admin/events error:", err);
    if (debug) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return NextResponse.json({ error: "Failed to load events", detail }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
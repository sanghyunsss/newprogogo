// /app/api/admin/actuals/route.ts
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export const dynamic = "force-dynamic"; // Next 캐시 방지(안전)

type Body = { ids: number[] };

// HH:mm 로 바꿔서 반환(유효하지 않으면 undefined)
function toHm(ts: Date | string | null | undefined): string | undefined {
  if (!ts) return undefined;
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return undefined;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Body>;
    // 숫자만 추려냄(문자 들어와도 방어)
    const ids = Array.isArray(body.ids)
      ? body.ids.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      : [];
    if (ids.length === 0) return NextResponse.json({ rows: [] });

    // 해당 게스트들의 이벤트 전체(시간순)
    const evts = await prisma.event.findMany({
      where: { guestId: { in: ids } },
      orderBy: { ts: "asc" },
      select: { id: true, guestId: true, type: true, ts: true },
    });

    // 게스트별 요약: 첫 checkin, 마지막 checkout
    const byGuest: Record<
      number,
      { in?: string; out?: string; inEventId?: number; outEventId?: number }
    > = {};

    for (const e of evts) {
      const gid = e.guestId;
      if (!gid) continue; // 안전
      if (!byGuest[gid]) byGuest[gid] = {};

      if (e.type === "checkin") {
        if (!byGuest[gid].in) {
          const hm = toHm(e.ts);
          if (hm) {
            byGuest[gid].in = hm;
            byGuest[gid].inEventId = e.id;
          }
        }
      } else if (e.type === "checkout") {
        const hm = toHm(e.ts);
        if (hm) {
          byGuest[gid].out = hm;            // 가장 늦은 checkout으로 계속 갱신
          byGuest[gid].outEventId = e.id;
        }
      }
    }

    // 요청한 순서대로 응답
    const rows = ids.map((id) => ({
      guestId: id,
      in: byGuest[id]?.in,
      out: byGuest[id]?.out,
      inEventId: byGuest[id]?.inEventId,
      outEventId: byGuest[id]?.outEventId,
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("POST /api/admin/actuals error:", err);
    return NextResponse.json({ error: "Failed to load actual times" }, { status: 500 });
  }
}
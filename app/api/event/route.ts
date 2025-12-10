// /app/api/event/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));
    const skip = (page - 1) * pageSize;

    const where = {} as const;

    const [total, rows] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        include: { room: true, guest: true },
        orderBy: { ts: "desc" }, // 또는 { id: "desc" }
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      rows: rows.map((e) => ({
        id: e.id,
        room: e.room?.number ?? "",
        type: e.type as "checkin" | "checkout",
        ts: e.ts,
        verified: e.verified ?? false,
        guest: e.guest ? { id: e.guest.id, name: e.guest.name } : null,
      })),
    });
  } catch (err) {
    console.error("GET /api/event error:", err);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
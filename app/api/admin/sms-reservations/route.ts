// app/api/admin/sms-reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ALLOWED_TAKE = new Set([50, 100, 300, 500]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const rawTake = Number(sp.get("take") ?? 50);
    const take = ALLOWED_TAKE.has(rawTake) ? rawTake : 50;

    const rawPage = Number(sp.get("page") ?? 1);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

    const where = { scheduledAt: { not: null }, status: "requested" as const };

    const [total, rows] = await Promise.all([
      prisma.smsMessage.count({ where }),
      prisma.smsMessage.findMany({
        where,
        orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
        take,
        skip: (page - 1) * take,
        select: {
          id: true,
          createdAt: true,
          scheduledAt: true,
          messageKey: true,
          type: true,
          content: true,
          status: true,
          targets: {
            select: {
              to: true,
              name: true,
              var2: true,           // 호실
              resultCode: true,
              resultDesc: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / take));

    // 직렬화(NextResponse가 Date를 자동 직렬화하지만 형 일치 위해 문자열로 변환)
    const list = rows.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      scheduledAt: m.scheduledAt ? m.scheduledAt.toISOString() : null,
    }));

    return NextResponse.json({ ok: true, page, totalPages, total, list });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
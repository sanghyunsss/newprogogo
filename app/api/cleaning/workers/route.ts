export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  try {
    const rows = await prisma.cleaningWorker.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, phone: true, isActive: true },
    });
    return J({ ok: true, rows });
  } catch (e: any) {
    return J(
      { ok: false, error: "internal", message: e?.message || "internal", code: e?.code },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const j = await req.json().catch(() => ({}));
    const name = String(j.name || "").trim();
    const phone = String(j.phone || "").trim();
    const rates: { roomType: string; amount: number }[] = Array.isArray(j.rates) ? j.rates : [];
    if (!name || !phone) return J({ ok: false, error: "bad_params" }, 400);

    const w = await prisma.cleaningWorker.create({
      data: { name, phone: phone.replace(/\D/g, "") },
    });

    for (const r of rates) {
      const roomType = String(r.roomType || "").trim();
      const amount = Math.max(0, Number(r.amount || 0) | 0);
      if (!roomType || amount <= 0) continue;

      // CleaningRate 사용
      await prisma.cleaningRate.upsert({
        where: { workerId_roomType: { workerId: w.id, roomType } },
        create: { workerId: w.id, roomType, amount },
        update: { amount },
      });
    }

    return J({ ok: true, id: w.id });
  } catch (e: any) {
    return J(
      { ok: false, error: "internal", message: e?.message || "internal", code: e?.code },
      500
    );
  }
}
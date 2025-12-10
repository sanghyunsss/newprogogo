export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return J({ ok: false, error: "bad_id" }, 400);

    // rates 관계 사용 (prices 아님)
    const w = await prisma.cleaningWorker.findUnique({
      where: { id },
      include: { rates: true }, // ← 수정
    });
    if (!w) return J({ ok: false, error: "not_found" }, 404);

    const rateMap: Record<string, number> = {};
    for (const r of w.rates) rateMap[r.roomType] = r.amount;

    return J({
      ok: true,
      id: w.id,
      name: w.name,
      phone: w.phone,
      isActive: w.isActive,
      rates: rateMap,
    });
  } catch (e: any) {
    return J(
      { ok: false, error: "internal", message: e?.message || "internal", code: e?.code },
      500
    );
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return J({ ok: false, error: "bad_id" }, 400);

    const j = await req.json().catch(() => ({}));

    const data: any = {};
    if (j.name !== undefined) data.name = String(j.name || "").trim();
    if (j.phone !== undefined) data.phone = String(j.phone || "").replace(/\D/g, "");
    if (j.isActive !== undefined) data.isActive = !!j.isActive;

    if (Object.keys(data).length) {
      await prisma.cleaningWorker.update({ where: { id }, data });
    }

    // rates: [{ roomType, amount }]
    if (Array.isArray(j.rates)) {
      for (const r of j.rates as { roomType: string; amount: number }[]) {
        const roomType = String(r.roomType || "").trim();
        const amount = Math.max(0, Number(r.amount || 0) | 0);
        if (!roomType) continue;

        if (amount > 0) {
          // CleaningRate 사용
          await prisma.cleaningRate.upsert({
            where: { workerId_roomType: { workerId: id, roomType } },
            create: { workerId: id, roomType, amount },
            update: { amount },
          });
        } else {
          await prisma.cleaningRate.deleteMany({ where: { workerId: id, roomType } });
        }
      }
    }

    return J({ ok: true });
  } catch (e: any) {
    return J(
      { ok: false, error: "internal", message: e?.message || "internal", code: e?.code },
      500
    );
  }
}
// /app/api/guest/[id]/car/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/src/lib/prisma";

/** params 안전 처리 */
type Ctx =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

function isPromise<T>(v: unknown): v is Promise<T> {
  return !!v && typeof (v as Promise<T>).then === "function";
}
async function readParams(ctx: Ctx): Promise<{ id: string }> {
  const raw = (ctx as { params: unknown }).params;
  return isPromise<{ id: string }>(raw) ? await raw : (raw as { id: string });
}

type PatchBody = { carNo: string };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await readParams(ctx);
    const guestId = Number(id);
    if (!Number.isFinite(guestId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<PatchBody>;
    const raw = (body.carNo ?? "").toString().trim();

    if (raw.length === 0) {
      return NextResponse.json({ error: "차량번호를 입력해 주세요." }, { status: 400 });
    }
    if (raw.length > 120) {
      return NextResponse.json({ error: "차량번호가 너무 깁니다." }, { status: 400 });
    }

    const exists = await prisma.dailyGuest.count({ where: { id: guestId } });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.dailyGuest.update({
      where: { id: guestId },
      data: { carNo: raw },
      select: { id: true, carNo: true },
    });

    return NextResponse.json({ success: true, carNo: updated.carNo });
  } catch (err) {
    console.error("PATCH /api/guest/[id]/car error:", err);
    return NextResponse.json({ error: "Failed to save car number" }, { status: 500 });
  }
}
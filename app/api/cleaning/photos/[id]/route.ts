// app/api/cleaning/photos/[id]/route.ts  ← 신규
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function DELETE(_: Request, ctx: { params: { id: string } }) {
  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  await prisma.cleaningTaskPhoto.delete({ where: { id } }).catch(()=>{});
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
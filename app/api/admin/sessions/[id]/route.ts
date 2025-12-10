// app/api/admin/sessions/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireAdmin();
  const sid = Number(params.id);
  if (!Number.isFinite(sid)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  // 소유자면 아무 세션이나, 일반 admin이면 본인 세션만 삭제
  const where =
    me.role === "owner" ? { id: sid } : { id: sid, adminId: me.id };

  const r = await prisma.adminSession.deleteMany({ where });
  if (r.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
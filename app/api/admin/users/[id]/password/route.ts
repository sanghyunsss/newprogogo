// app/api/admin/users/[id]/password/route.ts
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import { hashPassword } from "@/src/lib/auth";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const id = Number(params.id);
    const { password } = await req.json();
    if (!id || !password) return NextResponse.json({ error: "invalid" }, { status: 400 });
    const hashed = await hashPassword(password);
    await prisma.adminUser.update({ where: { id }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
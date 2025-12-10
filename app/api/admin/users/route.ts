// app/api/admin/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard";
import { hashPassword } from "@/src/lib/auth"; // 기존 유틸 유지

export async function GET() {
  try {
    await requireAdmin(); // JWT 검증
    const rows = await prisma.adminUser.findMany({
      orderBy: { id: "asc" },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    const msg = e?.message || "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" || msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdmin("owner"); // 추가/삭제는 owner만
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "email/password required" }, { status: 400 });

    const hashed = await hashPassword(password);
    const row = await prisma.adminUser.create({ data: { email, password: hashed } });
    return NextResponse.json({ id: row.id, by: me.email });
  } catch (e: any) {
    const msg = e?.message || "UNAUTHORIZED";
    const status = msg === "FORBIDDEN" || msg === "UNAUTHORIZED" ? 401
                 : /Unique constraint/i.test(msg) ? 409
                 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
// app/api/admin/sessions/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdmin } from "@/src/lib/auth-guard"; // ← 여기

export async function GET() {
  const me = await requireAdmin(); // { id, email, role }
  const where = me.role === "owner" ? {} : { adminId: me.id };

  const rows = await prisma.adminSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      ip: true,
      ua: true,
      createdAt: true,
      expiresAt: true,
      admin: { select: { id: true, email: true } },
    },
  });

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}
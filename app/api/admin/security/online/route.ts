export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const rows = await prisma.adminSession.findMany({
    where: { lastSeen: { gte: since } },
    orderBy: { lastSeen: "desc" },
    select: { email: true, ip: true, ua: true, lastSeen: true },
  });
  return NextResponse.json({ rows });
}
// app/api/admin/security/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const minutes = Number(new URL(req.url).searchParams.get("minutes") ?? "5");
  const since = new Date(Date.now() - minutes * 60_000);

  const logs = await prisma.adminRequestLog.findMany({
    where: { createdAt: { gte: since } },          // ✅ ts → createdAt
    orderBy: [{ ip: "asc" }, { createdAt: "desc" }],// ✅ ts → createdAt
    select: {
      ip: true,
      who: true,
      createdAt: true,                               // ✅ ts → createdAt
      ua: true,
      path: true,
    },
  });

  // IP+who 단위로 집계
  const map = new Map<
    string,
    { ip: string; who: string | null; lastSeen: Date; count: number; lastUA?: string; lastPath?: string }
  >();

  for (const l of logs) {
    const key = `${l.ip}|${l.who ?? ""}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        ip: l.ip,
        who: l.who,
        lastSeen: l.createdAt,
        count: 1,
        lastUA: l.ua ?? undefined,
        lastPath: l.path ?? undefined,
      });
    } else {
      cur.count += 1;
      if (l.createdAt > cur.lastSeen) {
        cur.lastSeen = l.createdAt;
        if (l.ua) cur.lastUA = l.ua;
        if (l.path) cur.lastPath = l.path;
      }
    }
  }

  const rows = [...map.values()].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  return NextResponse.json({ rows });
}
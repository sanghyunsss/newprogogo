// app/api/cleaning/link/route.ts  ← 전체교체
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

const looksJWT = (s: string) => /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9._-]*\.[A-Za-z0-9._-]*$/.test(s);
const at00UTC = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export async function POST(req: Request) {
  const j = await req.json().catch(() => ({}));
  const workerId = Number(j.workerId || 0);
  const date = String(j.date || "").slice(0,10);
  if (!workerId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok:false, error:"bad_params" }, { status:400 });
  }

  const base = process.env.MAGIC_LINK_BASE || process.env.BASE_URL || null;
  if (!base) return NextResponse.json({ ok:false, error:"magic_link_base_missing" }, { status:500 });

  const d = at00UTC(date);
  let row = await prisma.cleaningToken.findFirst({
    where: { workerId, date: d, valid: true },
    orderBy: { id: "desc" },
  });

  // 과거 JWT 토큰이면 즉시 무효화 후 새로 발급
  if (row && looksJWT(row.token)) {
    await prisma.cleaningToken.update({ where: { token: row.token }, data: { valid: false } });
    row = null;
  }

  const token = row?.token ?? crypto.randomUUID();
  if (!row) {
    await prisma.cleaningToken.create({ data: { workerId, date: d, token, valid: true } });
  }

  return NextResponse.json({ ok:true, url: `${base}/worker/cleaning?token=${encodeURIComponent(token)}` });
}
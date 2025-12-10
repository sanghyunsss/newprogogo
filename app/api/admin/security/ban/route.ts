export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function POST(req: NextRequest) {
  const { ip, minutes, reason } = await req.json();
  if (!ip) return NextResponse.json({ ok: false, error: "ip required" }, { status: 400 });

  const until =
    !minutes || Number(minutes) === 0
      ? null
      : new Date(Date.now() + Number(minutes) * 60 * 1000);

  await prisma.adminBannedIP.upsert({
    where: { ip },
    create: { ip, reason: reason ?? null, until },
    update: { reason: reason ?? null, until },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ip = new URL(req.url).searchParams.get("ip");
  if (!ip) return NextResponse.json({ ok: false, error: "ip required" }, { status: 400 });
  await prisma.adminBannedIP.delete({ where: { ip } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
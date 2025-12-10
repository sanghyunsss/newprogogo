// app/api/sms/optout/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const list = await prisma.smsOptOut.findMany({ orderBy: { id: "desc" } });
  return NextResponse.json({ list });
}

export async function POST(req: NextRequest) {
  const { to, reason } = await req.json();
  if (!to) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await prisma.smsOptOut.upsert({
    where: { to },
    update: { reason: reason ?? null },
    create: { to, reason: reason ?? null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");
  if (!to) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await prisma.smsOptOut.delete({ where: { to } });
  return NextResponse.json({ ok: true });
}
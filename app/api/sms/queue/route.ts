// app/api/sms/queue/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const list = await prisma.smsMessage.findMany({
    where: { scheduledAt: { not: null }, createdAt: { lt: new Date() } },
    orderBy: { scheduledAt: "asc" },
    include: { targets: true },
  });
  return NextResponse.json({ list });
}
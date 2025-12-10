// app/api/device-logs/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.max(1, Math.min(500, Number(searchParams.get("pageSize") || 50)));
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma.deviceControlLog.findMany({
      orderBy: { id: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true, createdAt: true, controlType: true, status: true, message: true,
        roomNumber: true, roomId: true, guestId: true,
        actor: true, actorName: true,            // ← 추가
      },
    }),
    prisma.deviceControlLog.count(),
  ]);

  return NextResponse.json({ rows, total, page });
}
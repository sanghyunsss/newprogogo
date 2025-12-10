// app/api/sms/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Kind = "checkin" | "checkout";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const takeParam = Number(searchParams.get("take") ?? "50");
  const pageParam = Number(searchParams.get("page") ?? "1");
  const kind = (searchParams.get("kind") as Kind | null) ?? null;
  const sinceRaw = searchParams.get("since"); // ISO (선택)

  const allowed = [50, 100, 300, 500] as const;
  const take = (allowed as readonly number[]).includes(takeParam) ? takeParam : 50;
  const page = pageParam > 0 ? pageParam : 1;
  const skip = (page - 1) * take;

  const where: {
    content?: Kind;
    createdAt?: { gte: Date };
  } = {};

  if (kind) where.content = kind;

  // since가 유효한 ISO일 때만 필터 적용
  if (sinceRaw) {
    const d = new Date(sinceRaw);
    if (!Number.isNaN(d.getTime())) where.createdAt = { gte: d };
  }

  const [total, rows] = await Promise.all([
    prisma.smsMessage.count({ where }),
    prisma.smsMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        targets: {
          select: {
            id: true,
            to: true,          // 연락처
            name: true,        // 이름
            var2: true,        // ✅ 호실(W-320호 등)
            resultCode: true,
            resultDesc: true,
          },
        },
      },
    }),
  ]);

  const list = rows.map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(), // 문자열로 명시
    type: m.type,               // ALT/LMS 등
    status: m.status,           // requested/success/...
    refKey: m.refKey,
    messageKey: m.messageKey,
    templateCode: m.templateCode,
    content: m.content as Kind, // checkin | checkout
    guestToken: m.guestToken ?? null,
    targets: m.targets,
  }));

  const totalPages = Math.max(1, Math.ceil(total / take));
  return NextResponse.json({ ok: true, list, total, page, take, totalPages });
}
// app/api/sms/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cancelMessage } from "@/src/lib/ppurio";

type Kind = "checkin" | "checkout";

export async function POST(req: NextRequest) {
  try {
    const json = (await req.json().catch(() => null)) as {
      guestToken?: string;
      kind?: Kind;
    } | null;

    if (!json?.guestToken || !json?.kind) {
      return NextResponse.json({ error: "missing_params" }, { status: 400 });
    }

    // 최근 예약건(예약/대기) 중 messageKey 있는 건 취소
    const message = await prisma.smsMessage.findFirst({
      where: {
        guestToken: json.guestToken,
        content: json.kind,
        scheduledAt: { not: null },
        messageKey: { not: null },
        status: { in: ["pending", "requested"] }, // 예약 상태만
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, messageKey: true },
    });

    if (!message?.messageKey) {
      return NextResponse.json({ error: "no_reservation_found" }, { status: 404 });
    }

    // 🔐 푸리오에 취소 요청
    await cancelMessage({ messageKey: message.messageKey });

    // DB 상태 반영
    await prisma.smsMessage.update({
      where: { id: message.id },
      data: { status: "canceled" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
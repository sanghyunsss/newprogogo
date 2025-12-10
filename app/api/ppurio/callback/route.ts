// /app/api/ppurio/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type PpurioResult = {
  to?: string;
  name?: string;
  resultCode?: string;
  resultDesc?: string;
};

type PpurioCallback = {
  messageKey?: string;
  refKey?: string;
  status?: string;      // reserved/completed/failed/canceled ...
  sendTime?: string;    // yyyy-MM-dd HH:mm:ss 혹은 yyyy-MM-ddTHH:mm:ss
  results?: PpurioResult[];
};

// 푸리오 상태 → 내부 상태 매핑
function mapStatus(s?: string): "requested" | "success" | "failed" | "canceled" | undefined {
  if (!s) return undefined;
  const t = s.toLowerCase();
  if (t === "reserved" || t === "requested" || t === "accepted") return "requested";
  if (t === "completed" || t === "success") return "success";
  if (t === "failed") return "failed";
  if (t === "canceled" || t === "cancelled") return "canceled";
  return undefined; // 알 수 없는 값이면 업데이트하지 않음
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as PpurioCallback;

    if (!body.messageKey && !body.refKey) {
      return NextResponse.json({ ok: false, error: "no key" }, { status: 400 });
    }

    // refKey 우선, 없으면 messageKey
    const whereByKey =
      body.refKey
        ? { refKey: body.refKey }
        : body.messageKey
        ? { messageKey: body.messageKey }
        : null;

    if (!whereByKey) return NextResponse.json({ ok: true, ignored: true });

    // 여러 건 모두 조회
    const msgs = await prisma.smsMessage.findMany({
      where: whereByKey,
      include: { targets: true },
    });
    if (!msgs.length) return NextResponse.json({ ok: true, ignored: true });

    // 결과(전화번호 매칭) 갱신
    if (Array.isArray(body.results) && body.results.length) {
      const byPhone: Record<string, { targetId: number }> = {};
      for (const m of msgs) {
        for (const t of m.targets) {
          byPhone[t.to.replace(/\D/g, "")] = { targetId: t.id };
        }
      }
      for (const r of body.results) {
        const key = (r.to || "").replace(/\D/g, "");
        const hit = byPhone[key];
        if (hit) {
          await prisma.smsTarget.update({
            where: { id: hit.targetId },
            data: {
              resultCode: r.resultCode ?? undefined,
              resultDesc: r.resultDesc ?? undefined,
            },
          });
        }
      }
    }

    // 상태/예약시간/메시지키 갱신 — 해당 키의 모든 레코드에 일괄 적용
    await prisma.smsMessage.updateMany({
      where: whereByKey,
      data: {
        status: mapStatus(body.status),
        scheduledAt: body.sendTime
          ? new Date(body.sendTime.replace(" ", "T"))
          : undefined,
        messageKey: body.messageKey ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, updated: msgs.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
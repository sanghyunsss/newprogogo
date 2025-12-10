// app/api/ppurio/message/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  sendKakao,
  sendSms,
  type Target,
  type KakaoMessageType,
} from "@/src/lib/ppurio";

type Body = {
  // 공통
  targets?: Target[];
  sendTime?: string;              // yyyy-MM-ddTHH:mm:ss
  refKey?: string;
  duplicateFlag?: "Y" | "N";
  // 카카오(알림톡) 전용
  messageType?: KakaoMessageType; // "ALT" | "ALI" | "ALH" | "ALL"
  templateCode?: string;
  senderProfile?: string;
  // LMS 전용
  content?: string;
  subject?: string;
  from?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    if (!Array.isArray(body.targets) || body.targets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "targets required" },
        { status: 400 }
      );
    }

    const isKakao = !!(body.messageType && body.templateCode);

    if (isKakao) {
      // ▶ 카카오(알림톡)
      const res = await sendKakao({
        messageType: body.messageType as KakaoMessageType,
        templateCode: body.templateCode as string,
        targets: body.targets as Target[],
        sendTime: body.sendTime,
        refKey: body.refKey,
        duplicateFlag: body.duplicateFlag,
        senderProfile: body.senderProfile,
      });
      return NextResponse.json({ ok: true, channel: "kakao", ...res });
    } else {
      // ▶ 문자(LMS)
      if (!body.content) {
        return NextResponse.json(
          { ok: false, error: "content required for LMS" },
          { status: 400 }
        );
      }

      const res = await sendSms({
        content: body.content,
        targets: body.targets.map((t) => ({ to: t.to, name: t.name })),
        subject: body.subject,
        from: body.from,
        sendTime: body.sendTime,
        refKey: body.refKey,
        duplicateFlag: body.duplicateFlag,
      });
      return NextResponse.json({ ok: true, channel: "lms", ...res });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
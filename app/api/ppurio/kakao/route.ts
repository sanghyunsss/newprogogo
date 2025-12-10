// app/api/ppurio/kakao/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sendKakao, type Target, type KakaoMessageType } from "@/src/lib/ppurio";

type ReqBody = {
  messageType: KakaoMessageType;
  templateCode: string;
  targets: Target[];
  sendTime?: string;                // yyyy-MM-ddTHH:mm:ss
  duplicateFlag?: "Y" | "N";
  senderProfile?: string;
  // 카카오 실패 시 LMS 대체 발송 옵션
  resendLms?: {
    content: string;
    subject?: string;
    from?: string;
  };
};

// 카카오 발송 결과 타입 고정
type SendKakaoResult = { refKey: string; messageKey: string | null };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ReqBody;

    const res = (await sendKakao({
      messageType: body.messageType,
      templateCode: body.templateCode,
      targets: body.targets,
      sendTime: body.sendTime,
      duplicateFlag: body.duplicateFlag,
      senderProfile: body.senderProfile,
      // subject는 여기(카카오) 루트가 아니라 resendLms 안에서만 허용됩니다.
      ...(body.resendLms
        ? {
            resendLms: {
              content: body.resendLms.content,
              subject: body.resendLms.subject,
              from: body.resendLms.from,
            },
          }
        : {}),
    })) as SendKakaoResult;

    return NextResponse.json({ ok: true, refKey: res.refKey, messageKey: res.messageKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
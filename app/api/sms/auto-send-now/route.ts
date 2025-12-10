// app/api/sms/auto-send-now/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendKakao, type Target } from "@/src/lib/ppurio";

type Mode = "checkin" | "checkout";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 템플릿 텍스트 [*1*] [*2*] [*3*] 치환
function fillTemplate(
  tpl: string,
  v: { var1?: string; var2?: string; var3?: string },
): string {
  return (tpl || "")
    .replaceAll("[*1*]", v.var1 ?? "")
    .replaceAll("[*2*]", v.var2 ?? "")
    .replaceAll("[*3*]", v.var3 ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") as Mode) || "checkin";
    if (mode !== "checkin" && mode !== "checkout") {
      return NextResponse.json({ ok: false, error: "mode must be checkin|checkout" }, { status: 400 });
    }

    // 오늘 날짜 경계(로컬)
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // 템플릿 1회 조회
    const tplRow = await prisma.smsTemplate.findUnique({ where: { kind: mode } });
    const kakaoTemplateCode =
      tplRow?.templateCode ??
      (mode === "checkin" ? process.env.BIZPPURIO_TPL_CHECKIN! : process.env.BIZPPURIO_TPL_CHECKOUT!);
    const lmsSubject = tplRow?.subject || undefined;

    // 오늘 입실/퇴실 대상
    const guests = await prisma.dailyGuest.findMany({
      where: mode === "checkin"
        ? { startDate: { gte: start, lte: end } }
        : { endDate: { gte: start, lte: end } },
      include: { room: true },
      orderBy: { id: "asc" },
    });

    let sent = 0;
    let failed = 0;

    for (const g of guests) {
      const phone = (g.contact || "").replace(/\D/g, "");
      const roomNumber = g.room?.number ?? "";
      const roomType = g.roomType ?? "";
      const token = g.token ?? "";
      const name = g.name ?? "";

      const changeWord = { var1: roomType, var2: roomNumber, var3: token };
      const kakaoTargets: Target[] = [{ to: phone, name, changeWord }];

      const defaultText =
        mode === "checkin"
          ? `[모어댄] ${name}님 체크인 안내 · 객실 ${roomNumber} (${roomType}) · 가이드: https://admins.morethansc.co.kr/g/${token}`
          : `[모어댄] ${name}님 퇴실 안내 · 가이드: https://admins.morethansc.co.kr/g/${token}`;

      const lmsContent = fillTemplate(tplRow?.content ?? defaultText, changeWord);

      // 카카오로 보내되, 실패 시 LMS 자동 대체(resend)
      try {
        const kakaoRes = await sendKakao({
          messageType: "ALT",
          templateCode: kakaoTemplateCode,
          targets: kakaoTargets,
          duplicateFlag: "N",
          senderProfile: process.env.BIZPPURIO_SENDER_PROFILE,
          resendLms: {
            content: lmsContent,
            subject: lmsSubject,
            from: process.env.SMS_FALLBACK_FROM,
          },
        });

        await prisma.smsMessage.create({
          data: {
            refKey: kakaoRes.refKey,
            messageKey: kakaoRes.messageKey ?? "",
            type: "ALT",
            content: mode,
            fromNumber: process.env.SMS_FALLBACK_FROM!,
            senderProfile: process.env.BIZPPURIO_SENDER_PROFILE!,
            templateCode: kakaoTemplateCode,
            scheduledAt: null,
            status: "success",  // 접수 완료
            guestToken: token || null,
            targets: {
              create: [
                { to: phone, name, var1: roomType, var2: roomNumber, var3: token, resultCode: "1000" },
              ],
            },
          },
        });

        sent += 1;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await prisma.smsMessage.create({
          data: {
            refKey: "",
            messageKey: "",
            type: "ALT",
            content: `${mode}_kakao_failed`,
            fromNumber: process.env.SMS_FALLBACK_FROM!,
            senderProfile: process.env.BIZPPURIO_SENDER_PROFILE!,
            templateCode: kakaoTemplateCode,
            scheduledAt: null,
            status: "failed",
            guestToken: token || null,
            targets: {
              create: [
                { to: phone, name, var1: roomType, var2: roomNumber, var3: token, resultCode: "ERR", resultDesc: errMsg },
              ],
            },
          },
        });
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      date: ymd(today),
      mode,
      sent,
      failed,
      total: guests.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fail";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
// app/api/sms/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendKakao, type Target } from "@/src/lib/ppurio";

type Kind = "checkin" | "checkout";
type SendMode = "now" | "reserve";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function resolveKind(req: NextRequest, body: any): Kind {
  const qs = new URL(req.url).searchParams.get("kind") || "";
  const raw = (qs || body?.kind || body?.type || "").toString().toLowerCase().trim();
  return raw === "checkout" ? "checkout" : "checkin";
}

function resolveMode(req: NextRequest, body: any): { mode: SendMode; sendTime?: string } {
  const qsMode = (new URL(req.url).searchParams.get("mode") || "").toLowerCase().trim();
  const rawMode = (qsMode || body?.sendMode || "now").toString().toLowerCase().trim() as SendMode;
  if (rawMode === "reserve") {
    const t = (body?.sendTime || "").trim();
    if (!t) throw new Error("sendTime 이 필요합니다 (reserve 모드)");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(t)) {
      throw new Error("sendTime 형식이 올바르지 않습니다. 예) 2025-09-25T13:00 또는 2025-09-25T13:00:00");
    }
    return { mode: "reserve", sendTime: t.length === 16 ? `${t}:00` : t };
  }
  return { mode: "now" };
}

// 템플릿 변수 치환
function fillTemplate(tpl: string, v: { var1?: string; var2?: string; var3?: string }) {
  return (tpl || "")
    .replaceAll("[*1*]", v.var1 ?? "")
    .replaceAll("[*2*]", v.var2 ?? "")
    .replaceAll("[*3*]", v.var3 ?? "");
}

async function loadTemplate(kind: Kind) {
  const row = await prisma.smsTemplate.findUnique({ where: { kind } });
  const templateCode =
    row?.templateCode ??
    (kind === "checkin" ? process.env.BIZPPURIO_TPL_CHECKIN! : process.env.BIZPPURIO_TPL_CHECKOUT!);
  return { row, templateCode };
}

async function sendOne({
  kind,
  mode,
  sendTime,
  guest,
}: {
  kind: Kind;
  mode: SendMode;
  sendTime?: string;
  guest: {
    name: string;
    contact: string;
    token: string | null;
    roomType: string | null;
    room?: { number?: string | null } | null;
  };
}) {
  const phone = guest.contact.replace(/\D/g, "");
  const roomNumber = guest.room?.number ?? "";
  const roomType = guest.roomType ?? "";
  const token = guest.token ?? "";
  const name = guest.name;

  const { row: tplRow, templateCode } = await loadTemplate(kind);

  const changeWord = { var1: roomType, var2: roomNumber, var3: token };
  const kakaoTargets: Target[] = [{ to: phone, name, changeWord }];

  const defaultText =
    kind === "checkin"
      ? `[모어댄] ${name}님 체크인 안내 · 객실 ${roomNumber} (${roomType}) · 가이드: https://admins.morethansc.co.kr/g/${token}`
      : `[모어댄] ${name}님 퇴실 안내 · 가이드: https://admins.morethansc.co.kr/g/${token}`;

  const lmsContent = fillTemplate(tplRow?.content ?? defaultText, changeWord);

  // 발송
  const kakaoRes = await sendKakao({
    messageType: "ALT",
    templateCode,
    targets: kakaoTargets,
    duplicateFlag: "N",
    senderProfile: process.env.BIZPPURIO_SENDER_PROFILE,
    ...(mode === "reserve" && sendTime ? { sendTime } : {}),
    resendLms: {
      content: lmsContent,
      from: process.env.SMS_FALLBACK_FROM,
      subject: tplRow?.subject || "모어댄 안내",
    },
  });

  // 로그 기록
  await prisma.smsMessage.create({
    data: {
      refKey: kakaoRes.refKey,
      messageKey: kakaoRes.messageKey ?? "",
      type: "ALT",
      content: kind,
      fromNumber: process.env.SMS_FALLBACK_FROM!,
      senderProfile: process.env.BIZPPURIO_SENDER_PROFILE!,
      templateCode,
      scheduledAt: mode === "reserve" && sendTime ? new Date(sendTime) : null,
      status: "requested",
      guestToken: token || null,
      targets: {
        create: [
          {
            to: phone,
            name,
            var1: roomType,
            var2: roomNumber,
            var3: token,
            resultCode: "1000",
          },
        ],
      },
    },
  });

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      // 단건 모드일 때 쓰는 바디
      guestId?: number;
      name?: string;
      roomType?: string;
      roomNumber?: string;
      phone?: string;
      token?: string;
      // 공통
      kind?: string;
      type?: string;
      sendMode?: SendMode;
      sendTime?: string;
    };

    const kind = resolveKind(req, body);
    const { mode, sendTime } = resolveMode(req, body);

    // 단건: guestId 가 있으면 해당 손님만 전송
    if (body.guestId) {
      const g = await prisma.dailyGuest.findUnique({
        where: { id: Number(body.guestId) },
        include: { room: true },
      });
      if (!g) return NextResponse.json({ ok: false, error: "guest not found" }, { status: 404 });

      // 클라이언트가 보낸 값이 있으면 우선 사용(없으면 DB값 사용)
      const guest = {
        name: (body.name ?? g.name) || "",
        contact: (body.phone ?? g.contact) || "",
        token: body.token ?? g.token ?? null,
        roomType: (body.roomType ?? g.roomType) ?? null,
        room: g.room ?? (body.roomNumber ? { number: body.roomNumber } : null),
      };

      await sendOne({ kind, mode, sendTime, guest });
      return NextResponse.json({ ok: true, kind, mode, sent: 1 });
    }

    // 일괄: 오늘 입실/퇴실 대상 전체
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const guests = await prisma.dailyGuest.findMany({
      where:
        kind === "checkin"
          ? { startDate: { gte: start, lte: end } }
          : { endDate: { gte: start, lte: end } },
      include: { room: true },
      orderBy: { id: "asc" },
    });

    if (!guests.length) {
      return NextResponse.json({ ok: true, date: ymd(today), kind, mode, total: 0, sent: 0, failed: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const g of guests) {
      try {
        await sendOne({
          kind,
          mode,
          sendTime,
          guest: {
            name: g.name,
            contact: g.contact,
            token: g.token,
            roomType: g.roomType,
            room: g.room,
          },
        });
        sent += 1;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "kakao send fail";
        // 실패 로그도 남김
        const phone = g.contact.replace(/\D/g, "");
        const roomNumber = g.room?.number ?? "";
        const roomType = g.roomType ?? "";
        await prisma.smsMessage.create({
          data: {
            refKey: "",
            messageKey: "",
            type: "ALT",
            content: `${kind}_failed`,
            fromNumber: process.env.SMS_FALLBACK_FROM!,
            senderProfile: process.env.BIZPPURIO_SENDER_PROFILE!,
            templateCode: (await loadTemplate(kind)).templateCode,
            scheduledAt: null,
            status: "failed",
            guestToken: g.token ?? null,
            targets: {
              create: [
                {
                  to: phone,
                  name: g.name,
                  var1: roomType,
                  var2: roomNumber,
                  var3: g.token ?? "",
                  resultCode: "ERR",
                  resultDesc: errMsg,
                },
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
      kind,
      mode,
      total: guests.length,
      sent,
      failed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fail";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
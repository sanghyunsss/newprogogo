// app/api/sms/auto-reserve/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Mode = "checkin" | "checkout";

/* ===== ENV ===== */
const PPURIO_BASE = process.env.BIZPPURIO_BASE || "https://message.ppurio.com";
const BIZPPURIO_ACCOUNT = process.env.BIZPPURIO_ACCOUNT || "";
const BIZPPURIO_AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY || ""; // 연동관리 인증키
const SENDER_PROFILE = process.env.BIZPPURIO_SENDER_PROFILE || "@morethan";
const TPL_CHECKIN = process.env.BIZPPURIO_TPL_CHECKIN || "";
const TPL_CHECKOUT = process.env.BIZPPURIO_TPL_CHECKOUT || "";
const SMS_FALLBACK_FROM = process.env.SMS_FALLBACK_FROM || "";
const REQ_MIN_GAP_MS = 3 * 60 * 1000; // 최소 3분 이후 예약 가능

/* ===== Token (Basic -> Bearer) with cache ===== */
let cachedToken = "";
let tokenExpiresAt = 0; // epoch(ms)

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;

  // Basic {base64(account:apiKey)}
  const basic = Buffer.from(`${BIZPPURIO_ACCOUNT}:${BIZPPURIO_AUTH_KEY}`).toString("base64");

  // 공식 샘플 기준: Body 없이 Basic 헤더만 보내 토큰 발급
  const resp = await fetch(`${PPURIO_BASE}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });

  const raw = await resp.text();
  if (!resp.ok) throw new Error(`token error: ${raw}`);

  // 응답 키 방어(camel/snake, token/accessToken)
  interface TokenResp {
    token?: string;
    accessToken?: string;
    access_token?: string;
    expiresIn?: number;
    expires_in?: number;
  }
  const j: TokenResp = JSON.parse(raw);
  const token = j.token ?? j.accessToken ?? j.access_token;
  if (!token) throw new Error("token error: no token");

  const expiresSec = j.expiresIn ?? j.expires_in ?? 24 * 60 * 60; // 기본 24h
  cachedToken = token;
  tokenExpiresAt = now + expiresSec * 1000;
  return cachedToken;
}

/* ===== Types ===== */
interface KakaoTargetSend {
  to: string;
  name?: string;
  changeWord?: {
    var1?: string;
    var2?: string;
    var3?: string;
    var4?: string;
    var5?: string;
    var6?: string;
    var7?: string;
  };
}
interface KakaoResend {
  messageType: "SMS" | "LMS" | "MMS";
  content: string;
  from: string;
  subject?: string;
}
interface KakaoSendPayload {
  account: string;
  messageType: "ALT";
  senderProfile: string;
  templateCode: string;
  duplicateFlag: "Y" | "N";
  isResend: "Y" | "N";
  targetCount: number;
  targets: KakaoTargetSend[];
  refKey: string;
  sendTime?: string; // yyyy-MM-ddTHH:mm:ss
  resend?: KakaoResend; // ← 객체(배열 아님)
}
interface PpurioResp {
  code?: number;
  description?: string;
  message?: string;                  // 일부 케이스
  result?: "success" | "partial" | "failed";
  messageKey?: string;
  messsageKey?: string;              // 오타 방어
  refKey?: string;
}

/* ===== Route ===== */
export async function POST(req: NextRequest) {
  try {
    if (!BIZPPURIO_ACCOUNT || !BIZPPURIO_AUTH_KEY) {
      return NextResponse.json({ ok: false, error: "ppurio env missing" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get("mode") as Mode) || "checkin";
    if (!["checkin", "checkout"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "invalid mode" }, { status: 400 });
    }

    // Body: sendTime (필수, 로컬 기준 yyyy-MM-ddTHH:mm:ss)
    const body = (await req.json().catch(() => ({}))) as { sendTime?: string };
    const sendTime = (body?.sendTime || "").trim();
    if (!sendTime) {
      return NextResponse.json({ ok: false, error: "sendTime required" }, { status: 400 });
    }

    // 오늘 대상 조회
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const start = new Date(`${y}-${m}-${d}T00:00:00`);
    const end = new Date(`${y}-${m}-${d}T23:59:59`);

    const guests = await prisma.dailyGuest.findMany({
      where:
        mode === "checkin"
          ? { startDate: { gte: start, lte: end } }
          : { endDate: { gte: start, lte: end } },
      include: { room: true },
      orderBy: { id: "asc" },
    });
    if (!guests.length) {
      return NextResponse.json({ ok: true, mode, count: 0 });
    }

    // 3분 룰 체크
    const canReserve = new Date(sendTime).getTime() - Date.now() >= REQ_MIN_GAP_MS;

    // targets (문서 스펙: to, name, changeWord.*)
    const targets: KakaoTargetSend[] = guests.map((g) => ({
      to: (g.contact || "").replace(/\D/g, ""),
      name: g.name || "",
      changeWord: {
        var1: g.roomType || "",
        var2: g.room?.number || "",
        var3: g.token || "",
      },
    }));

    // 대체문자
    const resend: KakaoResend | undefined = SMS_FALLBACK_FROM
      ? {
          messageType: "LMS",
          from: SMS_FALLBACK_FROM,
          subject: "모어댄 안내",
          content:
            mode === "checkin"
              ? "[모어댄] 입실 안내입니다. (카카오 발송 실패로 문자 대체)"
              : "[모어댄] 퇴실 안내입니다. (카카오 발송 실패로 문자 대체)",
        }
      : undefined;

// payload
const refKey = `bulk-${mode}-${Date.now()}`;
const payload: KakaoSendPayload = {
  account: BIZPPURIO_ACCOUNT,
  messageType: "ALT",
  senderProfile: SENDER_PROFILE,
  templateCode: mode === "checkin" ? TPL_CHECKIN : TPL_CHECKOUT,
  duplicateFlag: "N",
  isResend: "Y",
  targetCount: targets.length,
  targets,
  refKey,
  ...(canReserve ? { sendTime } : {}),
  ...(resend ? { resend } : {}),
};

/* =========================================
 *  1) 먼저 DB에 pending으로 기록해두기
 * ========================================= */
const created = await prisma.smsMessage.create({
  data: {
    refKey,
    messageKey: null,
    type: "ALT",
    content: mode,
    fromNumber: SMS_FALLBACK_FROM || null,
    senderProfile: SENDER_PROFILE,
    templateCode: mode === "checkin" ? TPL_CHECKIN : TPL_CHECKOUT,
    scheduledAt: canReserve ? new Date(sendTime) : null,
    status: "pending",
    targets: {
      create: guests.map((g) => ({
        to: (g.contact || "").replace(/\D/g, ""),
        name: g.name || "",
        var1: g.roomType || "",
        var2: g.room?.number || "",
        var3: g.token || "",
      })),
    },
  },
});

/* =========================================
 *  2) 발송 시도 (토큰 만료 시 1회 재시도)
 * ========================================= */
const token = await getAccessToken();
const url = `${PPURIO_BASE}/v1/kakao`;

let r = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
});

if (r.status === 401) {
  const t2 = await getAccessToken();
  r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t2}` },
    body: JSON.stringify(payload),
  });
}

const raw = await r.text();
let j: PpurioResp = {};
try { j = JSON.parse(raw) as PpurioResp; } catch {}

/* =========================================
 *  3) 결과에 따라 방금 만든 레코드 업데이트
 * ========================================= */
if (!r.ok) {
  await prisma.smsMessage.update({
    where: { id: created.id },
    data: {
      status: "failed",
      // 필요하면 targets에도 실패 사유 반영 가능
    },
  });
  const errMsg = j.description || j.message || raw || "ppurio send failed";
  return NextResponse.json({ ok: false, error: errMsg }, { status: 502 });
}

// 정상 수락되면 상태/키 업데이트
await prisma.smsMessage.update({
  where: { id: created.id },
  data: {
    messageKey: j.messageKey || j.messsageKey || null,
    status: canReserve ? "requested" : "success", // ← 이렇게 간단히
  },
});

/* =========================================
 *  4) 응답
 * ========================================= */
return NextResponse.json({
  ok: true,
  mode,
  count: guests.length,
  reserved: canReserve,
  messageKey: j.messageKey || j.messsageKey || null,
});
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
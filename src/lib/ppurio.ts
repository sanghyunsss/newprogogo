// src/lib/ppurio.ts
import crypto from "node:crypto";

const BASE = process.env.BIZPPURIO_BASE!;
const ACCOUNT = process.env.BIZPPURIO_ACCOUNT!;
const AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY!;
const SENDER_PROFILE = process.env.BIZPPURIO_SENDER_PROFILE!;
const SMS_FROM = process.env.SMS_FALLBACK_FROM!;

/* ========= Types ========= */
export type KakaoMessageType = "ALT" | "ALI" | "ALH" | "ALL";

export type Target = {
  to: string;
  name?: string;
  changeWord?: {
    var1?: string; var2?: string; var3?: string; var4?: string; var5?: string; var6?: string; var7?: string;
  };
};

type PpurioToken = { token: string; type: "Bearer"; expired: string };

type PpurioSendRes = {
  code: number;
  description?: string;
  refKey?: string;
  messageKey?: string;
  messsageKey?: string; // 일부 응답 오타 방어
};

type PpurioCancelRes = { code: number; description?: string };

type KakaoResendObj = {
  messageType: "SMS" | "LMS" | "MMS";
  content: string;
  from: string;
  subject?: string;
};

type KakaoBody = {
  account: string;
  messageType: KakaoMessageType;
  senderProfile: string;
  templateCode: string;
  duplicateFlag: "Y" | "N";
  isResend: "Y" | "N";
  targetCount: number;
  targets: Target[];
  refKey: string;
  sendTime?: string;
  resend?: KakaoResendObj; // 객체(배열 아님)
};

type LmsTarget = { to: string; name?: string };

type LmsBody = {
  account: string;
  messageType: "LMS";
  from: string;
  content: string;
  subject?: string;
  duplicateFlag: "Y" | "N";
  targetCount: number;
  targets: LmsTarget[];
  refKey: string;
  sendTime?: string;
};

/* ========= Token ========= */
export async function issueToken(): Promise<PpurioToken> {
  const basic = Buffer.from(`${ACCOUNT}:${AUTH_KEY}`).toString("base64");
  const r = await fetch(`${BASE}/v1/token`, { method: "POST", headers: { Authorization: `Basic ${basic}` } });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()) as PpurioToken;
}

/* ========= Unified sender ========= */
type SendKakaoParams = {
  channel: "kakao";
  messageType: KakaoMessageType;
  templateCode: string;
  targets: Target[];
  sendTime?: string;                 // yyyy-MM-ddTHH:mm:ss
  refKey?: string;
  duplicateFlag?: "Y" | "N";
  senderProfile?: string;
  // 카카오 실패 시 대체 LMS (선택)
  resendLms?: {
    content: string;
    from?: string;
    subject?: string;
  };
};

type SendLmsParams = {
  channel: "lms";
  content: string;
  targets: LmsTarget[];
  subject?: string;
  from?: string;
  sendTime?: string;                 // yyyy-MM-ddTHH:mm:ss
  refKey?: string;
  duplicateFlag?: "Y" | "N";
};

async function sendLmsInternal(
  token: string,
  body: LmsBody
): Promise<{ ok: boolean; res: PpurioSendRes; messageKey: string | null }> {
  const r = await fetch(`${BASE}/v1/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const res: PpurioSendRes = await r.json().catch(() => ({ code: 0 }));
  const ok = r.ok && Number(res.code) === 1000;
  return { ok, res, messageKey: res.messageKey ?? res.messsageKey ?? null };
}

export async function sendMessage(
  params: SendKakaoParams | SendLmsParams
): Promise<{ refKey: string; messageKey: string | null }> {
  const token = await issueToken();
  const refKey = params.refKey || crypto.randomBytes(16).toString("hex").slice(0, 32);

  if (params.channel === "kakao") {
    const kakaoBody: KakaoBody = {
      account: ACCOUNT,
      messageType: params.messageType,
      senderProfile: params.senderProfile || SENDER_PROFILE,
      templateCode: params.templateCode,
      duplicateFlag: params.duplicateFlag || "N",
      isResend: params.resendLms ? "Y" : "N",
      targetCount: params.targets.length,
      targets: params.targets,
      refKey,
      ...(params.sendTime ? { sendTime: params.sendTime } : {}),
      ...(params.resendLms
        ? {
            resend: {
              messageType: "LMS",
              from: params.resendLms.from || SMS_FROM,
              subject: params.resendLms.subject,
              content: params.resendLms.content,
            },
          }
        : {}),
    };

    // 1) 카카오 시도
    const r = await fetch(`${BASE}/v1/kakao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
      body: JSON.stringify(kakaoBody),
    });

    const j: PpurioSendRes = await r.json().catch(() => ({ code: 0 }));
    const kakaoOK = r.ok && Number(j.code) === 1000;

    if (kakaoOK) {
      return { refKey, messageKey: j.messageKey ?? j.messsageKey ?? null };
    }

    // 2) 카카오 실패 → 클라이언트 측 LMS 대체(옵션 켜진 경우)
    if (params.resendLms) {
      const lmsBody: LmsBody = {
        account: ACCOUNT,
        messageType: "LMS",
        from: params.resendLms.from || SMS_FROM,
        content: params.resendLms.content,
        subject: params.resendLms.subject,
        duplicateFlag: "N",
        targetCount: params.targets.length,
        targets: params.targets.map(t => ({ to: t.to, name: t.name })),
        refKey,
        ...(params.sendTime ? { sendTime: params.sendTime } : {}),
      };

      const lms = await sendLmsInternal(token.token, lmsBody);
      if (lms.ok) return { refKey, messageKey: lms.messageKey };

      // LMS도 실패하면 원래 카카오 실패 에러로 던짐
      throw new Error(`kakao send fail: ${JSON.stringify(j)}; lms fail: ${JSON.stringify(lms.res)}`);
    }

    // 대체 발송 옵션이 없으면 카카오 실패 그대로
    throw new Error(`kakao send fail: ${JSON.stringify(j)}`);
  }

  // channel === "lms"
  const lmsBody: LmsBody = {
    account: ACCOUNT,
    messageType: "LMS",
    from: params.from || SMS_FROM,
    content: params.content,
    subject: params.subject,
    duplicateFlag: params.duplicateFlag ?? "N",
    targetCount: params.targets.length,
    targets: params.targets,
    refKey,
    ...(params.sendTime ? { sendTime: params.sendTime } : {}),
  };

  const lms = await sendLmsInternal(token.token, lmsBody);
  if (!lms.ok) throw new Error(`lms send fail: ${JSON.stringify(lms.res)}`);
  return { refKey, messageKey: lms.messageKey };
}

/* ========= Cancel (Kakao) ========= */
type CancelBody = { account: string; messageKey?: string; refKey?: string };

export async function cancelKakao(
  args: { messageKey?: string; refKey?: string }
): Promise<true> {
  const token = await issueToken();

  // messageKey 또는 refKey 중 하나는 필수
  const payload: { account: string; messageKey?: string; refKey?: string } = {
    account: ACCOUNT,
    ...(args.messageKey ? { messageKey: args.messageKey } : {}),
    ...(args.refKey ? { refKey: args.refKey } : {}),
  };
  if (!payload.messageKey && !payload.refKey) {
    throw new Error("cancelKakao: messageKey or refKey required");
  }

  const r = await fetch(`${BASE}/v1/cancel/kakao`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.token}` },
    body: JSON.stringify(payload),
  });

  const j = (await r.json().catch(() => ({ code: 0 }))) as { code: number; description?: string };
  if (!r.ok || Number(j.code) !== 1000) {
    throw new Error(`cancel fail: ${r.status} ${JSON.stringify(j)}`);
  }
  return true;
}

/* ========= Backward-compatible aliases ========= */
export const sendKakao = (p: Omit<SendKakaoParams, "channel">) =>
  sendMessage({ channel: "kakao", ...p });

export const sendSms = (p: Omit<SendLmsParams, "channel">) =>
  sendMessage({ channel: "lms", ...p });

export { cancelKakao as cancelMessage };
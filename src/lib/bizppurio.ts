// src/lib/bizppurio.ts
const BASE = process.env.BIZPPURIO_BASE ?? "https://api-biz.ppurio.com";
const AUTH_ID = process.env.BIZPPURIO_ID!;          // 계정(아이디)
const AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY!;   // 연동 인증키
const ACCOUNT  = process.env.BIZPPURIO_ACCOUNT ?? AUTH_ID; // 보통 동일

type TokenResp = { token: string; type: "Bearer"; expired: string };

let memToken: { value: string; expAt: number } | null = null;

async function issueToken(): Promise<string> {
  const basic = Buffer.from(`${AUTH_ID}:${AUTH_KEY}`).toString("base64");
  const r = await fetch(`${BASE}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!r.ok) throw new Error("token_failed");
  const j = (await r.json()) as TokenResp;
  // expired: "yyyyMMddHHmmss" → 30초 여유
  const yyyy = j.expired.slice(0,4), MM=j.expired.slice(4,6), dd=j.expired.slice(6,8);
  const hh=j.expired.slice(8,10), mi=j.expired.slice(10,12), ss=j.expired.slice(12,14);
  const exp = new Date(`${yyyy}-${MM}-${dd}T${hh}:${mi}:${ss}Z`).getTime() - 30_000;
  memToken = { value: j.token, expAt: exp };
  return j.token;
}

export async function getToken() {
  if (memToken && Date.now() < memToken.expAt) return memToken.value;
  return issueToken();
}

// 알림톡(우선) + 자동 대체발송(SMS)
export async function sendKakaoWithSmsFallback(payload: {
  messageType: "ALT" | "ALI" | "ALH" | "ALL";
  senderProfile: string;
  templateCode: string;
  content: string;               // 템플릿 변수 포함 가능
  subject?: string;
  from: string;                  // 대체발송 SMS 발신번호
  targets: Array<{
    to: string;
    name?: string;
    changeWord?: { var1?: string; var2?: string; var3?: string; var4?: string; var5?: string; var6?: string; var7?: string };
  }>;
  refKey: string;
  sendTime?: string | null;      // yyyy-MM-DDTHH:mm:ss
}) {
  const token = await getToken();

  const body = {
    account: ACCOUNT,
    messageType: payload.messageType,
    senderProfile: payload.senderProfile,
    templateCode: payload.templateCode,
    duplicateFlag: "N",
    targetCount: payload.targets.length,
    targets: payload.targets,
    refKey: payload.refKey,
    isResend: "Y",
    sendTime: payload.sendTime ?? undefined,
    resend: {
      messageType: payload.subject ? "LMS" : "SMS",
      content: payload.content,   // 동일 내용 사용 (원하면 별도로 구성)
      from: payload.from,
      subject: payload.subject,
    },
  };

  const r = await fetch(`${BASE}/v1/kakao`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  // 토큰 만료 등으로 401/3005 → 1회 재인증 후 재시도
  if (r.status === 401 || r.status === 400 || r.status === 3005) {
    memToken = null;
    const newTok = await getToken();
    const r2 = await fetch(`${BASE}/v1/kakao`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${newTok}`,
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify(body),
    });
    if (!r2.ok) throw new Error(`kakao_send_failed:${r2.status}`);
    return r2.json();
  }

  if (!r.ok) throw new Error(`kakao_send_failed:${r.status}`);
  return r.json();
}
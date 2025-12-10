// app/api/ppurio/cancel/kakao/route.ts
import { NextRequest, NextResponse } from "next/server";
import { issueToken } from "@/src/lib/ppurio";

const BASE = process.env.BIZPPURIO_BASE || "https://message.ppurio.com";
const ACCOUNT = process.env.BIZPPURIO_ACCOUNT || "";
const AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY || "";

type ReqBody = { messageKey?: string };
type CancelResp = { code?: number; description?: string };

const mask = (s?: string) =>
  !s ? "(empty)" : s.length <= 12 ? s : `${s.slice(0,6)}...${s.slice(-6)}`;

const toTokenString = (t: unknown) =>
  typeof t === "string" ? t : (t && typeof t === "object" && "token" in t
    ? (t as { token?: unknown }).token
    : "") as string;

const looksLikeJwt = (t: string) => t.split(".").length === 3 && !/[\s'"]/.test(t);

async function callCancel(token: string, account: string, messageKey: string) {
  const body = JSON.stringify({ account, messageKey });
  console.log("[ppurio/cancel] call → Authorization: Bearer", mask(token), "body=", body);

  const r = await fetch(`${BASE}/v1/cancel/kakao`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  const raw = await r.text();
  let json: CancelResp = {};
  try { json = JSON.parse(raw) as CancelResp; } catch {}
  console.log("[ppurio/cancel] resp", r.status, raw);
  return { r, json, raw };
}

export async function POST(req: NextRequest) {
  try {
    const { messageKey } = (await req.json().catch(() => ({}))) as ReqBody;
    if (!messageKey) return NextResponse.json({ ok: false, error: "missing messageKey" }, { status: 400 });
    if (!ACCOUNT || !AUTH_KEY) return NextResponse.json({ ok: false, error: "ppurio env missing" }, { status: 500 });

    const t1 = await issueToken();
    const token1 = toTokenString(t1) || "";
    console.log("[ppurio/cancel] token.len=", token1.length, "jwtLike=", looksLikeJwt(token1));

    if (!token1 || !looksLikeJwt(token1)) {
      return NextResponse.json(
        { ok: false, error: "bad token from /v1/token", hint: "check ACCOUNT/AUTH_KEY & IP allowlist" },
        { status: 400 }
      );
    }

    // 1차
    let { r, json, raw } = await callCancel(token1, ACCOUNT, messageKey);

    // 토큰 오류(3002/3005) 시 1회 재발급 후 재시도
    if (json.code === 3002 || json.code === 3005) {
      console.warn("[ppurio/cancel] token invalid → re-issue & retry");
      const t2 = await issueToken();
      const token2 = toTokenString(t2) || "";
      console.log("[ppurio/cancel] new token.len=", token2.length, "jwtLike=", looksLikeJwt(token2));
      ({ r, json, raw } = await callCancel(token2, ACCOUNT, messageKey));
    }

    if (json.code === 1000) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, ...json, raw }, { status: r.ok ? 400 : r.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
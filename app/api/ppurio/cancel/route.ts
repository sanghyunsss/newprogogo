// app/api/ppurio/cancel/route.ts
import { NextResponse } from "next/server";

const BASE = process.env.BIZPPURIO_BASE || "https://message.ppurio.com";
const ACCOUNT = process.env.BIZPPURIO_ACCOUNT || "";
const AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY || "";

type ReqBody = { messageKey?: string };
type TokenResp = { token?: string; accessToken?: string };
type CancelResp = { code: number; description?: string };

async function issueToken(): Promise<string> {
  const basic = Buffer.from(`${ACCOUNT}:${AUTH_KEY}`).toString("base64");
  const r = await fetch(`${BASE}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
    cache: "no-store",
  });
  const raw = await r.text();
  let j: TokenResp = {};
  try { j = JSON.parse(raw) as TokenResp; } catch {}
  const token = j.token ?? j.accessToken ?? "";
  if (!r.ok || !token) throw new Error(`token fail: ${r.status} ${raw}`);
  return token;
}

export async function POST(req: Request) {
  try {
    const { messageKey } = (await req.json().catch(() => ({}))) as ReqBody;
    if (!messageKey) return NextResponse.json({ error: "missing messageKey" }, { status: 400 });
    if (!ACCOUNT || !AUTH_KEY) return NextResponse.json({ error: "ppurio env missing" }, { status: 500 });

    const token = await issueToken();
    const r = await fetch(`${BASE}/v1/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account: ACCOUNT, messageKey }),
      cache: "no-store",
    });

    const raw = await r.text();
    let j: CancelResp = { code: 0 };
    try { j = JSON.parse(raw) as CancelResp; } catch {}
    if (!r.ok) return NextResponse.json({ ok: false, ...j, raw }, { status: r.status });
    return NextResponse.json({ ok: true, ...j });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
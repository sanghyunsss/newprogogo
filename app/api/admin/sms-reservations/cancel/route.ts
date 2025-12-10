// app/api/admin/sms-reservations/cancel/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const PPURIO_BASE = process.env.BIZPPURIO_BASE || "https://message.ppurio.com";
const BIZPPURIO_ACCOUNT = process.env.BIZPPURIO_ACCOUNT || "";
const BIZPPURIO_AUTH_KEY = process.env.BIZPPURIO_AUTH_KEY || "";

let cachedToken = ""; let tokenExpiresAt = 0;
async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;
  const basic = Buffer.from(`${BIZPPURIO_ACCOUNT}:${BIZPPURIO_AUTH_KEY}`).toString("base64");
  const resp = await fetch(`${PPURIO_BASE}/v1/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error(raw);
  const j = JSON.parse(raw) as { accessToken: string; expiresIn?: number };
  cachedToken = j.accessToken; tokenExpiresAt = now + (j.expiresIn ?? 3600) * 1000;
  return cachedToken;
}

export async function POST(req: NextRequest) {
  try {
    const { messageKey } = (await req.json()) as { messageKey?: string };
    if (!messageKey) return NextResponse.json({ ok: false, error: "messageKey required" }, { status: 400 });

    const token = await getToken();
    const r = await fetch(`${PPURIO_BASE}/v1/cancel/kakao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ account: BIZPPURIO_ACCOUNT, messageKey }),
    });
    const raw = await r.text();
    if (!r.ok) return NextResponse.json({ ok: false, error: raw || "cancel failed" }, { status: 502 });

    await prisma.smsMessage.updateMany({ where: { messageKey }, data: { status: "canceled" } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
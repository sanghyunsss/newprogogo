// src/lib/itsokey.ts
import crypto from "crypto";

const BASE = (process.env.ITSOKEY_BASE ?? "").replace(/\/+$/, "");
const ACCESS_KEY = process.env.ITSOKEY_ACCESS_KEY ?? "";
const SECRET = process.env.ITSOKEY_SECRET ?? "";

/**
 * 인증방식 선택:
 *  - "A_BEARER": Authorization: Bearer <ACCESS_KEY>
 *  - "B_BASIC" : Authorization: Basic base64("<ACCESS_KEY>:<SECRET>")
 *  - "C_HMAC"  : X-ACCESS-KEY / X-TIMESTAMP / X-SIGNATURE (HMAC-SHA256)
 */
type Mode = "A_BEARER" | "B_BASIC" | "C_HMAC";
const MODE: Mode = "A_BEARER";

function authHeaders(path: string, body: string = ""): HeadersInit {
  if (MODE === "A_BEARER") {
    return { Authorization: `Bearer ${ACCESS_KEY}` };
  }
  if (MODE === "B_BASIC") {
    const b64 = Buffer.from(`${ACCESS_KEY}:${SECRET}`, "utf8").toString("base64");
    return { Authorization: `Basic ${b64}` };
  }
  // C_HMAC
  const t = Math.floor(Date.now() / 1000).toString();
  const data = t + path + body;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  return {
    "X-ACCESS-KEY": ACCESS_KEY,
    "X-TIMESTAMP": t,
    "X-SIGNATURE": sig,
  };
}

export async function itsokeyPost(path: string, payload: unknown) {
  if (!BASE) throw new Error("ITSOKEY_BASE missing");
  const url = `${BASE}${path}`;
  const body = JSON.stringify(payload ?? {});
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...authHeaders(path, body),
  };
  const r = await fetch(url, { method: "POST", headers, body });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`ITSOKEY ${r.status} ${r.statusText} ${text}`);
  }
  return r.json().catch(() => ({}));
}

export async function itsokeyGet(path: string) {
  if (!BASE) throw new Error("ITSOKEY_BASE missing");
  const headers: HeadersInit = { ...authHeaders(path) };
  const r = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`ITSOKEY ${r.status} ${r.statusText} ${text}`);
  }
  return r.json().catch(() => ({}));
}
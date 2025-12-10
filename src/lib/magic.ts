import crypto from "crypto";

const SECRET = process.env.MAGIC_LINK_SECRET!;
if (!SECRET) throw new Error("MAGIC_LINK_SECRET is missing");

type Payload = { gid: number; exp: number };

function b64url(buf: Buffer | string) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function b64urlJson(obj: Record<string, unknown>) {
  return b64url(Buffer.from(JSON.stringify(obj)));
}
function hmac(data: string) {
  return b64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

export function signToken(guestId: number, endDate: string) {
  const expDate = new Date(`${endDate}T23:59:00`);
  const exp = Math.floor(expDate.getTime() / 1000);

  const header: Record<string, string> = { alg: "HS256", typ: "JWT" };
  const payload: Payload = { gid: guestId, exp };

  const h = b64urlJson(header);
  const p = b64urlJson(payload);
  const sig = hmac(`${h}.${p}`);

  return `${h}.${p}.${sig}`;
}

export function verifyToken(token: string): Payload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;

  const goodSig = hmac(`${h}.${p}`);
  if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(goodSig))) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
  ) as Payload;

  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
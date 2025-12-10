// app/api/admin/humax/register/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

const HUMAX_BASE = process.env.HUMAX_API_BASE!;
const HUMAX_CONSOLE = process.env.HUMAX_CONSOLE_URL!;
const HUMAX_USER = process.env.HUMAX_USER || process.env.HUMAX_ID || "";
const HUMAX_PASS = process.env.HUMAX_PASS || process.env.HUMAX_PW || "";
const HUMAX_SITE_ID = process.env.SITE_ID!;
const HUMAX_PRODUCT_ITEM_ID = process.env.PRODUCT_ITEM_ID!;

const digits = (s: string) => (s || "").replace(/\D+/g, "");
const ymd = (s: string) => (s || "").slice(0, 10);
const toMsKST = (s: string) =>
  new Date((s.length > 10 ? s : s + " 00:00").replace(" ", "T") + ":00+09:00").getTime();

async function humaxLogin() {
  const fd = new FormData();
  fd.append("username", HUMAX_USER);
  fd.append("password", HUMAX_PASS);
  fd.append("grant_type", "password");
  const r = await fetch(`${HUMAX_BASE}/auth`, {
    method: "POST",
    headers: { actor: "mhp.console", origin: HUMAX_CONSOLE, referer: HUMAX_CONSOLE + "/" },
    body: fd,
    cache: "no-store",
  });
  const cookies = (r.headers as any).getSetCookie?.() ?? [];
  let cookie = "";
  if (cookies.length) cookie = cookies.map((s: string) => s.split(";")[0]).join("; ");
  else {
    const one = r.headers.get("set-cookie");
    if (one) cookie = one.split(";")[0];
  }
  const txt = await r.text();
  let json: any = null; try { json = JSON.parse(txt); } catch {}
  if (!r.ok) throw new Error(`AUTH ${r.status}: ${txt}`);
  return { cookie, token: json?.access_token as string | undefined };
}

async function humaxRegister(args: {
  plate: string; name: string; contact: string; checkinAt: string; checkoutAt: string;
}) {
  const fromAt = toMsKST(`${ymd(args.checkinAt)} 00:00`);
  const toAt   = toMsKST(`${ymd(args.checkoutAt)} 15:00`);
  const auth = await humaxLogin();

  const headers: Record<string, string> = {
    Actor: "mhp.console",
    Origin: HUMAX_CONSOLE,
    Referer: HUMAX_CONSOLE + "/",
    "Content-Type": "application/json",
  };
  if (auth.cookie) headers.Cookie = auth.cookie;
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const phone = digits(args.contact);
  const body = {
    itemType: "TERM",
    itemSubType: "STORE_TERMS",
    productItemId: HUMAX_PRODUCT_ITEM_ID,
    plateNumber: args.plate,
    fromAt,
    toAt,
    itemName: "호텔투숙객무료",
    useState: "Y",
    user: {
      name: args.name || "",
      phone,
      tel: phone,
      mobile: phone,
      phoneNumber: phone,
      model: "",
      address: "",
      memo: "",
    },
  };

  const url = `${HUMAX_BASE}/o.productItems.registration.vehicle.use/${HUMAX_SITE_ID}`;
  const r = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body), cache: "no-store" });
  const txt = await r.text();
  return { ok: r.ok, status: r.status, text: txt };
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const id = Number(b?.id) || 0;                  // ✅ 전달받은 로그 id(선택)
    const plate = String(b?.carNo ?? "").trim();
    const name  = String(b?.name ?? "");
    const contactRaw = String(b?.contact ?? "");
    const checkinAt  = String(b?.checkinAt ?? "");
    const checkoutAt = String(b?.checkoutAt ?? "");

    const phone = digits(contactRaw);
    const KOR_PLATE = /^\d{2,3}[가-힣]\d{4}$/;

    if (!plate || plate === "차량없음" || !KOR_PLATE.test(plate)) {
      return NextResponse.json({ error: "유효한 차량번호가 아닙니다." }, { status: 400 });
    }
    if (!checkinAt || !checkoutAt) {
      return NextResponse.json({ error: "checkinAt/checkoutAt 필요" }, { status: 400 });
    }
    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: "연락처가 없거나 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const r = await humaxRegister({ plate, name, contact: phone, checkinAt, checkoutAt });

    if (r.ok) {
      if (id > 0) {
        // ✅ 스키마에 존재하는 키(id)로 단건 업데이트
        await prisma.parkingLog.update({
          where: { id },
          data: { note: "휴맥스 등록", humaxSyncedAt: new Date(), humaxStatus: r.status } as any,
        });
      } else {
        // ✅ id가 없을 때 안전한 최소 조건만 사용
        await prisma.parkingLog.updateMany({
          where: { carNo: plate },
          data: { note: "휴맥스 등록", humaxSyncedAt: new Date(), humaxStatus: r.status } as any,
        });
      }
    }

    return NextResponse.json(r, { status: r.ok ? 200 : 500 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
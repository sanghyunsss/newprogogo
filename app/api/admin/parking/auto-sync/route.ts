// app/api/admin/parking/auto-sync/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

/* ===== ENV ===== */
const CRON_KEY = process.env.PARKING_SYNC_KEY || "R4nDomKey123";
const HUMAX_BASE = process.env.HUMAX_API_BASE!;
const HUMAX_CONSOLE = process.env.HUMAX_CONSOLE_URL!;
const HUMAX_USER = process.env.HUMAX_USER || process.env.HUMAX_ID || "";
const HUMAX_PASS = process.env.HUMAX_PASS || process.env.HUMAX_PW || "";
const HUMAX_SITE_ID = process.env.SITE_ID!;
const HUMAX_PRODUCT_ITEM_ID = process.env.PRODUCT_ITEM_ID!;

/* ===== utils ===== */
const digits = (s: string) => (s || "").replace(/\D+/g, "");
const ymd = (s: string) => (s || "").slice(0, 10);
const toMsKST = (s: string) =>
  new Date((s.length > 10 ? s : s + " 00:00").replace(" ", "T") + ":00+09:00").getTime();

// 국내 번호판 간단 검증
const KOR_PLATE = /^\d{2,3}[가-힣]\d{4}$/;

/* ===== Humax ===== */
async function humaxLogin() {
  if (!HUMAX_USER || !HUMAX_PASS) {
    throw new Error(
      `HUMAX_USER/HUMAX_PASS 누락: USER="${HUMAX_USER}", PASS="${HUMAX_PASS ? "****" : ""}"`
    );
  }
  if (!HUMAX_BASE || !HUMAX_CONSOLE) {
    throw new Error(
      `HUMAX_BASE/HUMAX_CONSOLE 누락: BASE="${HUMAX_BASE}", CONSOLE="${HUMAX_CONSOLE}"`
    );
  }

  const fd = new FormData();
  fd.append("username", HUMAX_USER);
  fd.append("password", HUMAX_PASS);
  fd.append("grant_type", "password");

  const url = `${HUMAX_BASE}/auth`;
  console.log("[auto-sync] humaxLogin 시작:", { url, HUMAX_USER });

  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { actor: "mhp.console", origin: HUMAX_CONSOLE, referer: HUMAX_CONSOLE + "/" },
      body: fd,
      cache: "no-store",
    });
  } catch (e: any) {
    console.error("[auto-sync] humaxLogin fetch 예외:", e);
    throw new Error(`humaxLogin fetch 실패: ${String(e?.message || e)}`);
  }

  const cookies = (r.headers as any).getSetCookie?.() ?? [];
  let cookie = "";
  if (cookies.length) cookie = cookies.map((s: string) => s.split(";")[0]).join("; ");
  else {
    const one = r.headers.get("set-cookie");
    if (one) cookie = one.split(";")[0];
  }

  const txt = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(txt);
  } catch {
    // JSON 아닐 수도 있으니 무시
  }

  console.log("[auto-sync] humaxLogin 응답:", {
    status: r.status,
    ok: r.ok,
    bodySample: txt.slice(0, 200),
  });

  if (!r.ok) {
    throw new Error(`AUTH ${r.status}: ${txt}`);
  }

  return { cookie, token: json?.access_token as string | undefined };
}

// 연락처 기반 등록
async function humaxRegisterOne(
  args: {
    plate: string;
    name: string;
    contact: string;
    checkinAt: string;
    checkoutAt: string;
  },
  auth: { cookie?: string; token?: string }
) {
  const fromAt = toMsKST(`${ymd(args.checkinAt)} 00:00`);
  const toAt = toMsKST(`${ymd(args.checkoutAt)} 15:00`);

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
  console.log("[auto-sync] humaxRegisterOne 요청:", {
    url,
    plate: args.plate,
    name: args.name,
    phone,
    fromAt,
    toAt,
  });

  let r: Response;
  try {
    r = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body), cache: "no-store" });
  } catch (e: any) {
    console.error("[auto-sync] humaxRegisterOne fetch 예외:", e);
    throw new Error(`humaxRegisterOne fetch 실패: ${String(e?.message || e)}`);
  }

  const text = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}

  console.log("[auto-sync] humaxRegisterOne 응답:", {
    status: r.status,
    ok: r.ok,
    bodySample: text.slice(0, 200),
  });

  return { ok: r.ok, status: r.status, text, json };
}

/* ===== POST: run sync ===== */
export async function POST(req: NextRequest) {
  try {
    // ★ cron 과 맞추기: ?secret=... 또는 ?key=... 둘 다 허용
    const key =
      req.nextUrl.searchParams.get("secret") ||
      req.nextUrl.searchParams.get("key") ||
      "";

    if (key !== CRON_KEY) {
      console.warn("[auto-sync] forbidden: key mismatch", { got: key });
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20)));
    const days = Math.min(14, Math.max(0, Number(req.nextUrl.searchParams.get("days") || 3)));
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

    const since = days > 0 ? new Date(Date.now() - days * 86400000) : undefined;

    console.log("[auto-sync] 시작:", { limit, days, dryRun, since, HUMAX_BASE, HUMAX_USER });

    // 미등록만 + "차량없음" 제외
    const where: any = {
      AND: [
        { carNo: { not: "" } },
        { NOT: { carNo: { equals: "차량없음" } } },
        {
          OR: [
            { humaxSyncedAt: null },
            { humaxStatus: { not: 200 } },
            { note: { not: "휴맥스 등록" } },
          ],
        },
      ],
    };
    if (since) where.AND.push({ createdAt: { gte: since } });

    const targets = await prisma.parkingLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    console.log("[auto-sync] 대상 개수:", targets.length);

    if (targets.length === 0) {
      return NextResponse.json({ processed: 0, results: [] });
    }

    const auth = dryRun ? {} : await humaxLogin();

    const results: any[] = [];
    for (const t of targets) {
      const name = (t.guestName || "").trim();
      const plate = (t.carNo || "").trim();

      if (!plate || plate === "차량없음" || !KOR_PLATE.test(plate)) {
        results.push({ id: t.id, action: "SKIP(invalid-plate)", plate });
        continue;
      }

      let checkinAt = "";
      let checkoutAt = "";
      let guestContact = "";
      if (t.guestId) {
        const g = await prisma.dailyGuest.findUnique({ where: { id: t.guestId } });
        if (g) {
          checkinAt = g.startDate.toISOString().slice(0, 16).replace("T", " ");
          checkoutAt = g.endDate.toISOString().slice(0, 16).replace("T", " ");
          guestContact = (g as any).contact || "";
        }
      }
      if (!checkinAt) {
        const d = t.createdAt;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        checkinAt = `${y}-${m}-${day} 00:00`;
        const out = new Date(d.getTime() + 2 * 86400000);
        const ym =
          out.getFullYear() +
          "-" +
          String(out.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(out.getDate()).padStart(2, "0");
        checkoutAt = `${ym} 15:00`;
      }

      const rawContact = (
        (t as any).contact ||
        guestContact ||
        (t as any).guestPhone ||
        ""
      )
        .toString()
        .trim();
      const contact = digits(rawContact);

      if (!contact || contact.length < 8) {
        results.push({ id: t.id, action: "SKIP(no-contact)", plate });
        continue;
      }

      if (dryRun) {
        results.push({
          id: t.id,
          action: "SKIP(dryRun)",
          plate,
          contact,
          checkinAt,
          checkoutAt,
        });
        continue;
      }

      try {
        const r = await humaxRegisterOne(
          { plate, name, contact, checkinAt, checkoutAt },
          auth as any
        );
        if (r.ok) {
          await prisma.parkingLog.update({
            where: { id: t.id },
            data: { note: "휴맥스 등록", humaxSyncedAt: new Date(), humaxStatus: r.status } as any,
          });
        } else {
          await prisma.parkingLog.update({
            where: { id: t.id },
            data: { humaxStatus: r.status, humaxError: r.text } as any,
          });
        }
        results.push({ id: t.id, ok: r.ok, status: r.status, body: r.text });
      } catch (e: any) {
        console.error("[auto-sync] 개별 등록 에러:", { id: t.id, error: e });
        await prisma.parkingLog.update({
          where: { id: t.id },
          data: { humaxStatus: -1, humaxError: String(e?.message || e) } as any,
        });
        results.push({ id: t.id, ok: false, error: String(e?.message || e) });
      }
    }

    const processed = results.filter((r) => r.ok).length;
    console.log("[auto-sync] 완료:", { processed, total: results.length });
    return NextResponse.json({ processed, total: results.length, results });
  } catch (e: any) {
    console.error("[auto-sync] 최상위 에러:", e);
    return NextResponse.json(
      {
        error: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
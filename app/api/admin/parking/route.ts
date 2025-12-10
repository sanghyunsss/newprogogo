// app/api/admin/parking/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

/* ---------- utils ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHm  = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toYmdHm = (d: Date) => `${toYmd(d)} ${toHm(d)}`;

function parseYmdLocal(s?: string | null) {
  if (!s) return undefined;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
const onlyDigits = (s: string) => (s || "").replace(/\D+/g, "");
const ymd = (s: string) => (s || "").slice(0, 10);
const toMsKST = (s: string) =>
  new Date((s.length > 10 ? s : s + " 00:00").replace(" ", "T") + ":00+09:00").getTime();

// 국내 번호판 간단 검증
const KOR_PLATE = /^\d{2,3}[가-힣]\d{4}$/;

/* ---------- Humax helpers ---------- */
const HUMAX_BASE = process.env.HUMAX_API_BASE!;
const HUMAX_CONSOLE = process.env.HUMAX_CONSOLE_URL!;
const HUMAX_USER = process.env.HUMAX_USER || process.env.HUMAX_ID || "";
const HUMAX_PASS = process.env.HUMAX_PASS || process.env.HUMAX_PW || "";
const HUMAX_SITE_ID = process.env.SITE_ID!;
const HUMAX_PRODUCT_ITEM_ID = process.env.PRODUCT_ITEM_ID!;

async function humaxLogin() {
  if (!HUMAX_USER || !HUMAX_PASS) throw new Error("HUMAX_USER/HUMAX_PASS 필요");
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

/** 연락처 기반 등록 */
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

  const phone = onlyDigits(args.contact);

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

/* ---------- GET: 목록 ---------- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startStr = url.searchParams.get("start");
    const endStr   = url.searchParams.get("end");
    const page     = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize") || "50")));

    const start = parseYmdLocal(startStr);
    const end   = parseYmdLocal(endStr);
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (start) {
      where.createdAt = where.createdAt ?? {};
      where.createdAt.gte = start;
    }
    if (end) {
      where.createdAt = where.createdAt ?? {};
      where.createdAt.lte = endOfDay(end);
    }

    const [total, logs] = await Promise.all([
      prisma.parkingLog.count({ where }),
      prisma.parkingLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const guestIds = Array.from(new Set(logs.map(l => l.guestId).filter((v): v is number => typeof v === "number")));
    const guests = guestIds.length
      ? await prisma.dailyGuest.findMany({ where: { id: { in: guestIds } }, include: { room: true } })
      : [];
    const gMap = new Map<number, (typeof guests)[number]>();
    for (const g of guests) gMap.set(g.id, g);

    const rows = logs.map((l) => {
      const g = typeof l.guestId === "number" ? gMap.get(l.guestId) : undefined;
      const createdAt = new Date(l.createdAt);
      const checkinAt  = g?.startDate ? new Date(g.startDate) : (l as any).checkinAt ? new Date((l as any).checkinAt) : null;
      const checkoutAt = g?.endDate   ? new Date(g.endDate)   : (l as any).checkoutAt ? new Date((l as any).checkoutAt) : null;

      const noteRaw = (l as any).note ?? "";
      const synced = (l as any).humaxSyncedAt ? true : /휴맥스 등록/.test(noteRaw);
      const note = synced ? (noteRaw?.includes("휴맥스 등록") ? noteRaw : (noteRaw ? `${noteRaw} | 휴맥스 등록` : "휴맥스 등록")) : noteRaw;

      return {
        id: l.id,
        createdAtISO: createdAt.toISOString(),
        createdAtYmd: toYmdHm(createdAt),
        checkinAt:  checkinAt  ? toYmdHm(checkinAt)   : "",
        checkoutAt: checkoutAt ? toYmdHm(checkoutAt) : "",
        room: l.roomNumber || (g?.room ? g.room.number : "") || "",
        name: l.guestName || (g?.name ?? ""),
        contact: (g as any)?.contact ?? (l as any)?.contact ?? onlyDigits(l.roomNumber || ""),
        carNo: l.carNo ?? "",
        source: l.source ?? "",
        note,
        guestId: l.guestId ?? null,
        humaxSyncedAtISO: (l as any).humaxSyncedAt ? new Date((l as any).humaxSyncedAt).toISOString() : "",
        humaxStatus: (l as any).humaxStatus ?? null,
        humaxError: (l as any).humaxError ?? "",
      };
    });

    return NextResponse.json(
      { rows, total, page, pageSize },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("GET /api/admin/parking error:", e);
    return NextResponse.json({ error: "Failed to load parking logs" }, { status: 500 });
  }
}

/* ---------- POST: 신규등록 + 휴맥스 즉시등록 ---------- */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const carNo = String(b?.carNo || "").trim();
    const contactIn = String(b?.contact || "").trim();     // ✅ 연락처만 사용
    const name  = String(b?.name  || "");
    const checkinAt  = String(b?.checkinAt || "");
    const checkoutAt = String(b?.checkoutAt || "");
    const noteIn  = String(b?.note || "");
    const guestId = Number(b?.guestId) || undefined;

    const contactDigits = onlyDigits(contactIn);           // ✅ room fallback 제거
    if (!carNo || !contactDigits || contactDigits.length < 8 || !checkinAt || !checkoutAt) {
      return NextResponse.json(
        { error: "required: valid carNo, contact(>=8 digits), checkinAt, checkoutAt" },
        { status: 400 }
      );
    }
    if (carNo !== "차량없음" && !KOR_PLATE.test(carNo)) {
      return NextResponse.json({ error: "invalid carNo format" }, { status: 400 });
    }

    // 1) DB 저장 (roomNumber는 선택값이므로 전달된 값이 있어도 저장만)
    const created = await prisma.parkingLog.create({
      data: {
        carNo,
        guestName: name,
        source: "admin",
        note: noteIn,
        ...(guestId ? { guestId } : {}),
        ...(b?.room ? { roomNumber: String(b.room).trim() } : {}),
        contact: contactDigits,
      } as any,
    });

    // 2) 차량없음이면 휴맥스 전송 건너뜀
    if (carNo === "차량없음") {
      return NextResponse.json({ ok: true, id: created.id, humax: { ok: false, status: 0, text: "skip: 차량없음" } });
    }

    // 3) 휴맥스 등록(연락처 기반)
    let humax: { ok: boolean; status: number; text: string } = { ok: false, status: 0, text: "" };
    try {
      humax = await humaxRegister({ plate: carNo, name, contact: contactDigits, checkinAt, checkoutAt });
      if (humax.ok) {
        const prev = noteIn || "";
        const nextNote = prev ? `${prev} | 휴맥스 등록` : "휴맥스 등록";
        await prisma.parkingLog.update({
          where: { id: created.id },
          data: { note: nextNote, humaxSyncedAt: new Date(), humaxStatus: humax.status } as any,
        });
      } else {
        await prisma.parkingLog.update({
          where: { id: created.id },
          data: { humaxStatus: humax.status, humaxError: humax.text } as any,
        });
      }
    } catch (err: any) {
      await prisma.parkingLog.update({
        where: { id: created.id },
        data: { humaxStatus: -1, humaxError: String(err?.message || err) } as any,
      });
    }

    return NextResponse.json({ ok: true, id: created.id, humax });
  } catch (e) {
    console.error("POST /api/admin/parking error:", e);
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}

/* ---------- DELETE ---------- */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
    await prisma.parkingLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/admin/parking error:", e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
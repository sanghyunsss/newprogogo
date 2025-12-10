/// app/api/r/[id]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

type ParamsPlain = { params: { id: string } };
type ParamsPromise = { params: Promise<{ id: string }> };
type Ctx = ParamsPlain | ParamsPromise;

type Body = { action: "checkin" | "checkout" };

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toHm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function noStoreJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPromise<T>(v: unknown): v is Promise<T> {
  return typeof v === "object" && v !== null && typeof (v as { then?: unknown }).then === "function";
}

async function getParams(ctx: Ctx): Promise<{ id: string }> {
  const maybe = (ctx as { params: unknown }).params;
  if (isPromise<{ id: string }>(maybe)) return await maybe;
  return maybe as { id: string };
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await getParams(ctx);
  const guestId = Number(id);
  if (!Number.isFinite(guestId)) return noStoreJson({ error: "Invalid id" }, 400);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return noStoreJson({ error: "Invalid JSON body" }, 400);
  }
  if (body.action !== "checkin" && body.action !== "checkout") {
    return noStoreJson({ error: "Invalid action" }, 400);
  }

  const guest = await prisma.dailyGuest.findUnique({
    where: { id: guestId },
    include: { room: { select: { number: true } } },
  });
  if (!guest) return noStoreJson({ error: "Not found" }, 404);

  // ✅ 호실이 없는 경우 기록 금지
  if (guest.roomId == null) {
    return noStoreJson(
      {
        error: "Room not assigned",
        message: "호실이 배정되지 않아 체크인/체크아웃을 기록할 수 없습니다.",
      },
      400
    );
  }

  // 동일 타입 중복 방지
  const dup = await prisma.event.findFirst({
    where: { guestId: guest.id, type: body.action },
  });
  if (dup) {
    const already =
      body.action === "checkin" ? { checkedIn: true, checkedOut: false } : { checkedIn: true, checkedOut: true };
    return noStoreJson({ error: `Already ${body.action}ed`, ...already }, 409);
  }

  const now = new Date();
  await prisma.event.create({
    data: {
      roomId: guest.roomId, // roomId는 위에서 null 아님을 보장
      guestId: guest.id,
      type: body.action,
      ts: now,
      verified: true,
      dateKey: toYmd(now),
    },
  });

  if (body.action === "checkin") {
    return noStoreJson({
      success: true,
      action: "checkin",
      checkedIn: true,
      checkedOut: false,
      actual: {
        checkinDate: toYmd(now),
        checkinTime: toHm(now),
        checkoutDate: null,
        checkoutTime: null,
      },
    });
  }

  // checkout
  return noStoreJson({
    success: true,
    action: "checkout",
    checkedIn: true,
    checkedOut: true,
    actual: {
      checkinDate: null,
      checkinTime: null,
      checkoutDate: toYmd(now),
      checkoutTime: toHm(now),
    },
  });
}
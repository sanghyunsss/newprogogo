// app/api/rooms/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractRoomNumberInt } from "@/src/lib/roomNumber";

type ParamContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> };

const ok = <T,>(data: T, status = 200) => NextResponse.json(data, { status });
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

const toNull = (v: unknown) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s.length ? s : null;
};

export async function GET(_req: NextRequest, ctx: ParamContext) {
  const { id } = "then" in ctx.params ? await ctx.params : ctx.params;
  const rid = Number(id);
  if (!Number.isFinite(rid)) return bad("invalid id");
  const row = await prisma.room.findUnique({ where: { id: rid } });
  if (!row) return bad("not_found", 404);
  return ok(row);
}

export async function PUT(req: NextRequest, ctx: ParamContext) {
  const { id } = "then" in ctx.params ? await ctx.params : ctx.params;
  const rid = Number(id);
  if (!Number.isFinite(rid)) return bad("invalid id");

  const body = (await req.json()) as {
    number?: string;
    isActive?: boolean;
    deviceId?: string | null;
    spaceId?: string | null;
    name?: string | null;
    roomType?: string | null;  // ✅ 추가
    contact?: string | null;   // (스키마에 있으면)
    carNo?: string | null;     // (스키마에 있으면)
  };

  const before = await prisma.room.findUnique({ where: { id: rid } });
  if (!before) return bad("not_found", 404);

  // Prisma가 아직 생성되지 않았거나 타입에 필드가 반영되지 않았을 때를 위해
  // 교집합 타입으로 확장 필드를 허용
  const base: Prisma.RoomUpdateInput = {
    number: body.number?.trim() || undefined,
    numberSort: body.number ? extractRoomNumberInt(body.number) : undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    deviceId: body.deviceId === undefined ? undefined : toNull(body.deviceId),
    spaceId: body.spaceId === undefined ? undefined : toNull(body.spaceId),
    name: body.name === undefined ? undefined : toNull(body.name),
  };

  const extras: {
    roomType?: string | null;
    contact?: string | null;
    carNo?: string | null;
  } = {
    roomType: body.roomType === undefined ? undefined : toNull(body.roomType),
    contact: body.contact === undefined ? undefined : toNull(body.contact),
    carNo: body.carNo === undefined ? undefined : toNull(body.carNo),
  };

  const data = { ...base, ...extras } as Prisma.RoomUpdateInput;

  const updated = await prisma.room.update({ where: { id: rid }, data });

  const actor = req.headers.get("x-actor") || "admin";
  await prisma.roomChangeLog.create({
    data: {
      roomId: rid,
      actor,
      changes: {
        at: new Date().toISOString(),
        before,
        after: updated,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return ok(updated);
}

export async function DELETE(_req: NextRequest, ctx: ParamContext) {
  const { id } = "then" in ctx.params ? await ctx.params : ctx.params;
  const rid = Number(id);
  if (!Number.isFinite(rid)) return bad("invalid id");
  try {
    await prisma.room.delete({ where: { id: rid } });
    return ok({ success: true });
  } catch {
    return bad("delete_failed", 500);
  }
}
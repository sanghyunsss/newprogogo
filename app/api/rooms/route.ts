// app/api/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractRoomNumberInt } from "@/src/lib/roomNumber";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

type SortField = "number" | "name" | "isActive" | "roomType" | "numberSort";
type SortDir = "asc" | "desc";

function parseSort(q: string | null): { field: SortField; dir: SortDir } {
  const def = { field: "number" as SortField, dir: "asc" as SortDir };
  if (!q) return def;
  const [f, d] = q.split(":");
  const allowed: SortField[] = ["number", "name", "isActive", "roomType", "numberSort"];
  const okField: SortField = allowed.includes(f as SortField) ? (f as SortField) : def.field;
  const okDir: SortDir = d === "desc" ? "desc" : "asc";
  return { field: okField, dir: okDir };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userSort = parseSort(searchParams.get("sort"));
  const typeFilter = searchParams.get("type") ?? ""; // 객실타입 필터(optional)

  // ✅ where를 Prisma 타입으로 선언
  const where: Prisma.RoomWhereInput = {};
  if (typeFilter) where.roomType = typeFilter;

  // ✅ 사용자 정렬을 Prisma orderBy 타입으로 안전 매핑
  const userOrderBy: Prisma.RoomOrderByWithRelationInput | undefined =
    userSort.field === "number"
      ? { number: userSort.dir }
      : userSort.field === "name"
      ? { name: userSort.dir }
      : userSort.field === "isActive"
      ? { isActive: userSort.dir }
      : userSort.field === "roomType"
      ? { roomType: userSort.dir }
      : userSort.field === "numberSort"
      ? { numberSort: userSort.dir }
      : undefined;

  const rows = await prisma.room.findMany({
    where,
    orderBy: [
      { isActive: "desc" },   // 활성 먼저
      { numberSort: "asc" },  // 숫자 정렬
      { number: "asc" },      // 보조 정렬
      ...(userOrderBy ? [userOrderBy] : []),
    ],
    select: {
      id: true,
      number: true,
      numberSort: true,
      isActive: true,
      deviceId: true,
      spaceId: true,
      name: true,
      roomType: true,         // ✅ 추가 반환
    },
  });

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    number: string;
    isActive?: boolean;
    deviceId?: string | null;
    spaceId?: string | null;
  };

  const number = String(body.number ?? "").trim();
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });

  const isAdmin = req.headers.get("x-admin-token") === ADMIN_TOKEN;

  const toNull = (v: unknown) => {
    if (v === undefined) return undefined;
    const s = String(v ?? "").trim();
    return s.length ? s : null;
  };

  const data: {
    number: string;
    numberSort: number | null;
    isActive: boolean;
    deviceId?: string | null;
    spaceId?: string | null;
    name?: string | null;
  } = {
    number,
    numberSort: extractRoomNumberInt(number),
    isActive: body.isActive ?? true,
    name: null,
  };

  if (isAdmin) {
    const deviceId = toNull(body.deviceId);
    if (deviceId !== undefined) data.deviceId = deviceId;
    const spaceId = toNull(body.spaceId);
    if (spaceId !== undefined) data.spaceId = spaceId;
  } else if (body.deviceId !== undefined || body.spaceId !== undefined) {
    return NextResponse.json({ error: "admin only fields (deviceId/spaceId)" }, { status: 403 });
  }

  const created = await prisma.room.create({ data });
  return NextResponse.json({ success: true, room: created });
}
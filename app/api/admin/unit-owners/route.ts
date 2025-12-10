// src/app/api/admin/unit-owners/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function parseIntParam(v: string | null, def: number): number {
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// GET: 목록 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseIntParam(searchParams.get("page"), 1);
    const size = parseIntParam(searchParams.get("size"), 20);
    const keyword = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status") || "ALL";
    const ownerType = searchParams.get("ownerType") || "ALL";

    const where: any = {};

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { bizNo: { contains: keyword } },
        { roomInfo: { contains: keyword } },
        { phone: { contains: keyword } },
        { contractNo: { contains: keyword } },
      ];
    }

    if (status !== "ALL") {
      where.status = status;
    }

    if (ownerType !== "ALL") {
      where.ownerType = ownerType;
    }

    const total = await prisma.unitOwner.count({ where });

    const rows = await prisma.unitOwner.findMany({
      where,
      orderBy: [
        { roomInfo: "asc" },
        { name: "asc" },
        { id: "asc" },
      ],
      skip: (page - 1) * size,
      take: size,
    });

    return J({
      ok: true,
      rows,
      total,
      page,
      size,
    });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

// POST: 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = (body.name as string | undefined)?.trim();
    if (!name) {
      return J({ ok: false, error: "name_required" }, 400);
    }

    const data: any = {
      name,
      bizNo: body.bizNo || null,
      ceoName: body.ceoName || null,
      address: body.address || null,
      bizType: body.bizType || null,
      bizItem: body.bizItem || null,
      phone: body.phone || null,
      email: body.email || null,
      roomInfo: body.roomInfo || null,
      ownerType: body.ownerType || null,
      registryNo: body.registryNo || null,
      contractNo: body.contractNo || null,
      bankName: body.bankName || null,
      bankAccount: body.bankAccount || null,
      memo: body.memo || null,
      status: body.status || undefined,
    };

    const created = await prisma.unitOwner.create({ data });
    return J({ ok: true, id: created.id });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

// PATCH: 수정
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return J({ ok: false, error: "id_required" }, 400);
    }

    const data: any = {};
    if (body.name !== undefined) data.name = body.name || "";
    if (body.bizNo !== undefined) data.bizNo = body.bizNo || null;
    if (body.ceoName !== undefined) data.ceoName = body.ceoName || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.bizType !== undefined) data.bizType = body.bizType || null;
    if (body.bizItem !== undefined) data.bizItem = body.bizItem || null;
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.email !== undefined) data.email = body.email || null;
    if (body.roomInfo !== undefined) data.roomInfo = body.roomInfo || null;
    if (body.ownerType !== undefined) data.ownerType = body.ownerType || null;
    if (body.registryNo !== undefined) data.registryNo = body.registryNo || null;
    if (body.contractNo !== undefined) data.contractNo = body.contractNo || null;
    if (body.bankName !== undefined) data.bankName = body.bankName || null;
    if (body.bankAccount !== undefined) data.bankAccount = body.bankAccount || null;
    if (body.memo !== undefined) data.memo = body.memo || null;
    if (body.status !== undefined) data.status = body.status;

    await prisma.unitOwner.update({
      where: { id },
      data,
    });

    return J({ ok: true });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

// DELETE: 삭제 (?id=... 또는 body.id)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let idStr = searchParams.get("id");
    if (!idStr) {
      try {
        const body = await req.json();
        idStr = String(body.id || "");
      } catch {
        // ignore
      }
    }
    const id = Number(idStr);
    if (!Number.isFinite(id) || id <= 0) {
      return J({ ok: false, error: "id_required" }, 400);
    }

    await prisma.unitOwner.delete({ where: { id } });
    return J({ ok: true });
  } catch (e: any) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
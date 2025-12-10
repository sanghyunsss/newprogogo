// src/app/api/admin/tax-invoices/route.ts
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

/* GET: 목록 조회 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const page = parseIntParam(searchParams.get("page"), 1);
    const size = parseIntParam(searchParams.get("size"), 20);
    const yearMonth = searchParams.get("yearMonth") || "";
    const ownerName = searchParams.get("ownerName") || "";
    const status = searchParams.get("status") || "";

    const where: any = {};

    if (yearMonth) {
      where.yearMonth = yearMonth;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (ownerName) {
      where.owner = {
        name: {
          contains: ownerName,
        },
      };
    }

    const total = await prisma.reverseTaxInvoice.count({ where });

    const rows = await prisma.reverseTaxInvoice.findMany({
      where,
      include: {
        owner: true,
        company: true,
      },
      orderBy: [
        { issueDate: "desc" },
        { id: "desc" },
      ],
      skip: (page - 1) * size,
      take: size,
    });

    const data = rows.map((r) => ({
      id: r.id,
      issueDate: r.issueDate,
      supplyDate: r.supplyDate,
      yearMonth: r.yearMonth,
      title: r.title,
      qty: r.qty,
      unitPrice: r.unitPrice,
      supplyValue: r.supplyValue,
      vat: r.vat,
      total: r.total,
      roomInfo: r.roomInfo,
      memo: r.memo,
      status: r.status,
      owner: {
        id: r.owner.id,
        name: r.owner.name,
        bizNo: r.owner.bizNo ?? "",
        roomInfo: r.owner.roomInfo ?? "",
        ownerType: r.owner.ownerType ?? null,
        status: r.owner.status,
      },
      company: {
        id: r.company.id,
        name: r.company.name,
        bizNo: r.company.bizNo,
      },
    }));

    return J({
      ok: true,
      rows: data,
      total,
      page,
      size,
    });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

/* POST: 새 세금계산서 생성 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const ownerId = Number(body.ownerId);
    const companyId = Number(body.companyId);
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      return J({ ok: false, error: "ownerId_required" }, 400);
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return J({ ok: false, error: "companyId_required" }, 400);
    }

    const issueDateStr = body.issueDate as string | undefined;
    if (!issueDateStr) {
      return J({ ok: false, error: "issueDate_required" }, 400);
    }
    const issueDate = new Date(issueDateStr);

    const supplyDateStr = body.supplyDate as string | undefined;
    const supplyDate = supplyDateStr ? new Date(supplyDateStr) : null;

    const yearMonth = (body.yearMonth as string | undefined) || null;
    const title = (body.title as string | undefined) || null;

    const qty = Number(body.qty ?? 1);
    const unitPrice = Number(body.unitPrice ?? 0);

    let supplyValue = Number(body.supplyValue ?? 0);
    let vat = Number(body.vat ?? 0);
    let total = Number(body.total ?? 0);

    // 자동계산
    if (!supplyValue && qty > 0 && unitPrice > 0) {
      supplyValue = qty * unitPrice;
    }
    if (!vat && supplyValue) {
      vat = Math.round(supplyValue * 0.1);
    }
    if (!total && (supplyValue || vat)) {
      total = supplyValue + vat;
    }

    if (!supplyValue) {
      return J({ ok: false, error: "supplyValue_required" }, 400);
    }

    const roomInfo = (body.roomInfo as string | undefined) || null;
    const memo = (body.memo as string | undefined) || null;
    const status =
      (body.status as string | undefined) && body.status !== "ALL"
        ? body.status
        : "PENDING";

    const created = await prisma.reverseTaxInvoice.create({
      data: {
        ownerId,
        companyId,
        issueDate,
        supplyDate,
        yearMonth,
        title,
        qty,
        unitPrice,
        supplyValue,
        vat,
        total,
        roomInfo,
        memo,
        status,
      },
    });

    return J({ ok: true, id: created.id });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

/* PATCH: 수정 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return J({ ok: false, error: "id_required" }, 400);
    }

    const data: any = {};

    if (body.ownerId !== undefined) {
      const ownerId = Number(body.ownerId);
      if (Number.isFinite(ownerId) && ownerId > 0) data.ownerId = ownerId;
    }
    if (body.companyId !== undefined) {
      const companyId = Number(body.companyId);
      if (Number.isFinite(companyId) && companyId > 0) data.companyId = companyId;
    }
    if (body.issueDate !== undefined) {
      data.issueDate = new Date(body.issueDate);
    }
    if (body.supplyDate !== undefined) {
      data.supplyDate = body.supplyDate ? new Date(body.supplyDate) : null;
    }
    if (body.yearMonth !== undefined) {
      data.yearMonth = body.yearMonth || null;
    }
    if (body.title !== undefined) {
      data.title = body.title || null;
    }
    if (body.qty !== undefined) {
      data.qty = Number(body.qty) || 0;
    }
    if (body.unitPrice !== undefined) {
      data.unitPrice = Number(body.unitPrice) || 0;
    }
    if (body.supplyValue !== undefined) {
      data.supplyValue = Number(body.supplyValue) || 0;
    }
    if (body.vat !== undefined) {
      data.vat = Number(body.vat) || 0;
    }
    if (body.total !== undefined) {
      data.total = Number(body.total) || 0;
    }
    if (body.roomInfo !== undefined) {
      data.roomInfo = body.roomInfo || null;
    }
    if (body.memo !== undefined) {
      data.memo = body.memo || null;
    }
    if (body.status !== undefined) {
      data.status = body.status;
    }

    // 공급가액/세액/합계 보정
    if (
      data.supplyValue !== undefined ||
      data.vat !== undefined ||
      data.total !== undefined
    ) {
      const supplyValue =
        data.supplyValue !== undefined ? data.supplyValue : undefined;
      const vat = data.vat !== undefined ? data.vat : undefined;
      let total = data.total !== undefined ? data.total : undefined;

      if (supplyValue !== undefined && vat === undefined) {
        data.vat = Math.round(supplyValue * 0.1);
      }
      if (supplyValue !== undefined && data.vat !== undefined && total === undefined) {
        data.total = supplyValue + data.vat;
      }
    }

    await prisma.reverseTaxInvoice.update({
      where: { id },
      data,
    });

    return J({ ok: true });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
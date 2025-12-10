// src/app/api/admin/tax-invoices/[id]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const idNum = Number(context.params.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return J({ ok: false, error: "bad_id" }, 400);
    }

    const invoice = await prisma.reverseTaxInvoice.findUnique({
      where: { id: idNum },
      include: {
        owner: true,
        company: true,
      },
    });

    if (!invoice) {
      return J({ ok: false, error: "not_found" }, 404);
    }

    const resp = {
      ok: true,
      invoice: {
        id: invoice.id,
        issueDate: invoice.issueDate,
        supplyDate: invoice.supplyDate,
        yearMonth: invoice.yearMonth,
        title: invoice.title,
        qty: invoice.qty,
        unitPrice: invoice.unitPrice,
        supplyValue: invoice.supplyValue,
        vat: invoice.vat,
        total: invoice.total,
        roomInfo: invoice.roomInfo,
        memo: invoice.memo,
        status: invoice.status,
      },
      // 공급자(구분소유자)
      supplier: {
        id: invoice.owner.id,
        name: invoice.owner.name,
        bizNo: invoice.owner.bizNo ?? "",
        ceoName: invoice.owner.ceoName ?? "",
        address: invoice.owner.address ?? "",
        bizType: invoice.owner.bizType ?? "",
        bizItem: invoice.owner.bizItem ?? "",
        phone: invoice.owner.phone ?? "",
        email: invoice.owner.email ?? "",
        roomInfo: invoice.owner.roomInfo ?? "",

        // UnitOwner schema에 추가했다면 같이 내려주기
        registrationNo: (invoice.owner as any).registrationNo ?? null,
        contractNo: (invoice.owner as any).contractNo ?? null,
        bankName: (invoice.owner as any).bankName ?? null,
        bankAccount: (invoice.owner as any).bankAccount ?? null,
        isCorporate: (invoice.owner as any).isCorporate ?? null,
        ownerStatus: (invoice.owner as any).ownerStatus ?? null,
      },
      // 공급받는자(모어댄속초해변점)
      receiver: {
        id: invoice.company.id,
        name: invoice.company.name,
        bizNo: invoice.company.bizNo,
        ceoName: invoice.company.ceoName ?? "",
        address: invoice.company.address ?? "",
        bizType: invoice.company.bizType ?? "",
        bizItem: invoice.company.bizItem ?? "",
        phone: invoice.company.phone ?? "",
        email: invoice.company.email ?? "",
      },
    };

    return J(resp);
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
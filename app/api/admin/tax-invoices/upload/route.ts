// src/app/api/admin/tax-invoices/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * 엑셀 형식 (첫 번째 시트 기준, 헤더 예시)
 *
 * ownerId      (필수, 숫자; UnitOwner.id)
 * companyId    (필수, 숫자; Company.id)
 * yearMonth    (필수, "2025-11")
 * issueDate    (선택, "2025-11-30" 형태; 없으면 yearMonth 말일)
 * supplyValue  (필수, 공급가액)
 * vat          (선택, 없으면 supplyValue * 0.1)
 * total        (선택, 없으면 supplyValue + vat)
 * title        (선택, 없으면 `${yearMonth} 위탁운영수수료`)
 * qty          (선택, 없으면 1)
 * unitPrice    (선택, 없으면 supplyValue)
 * roomInfo     (선택, 객실/계약)
 * memo         (선택)
 * status       (선택, "PENDING" / "REQUESTED" / "ISSUED" / "CANCELED")
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return J({ ok: false, error: "file_required" }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return J({ ok: false, error: "sheet_not_found" }, 400);
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

    let created = 0;
    const errors: { row: number; message: string }[] = [];

    const parseYearMonth = (ym: string) => {
      const s = ym.trim();
      if (!/^\d{4}-\d{2}$/.test(s)) return null;
      const [y, m] = s.split("-").map(Number);
      return { y, m };
    };

    const lastDayOfMonth = (y: number, m: number) =>
      new Date(y, m, 0).getDate();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNo = i + 2;

      const ownerId = Number(r.ownerId ?? r.OwnerId ?? r.소유자ID);
      const companyId = Number(r.companyId ?? r.CompanyId ?? r.회사ID);
      const ymStr = String(r.yearMonth ?? r.정산월 ?? "").trim();
      const svRaw = r.supplyValue ?? r.공급가액;

      if (!Number.isFinite(ownerId) || ownerId <= 0) {
        errors.push({ row: rowNo, message: "ownerId(구분소유자ID) 오류" });
        continue;
      }
      if (!Number.isFinite(companyId) || companyId <= 0) {
        errors.push({ row: rowNo, message: "companyId(회사ID) 오류" });
        continue;
      }
      if (!ymStr) {
        errors.push({ row: rowNo, message: "yearMonth(정산월) 누락" });
        continue;
      }
      const ym = parseYearMonth(ymStr);
      if (!ym) {
        errors.push({ row: rowNo, message: "yearMonth 형식 오류(YYYY-MM)" });
        continue;
      }
      const supplyValue = Number(svRaw);
      if (!Number.isFinite(supplyValue) || supplyValue <= 0) {
        errors.push({ row: rowNo, message: "supplyValue(공급가액) 오류" });
        continue;
      }

      const vatRaw = r.vat ?? r.세액;
      let vat = Number(vatRaw);
      if (!Number.isFinite(vat) || vat < 0) {
        vat = Math.round(supplyValue * 0.1);
      }

      const totalRaw = r.total ?? r.합계금액;
      let total = Number(totalRaw);
      if (!Number.isFinite(total) || total <= 0) {
        total = supplyValue + vat;
      }

      const title =
        String(r.title || r.품목 || "").trim() ||
        `${ymStr} 위탁운영수수료`;

      const qtyRaw = r.qty ?? r.수량;
      const qty = Number(qtyRaw) && Number(qtyRaw) > 0 ? Number(qtyRaw) : 1;

      const unitPriceRaw = r.unitPrice ?? r.단가;
      const unitPrice =
        Number(unitPriceRaw) && Number(unitPriceRaw) > 0
          ? Number(unitPriceRaw)
          : supplyValue;

      const roomInfo = String(r.roomInfo || r.호실 || r.계약번호 || "").trim();
      const memo = String(r.memo || r.비고 || "").trim();

      const statusRaw = String(r.status || "").trim().toUpperCase();
      const status =
        statusRaw === "REQUESTED" ||
        statusRaw === "ISSUED" ||
        statusRaw === "CANCELED"
          ? statusRaw
          : "PENDING";

      const issueDateStr = String(r.issueDate || r.작성일자 || "").trim();
      let issueDate: Date;
      if (issueDateStr && /^\d{4}-\d{2}-\d{2}$/.test(issueDateStr)) {
        issueDate = new Date(issueDateStr);
      } else {
        const last = lastDayOfMonth(ym.y, ym.m);
        issueDate = new Date(ym.y, ym.m - 1, last);
      }

      const supplyDateStr = String(r.supplyDate || r.공급시기 || "").trim();
      let supplyDate: Date | null = null;
      if (supplyDateStr && /^\d{4}-\d{2}-\d{2}$/.test(supplyDateStr)) {
        supplyDate = new Date(supplyDateStr);
      } else {
        supplyDate = issueDate;
      }

      try {
        await prisma.reverseTaxInvoice.create({
          data: {
            ownerId,
            companyId,
            issueDate,
            supplyDate,
            yearMonth: ymStr,
            title,
            qty,
            unitPrice,
            supplyValue,
            vat,
            total,
            roomInfo: roomInfo || null,
            memo: memo || null,
            status,
          },
        });
        created++;
      } catch (e: any) {
        console.error("tax-invoice upload error row", rowNo, e);
        errors.push({ row: rowNo, message: e?.message || "db_error" });
      }
    }

    return J({ ok: true, created, errors });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
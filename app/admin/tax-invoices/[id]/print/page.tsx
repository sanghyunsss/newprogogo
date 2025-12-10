// src/app/admin/tax-invoices/[id]/print/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import TaxInvoicePrint, { ViewData } from "./client";

type PageProps = {
  params: { id: string };
};

/** Date → "YYYY-MM-DD" 문자열 */
function toDateStr(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function TaxInvoicePrintPage({ params }: PageProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div style={{ padding: 20 }}>
        잘못된 세금계산서 ID 입니다: {params.id}
      </div>
    );
  }

  try {
    // ===== 세금계산서 1건 + 공급자(소유자) + 공급받는자(회사) 조회 =====
    const invoice = await prisma.reverseTaxInvoice.findUnique({
      where: { id },
      include: {
        owner: true,   // UnitOwner (공급자)
        company: true, // Company  (공급받는자)
      },
    });

    if (!invoice || !invoice.owner || !invoice.company) {
      return (
        <div style={{ padding: 20 }}>
          세금계산서를 찾을 수 없습니다. (id: {id})
        </div>
      );
    }

    const owner = invoice.owner;     // 공급자(구분소유자)
    const company = invoice.company; // 공급받는자(모어댄속초해변점)

    // 작성일자 / 공급시기
    const issueDate = invoice.issueDate;
    const supplyDate = invoice.supplyDate ?? invoice.issueDate;

    // 품목 칸에 들어갈 월/일 (공급시기 기준)
    const itemMonth = supplyDate ? String(supplyDate.getMonth() + 1) : "";
    const itemDay = supplyDate ? String(supplyDate.getDate()) : "";

    // 공란수(일단 10으로 고정 – 필요하면 나중에 조정)
    const emptyLines = 10;

    // ===== DB → 인쇄 컴포넌트용 데이터 매핑 =====
    const data: ViewData = {
      // 공급자(소유자)
      supplierBizNo: owner.bizNo ?? "",
      supplierName: owner.name,
      supplierCeo: owner.ceoName ?? owner.name,
      supplierAddr: owner.address ?? "",
      supplierBizType: owner.bizType ?? "",
      supplierBizItem: owner.bizItem ?? "",

      // 공급받는자(회사)
      buyerBizNo: company.bizNo,
      buyerName: company.name,
      buyerCeo: company.ceoName ?? company.name,
      buyerAddr: company.address ?? "",
      buyerBizType: company.bizType ?? "",
      buyerBizItem: company.bizItem ?? "",

      // 작성일자
      issueDate: toDateStr(issueDate),

      // 공란수
      emptyLines,

      // 품목 1행
      itemMonth,
      itemDay,
      itemName:
        invoice.title ?? `${invoice.yearMonth ?? ""} 위탁운영 수수료`,
      itemSpec: invoice.roomInfo ?? "",
      itemQty: String(invoice.qty ?? 1),
      itemUnitPrice: String(invoice.unitPrice ?? 0),
      itemSupply: String(invoice.supplyValue ?? 0),
      itemTax: String(invoice.vat ?? 0),
      itemRemark: invoice.memo ?? "",

      // 금액들
      totalAmount: String(invoice.total ?? 0),        // 합계금액
      supplyAmount: String(invoice.supplyValue ?? 0), // 공급가액 합계
      taxAmount: String(invoice.vat ?? 0),            // 세액 합계

      // 책번호/일련번호/코드 (당장은 빈 값)
      bookYear: "", // 필요하면 issueDate.getFullYear() 로 채우기
      serialNo: "",
      code7: "",
    };

    // 레이아웃의 <main> 안에 이 컴포넌트가 그대로 들어간다
    return <TaxInvoicePrint data={data} variant="supplier" />;
  } catch (err: any) {
    console.error(err);
    return (
      <div
        style={{
          padding: 20,
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
        }}
      >
        세금계산서 조회 중 오류가 발생했습니다.

        {"\n\n"}
        {String(err?.message ?? err)}
      </div>
    );
  }
}
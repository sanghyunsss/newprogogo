// src/app/admin/tax-invoices/[id]/print/client.tsx

"use client";

import React, { useEffect } from "react";

/* ====================== 화면에 쓸 데이터 타입 ====================== */
export type ViewData = {
  // 공급자
  supplierBizNo: string;
  supplierName: string;
  supplierCeo: string;
  supplierAddr: string;
  supplierBizType: string;
  supplierBizItem: string;

  // 공급받는자
  buyerBizNo: string;
  buyerName: string;
  buyerCeo: string;
  buyerAddr: string;
  buyerBizType: string;
  buyerBizItem: string;

  // 작성일자(=공급시기)
  issueDate: string; // "YYYY-MM-DD" 또는 "YYYYMMDD"

  // 공란수(미사용 품목 행 수)
  emptyLines: number;

  // 1번 품목
  itemMonth: string; // "11"
  itemDay: string; // "19"
  itemName: string;
  itemSpec: string;
  itemQty: string;
  itemUnitPrice: string;
  itemSupply: string;
  itemTax: string;
  itemRemark?: string;

  // 금액
  totalAmount: string; // 합계금액 전체
  supplyAmount: string; // 공급가액 합계
  taxAmount: string; // 세액 합계

  // 책번호 (선택)
  bookYear?: string; // "2025"
  serialNo?: string; // "00087"
  code7?: string; // 7자리 코드 "K019466" 처럼
};

/* ====================== 유틸 함수 ====================== */
function onlyDigits(str: string | number | null | undefined): string {
  if (str == null) return "";
  return String(str).replace(/[^0-9]/g, "");
}

function splitNumberToArray(numStr: string | number, len: number): string[] {
  const only = onlyDigits(numStr);
  const arr = only.split("");
  while (arr.length < len) arr.unshift("");
  return arr.slice(-len);
}

function parseDate(dateStr: string | null | undefined) {
  if (!dateStr) {
    return { year: "", month: "", day: "" };
  }
  const only = onlyDigits(dateStr);
  if (only.length < 8) return { year: "", month: "", day: "" };
  const year = only.slice(0, 4);
  const month = String(Number(only.slice(4, 6)));
  const day = String(Number(only.slice(6, 8)));
  return { year, month, day };
}

function formatAmount(str: string | number): string {
  const only = onlyDigits(str);
  if (!only) return "";
  const n = Number(only);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ko-KR");
}

/* ====================== 메인 컴포넌트 ====================== */

type Props = {
  data: ViewData;
  variant?: "supplier" | "buyer";
};

export default function TaxInvoicePrint({ data, variant = "supplier" }: Props) {
  // 작성일자 분해
  const issue = parseDate(data.issueDate);

  // 금액 자리수 분해 (국세청 양식 기준)
  // 공급가액: 11칸 (백,십,억,천,백,십,만,천,백,십,일)
  // 세액: 11칸 (맨 왼쪽 1칸 라벨 없음, 그다음 십,억,천,백,십,만,천,백,십,일)
  const supplyDigits = splitNumberToArray(data.supplyAmount, 11);
  const taxDigits = splitNumberToArray(data.taxAmount, 11);

  const supplyLabels = [
    "백",
    "십",
    "억",
    "천",
    "백",
    "십",
    "만",
    "천",
    "백",
    "십",
    "일",
  ];

  const taxLabels = [
    "", // 맨 왼쪽 칸은 라벨 없음
    "십",
    "억",
    "천",
    "백",
    "십",
    "만",
    "천",
    "백",
    "십",
    "일",
  ];

  // 책번호 7자리 코드 (없으면 비워둠)
  const code7Arr = splitNumberToArray(data.code7 ?? "", 7);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // 필요 시 주석 해제
      // window.print();
    }
  }, []);

  return (
    <div id="tax-print-root"
      style={{
        width: "614px",
        margin: "0 auto",
        fontFamily: '"굴림", system-ui, sans-serif',
      }}
    >
      {/* ========================================= */}
      {/* =========== 공급자 보관용 (적색) ========= */}
      {/* ========================================= */}
      <table width={614} border={0} cellSpacing={0} cellPadding={0}>
        <tbody>
          <tr align="center">
            <td>
              {/* 세금계산서 시작 */}
              <table width={614} border={0} cellSpacing={0} cellPadding={0}>
                <tbody>
                  <tr>
                    <td colSpan={4} height={4}></td>
                  </tr>
                  <tr>
                    <td width={1} height={2}>
                      &nbsp;
                    </td>
                    <td
                      height={2}
                      width={310}
                      className="stylefont1"
                      valign="bottom"
                    >
                      <font color="red">[별지 제11호 서식]</font>
                    </td>
                    <td
                      height={2}
                      width={310}
                      className="stylefont1"
                      align="right"
                      valign="bottom"
                    >
                      <font color="red">[적색]</font>
                    </td>
                    <td width={5} height={2}>
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td width={1} height={2}>
                      &nbsp;
                    </td>
                    <td height={2} colSpan={2} className="stylefont5">
                      {/* 상단 타이틀 + 책번호 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={0}
                      >
                        <tbody>
                          <tr>
                            <td
                              rowSpan={2}
                              className="tdbd_red_top2left2bottom1"
                            >
                              <table
                                width={497}
                                border={0}
                                cellSpacing={0}
                                cellPadding={0}
                              >
                                <tbody>
                                  <tr>
                                    <td
                                      rowSpan={2}
                                      align="center"
                                      width={447}
                                    >
                                      <font style={{ fontSize: "11pt" }}>
                                        <b>
                                          <font color="red" size={5}>
                                            세금계산서
                                          </font>
                                        </b>
                                      </font>
                                      <font color="red">
                                        <span className="stylefont1">
                                          (공급자 보관용)
                                        </span>
                                      </font>
                                    </td>
                                    <td
                                      width={50}
                                      className="stylefont1"
                                      align="center"
                                      height={18}
                                      valign="bottom"
                                    >
                                      <font color="red">책&nbsp;번 호</font>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td
                                      width={50}
                                      className="stylefont1"
                                      align="center"
                                      height={18}
                                      valign="bottom"
                                    >
                                      <font color="red">일련번호</font>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                            <td
                              colSpan={3}
                              className="tdbd_red_top2left1"
                              height={20}
                              align="right"
                              valign="bottom"
                            >
                              {data.bookYear ?? ""}{" "}
                              <font color="red">권</font>
                            </td>
                            <td
                              colSpan={4}
                              className="tdbd_red_top2left1right2"
                              height={20}
                              align="right"
                              valign="bottom"
                            >
                              {data.serialNo ?? ""}
                              <font color="red">호</font>
                            </td>
                          </tr>
                          <tr>
                            {code7Arr.map((d, idx) => (
                              <td
                                key={`red-code-${idx}`}
                                width={15}
                                height={20}
                                className={
                                  idx === code7Arr.length - 1
                                    ? "tdbd_red_top1left1right2bottom1"
                                    : "tdbd_red_top1left1bottom1"
                                }
                              >
                                &nbsp;{d}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      {/* 공급자 / 공급받는자 정보 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr>
                            <td
                              className="tdbd_red_top1left2bottom1"
                              rowSpan={4}
                              align="center"
                              height={25}
                              width={15}
                            >
                              <font color="red">
                                공<br />
                                <br />
                                급<br />
                                <br />
                                자
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">등록번호</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              colSpan={3}
                              height={32}
                              align="center"
                            >
                              <b>{data.supplierBizNo}</b>
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              rowSpan={4}
                              height={32}
                              align="center"
                              width={15}
                            >
                              <font color="red">
                                공
                                <br />
                                급
                                <br />
                                받
                                <br />
                                는
                                <br />
                                자
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">등록번호</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              colSpan={3}
                              align="center"
                              height={32}
                            >
                              <b>{data.buyerBizNo}</b>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                상&nbsp;&nbsp;호
                                <br /> (법인명)
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              width={87}
                            >
                              {data.supplierName}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                성 명
                                <br /> (대표자)
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              width={87}
                              align="center"
                            >
                              {data.supplierCeo}
                              <font color="red">(인)</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                상&nbsp;&nbsp;호
                                <br /> (법인명)
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              width={87}
                            >
                              {data.buyerName}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                성&nbsp;&nbsp;명
                                <br /> (대표자)
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              height={32}
                              width={87}
                              align="center"
                            >
                              {data.buyerCeo}
                              <font color="red">(인)</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                사업장
                                <br />
                                주 &nbsp;&nbsp;소
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              colSpan={3}
                              height={32}
                              width={238}
                            >
                              {data.supplierAddr}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">
                                사업장
                                <br />
                                주 &nbsp;&nbsp;소
                              </font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              colSpan={3}
                              height={32}
                              width={237}
                            >
                              {data.buyerAddr}
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">업&nbsp;&nbsp;태</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.supplierBizType}
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">종 목</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.supplierBizItem}
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">업&nbsp;&nbsp;태</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.buyerBizType}
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="red">종 목</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2bottom1"
                              height={32}
                              width={87}
                            >
                              {data.buyerBizItem}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 작성 / 공급가액 / 세액 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center" valign="bottom">
                            <td
                              colSpan={3}
                              className="tdbd_red_top1left2"
                              height={20}
                            >
                              <font color="red">작&nbsp;&nbsp;성</font>
                            </td>
                            <td
                              colSpan={12}
                              className="tdbd_red_top1left1"
                              height={20}
                            >
                              <font color="red">
                                공&nbsp;급 &nbsp;가 &nbsp;액
                              </font>
                            </td>
                            <td
                              colSpan={11}
                              className="tdbd_red_top1left1"
                              height={20}
                            >
                              <font color="red">세&nbsp;&nbsp;액</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              height={20}
                              width={125}
                            >
                              <font color="red">비 고</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              width={40}
                              className="tdbd_red_top1left2"
                              align="center"
                              valign="bottom"
                            >
                              <font color="red">년</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              align="center"
                              width={20}
                              valign="bottom"
                            >
                              <font color="red">월</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={20}
                              align="center"
                              valign="bottom"
                            >
                              <font color="red">일</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={36}
                              align="center"
                              valign="bottom"
                            >
                              <font color="red">공란수</font>
                            </td>
                            {/* 공급가액 11칸 헤더 */}
                            {supplyLabels.map((label, idx) => (
                              <td
                                key={`red-slabel-${idx}`}
                                className="tdbd_red_top1left1"
                                width={13}
                                align="center"
                                valign="bottom"
                              >
                                <font color="red">{label}</font>
                              </td>
                            ))}
                            {/* 세액 11칸 헤더 */}
                            {taxLabels.map((label, idx) => (
                              <td
                                key={`red-tlabel-${idx}`}
                                className="tdbd_red_top1left1"
                                width={13}
                                align="center"
                                valign="bottom"
                              >
                                <font color="red">{label}</font>
                              </td>
                            ))}
                            <td
                              rowSpan={2}
                              className="tdbd_red_top1left1right2bottom1"
                            >
                              &nbsp;
                            </td>
                          </tr>
                          <tr>
                            <td
                              width={40}
                              className="tdbd_red_top1left2bottom1"
                              align="center"
                              height={30}
                            >
                              &nbsp;{issue.year}
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom1"
                              align="center"
                              width={20}
                              height={30}
                            >
                              &nbsp;{issue.month}
                            </td>
                            <td
                              width={20}
                              className="tdbd_red_top1left1bottom1"
                              align="center"
                              height={30}
                            >
                              &nbsp;{issue.day}
                            </td>
                            <td
                              width={36}
                              className="tdbd_red_top1left1bottom1"
                              align="center"
                              height={30}
                            >
                              {data.emptyLines}
                            </td>
                            {/* 공급가액 11칸 값 */}
                            {supplyDigits.map((d, idx) => (
                              <td
                                key={`red-sval-${idx}`}
                                width={13}
                                className="tdbd_red_top1left1bottom1"
                                align="center"
                                height={30}
                              >
                                {d || "\u00A0"}
                              </td>
                            ))}
                            {/* 세액 11칸 값 */}
                            {taxDigits.map((d, idx) => (
                              <td
                                key={`red-tval-${idx}`}
                                width={13}
                                className="tdbd_red_top1left1bottom1"
                                align="center"
                                height={30}
                              >
                                {d || "\u00A0"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      {/* 품목 표 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center" valign="bottom">
                            <td
                              className="tdbd_red_top1left2"
                              height={25}
                              width={20}
                            >
                              <font color="red">월</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={20}
                            >
                              <font color="red">일</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={123}
                            >
                              <font color="red">품 목</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={70}
                            >
                              <font color="red">규 격</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={30}
                              noWrap
                            >
                              <font color="red">수 량</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="red">단 가</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="red">공급가액</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="red">세 액</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              height={25}
                              width={109}
                            >
                              <font color="red">비 고</font>
                            </td>
                          </tr>

                          {/* 1행 – 실제 데이터 */}
                          <tr>
                            <td
                              className="tdbd_red_top1left2"
                              height={25}
                              width={20}
                              align="center"
                            >
                              {data.itemMonth}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={20}
                              align="center"
                            >
                              {data.itemDay}
                            </td>
                            <td
                              width={123}
                              height={25}
                              align="center"
                              className="tdbd_red_top1left1"
                            >
                              {data.itemName}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={70}
                            >
                              {data.itemSpec || "\u00A0"}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={30}
                              align="center"
                            >
                              {data.itemQty}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemUnitPrice)}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemSupply)}
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemTax)}
                            </td>
                            <td
                              className="tdbd_red_top1left1right2"
                              height={25}
                              width={109}
                            >
                              {data.itemRemark || "\u00A0"}
                            </td>
                          </tr>

                          {/* 나머지 5행 – 빈 행 */}
                          {Array.from({ length: 5 }).map((_, rowIdx) => (
                            <tr key={`red-empty-${rowIdx}`}>
                              <td
                                className="tdbd_red_top1left2"
                                height={25}
                                width={20}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={20}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                width={123}
                                height={25}
                                align="center"
                                className="tdbd_red_top1left1"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={70}
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={30}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_red_top1left1right2"
                                height={25}
                                width={109}
                              >
                                &nbsp;
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* 합계 금액 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center">
                            <td
                              className="tdbd_red_top1left2"
                              width={124}
                              valign="bottom"
                              height={20}
                            >
                              <font color="red">합 계 금 액</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="red">현 금</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="red">수 표</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="red">어 음</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="red">외상미수금</font>
                            </td>
                            <td
                              className="tdbd_red_top1left1right2bottom2"
                              rowSpan={2}
                              valign="middle"
                              width={109}
                            >
                              <font color="red">위 금액을 영수함.</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_red_top1left2bottom2"
                              width={124}
                              height={30}
                              align="right"
                            >
                              {formatAmount(data.totalAmount)}
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_red_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td width={5} height={2}>
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td height={2} width={1}>
                      &nbsp;
                    </td>
                    <td className="stylefont5" height={2}>
                      <font color="red">
                        22226-28131일 &apos;96.2.27.승인
                      </font>
                    </td>
                    <td className="stylefont5" height={2} align="right">
                      <font color="red">
                        182mm x128mm 인쇄용지(특급)
                      </font>
                    </td>
                    <td height={2}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              {/* 세금계산서 용지 끝 */}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 위/아래 여백 */}
      <div style={{ height: "20px" }} />

      {/* ========================================= */}
      {/* ===== 공급받는자 보관용 (청색, 동일내용) === */}
      {/* ========================================= */}
      <table width={614} border={0} cellSpacing={0} cellPadding={0}>
        <tbody>
          <tr align="center">
            <td>
              {/* 세금계산서 시작 */}
              <table width={614} border={0} cellSpacing={0} cellPadding={0}>
                <tbody>
                  <tr>
                    <td colSpan={4} height={4}></td>
                  </tr>
                  <tr>
                    <td width={1} height={2}>
                      &nbsp;
                    </td>
                    <td
                      height={2}
                      width={310}
                      className="stylefont1"
                      valign="bottom"
                    >
                      <font color="blue">[별지 제11호 서식]</font>
                    </td>
                    <td
                      height={2}
                      width={310}
                      className="stylefont1"
                      align="right"
                      valign="bottom"
                    >
                      <font color="blue">[청색]</font>
                    </td>
                    <td width={5} height={2}>
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td width={1} height={2}>
                      &nbsp;
                    </td>
                    <td height={2} colSpan={2} className="stylefont5">
                      {/* 상단 타이틀 + 책번호 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={0}
                      >
                        <tbody>
                          <tr>
                            <td
                              rowSpan={2}
                              className="tdbd_blue_top2left2bottom1"
                            >
                              <table
                                width={497}
                                border={0}
                                cellSpacing={0}
                                cellPadding={0}
                              >
                                <tbody>
                                  <tr>
                                    <td
                                      rowSpan={2}
                                      align="center"
                                      width={447}
                                    >
                                      <font style={{ fontSize: "11pt" }}>
                                        <b>
                                          <font color="blue" size={5}>
                                            세금계산서
                                          </font>
                                        </b>
                                      </font>
                                      <font color="blue">
                                        <span className="stylefont1">
                                          (공급받는자 보관용)
                                        </span>
                                      </font>
                                    </td>
                                    <td
                                      width={50}
                                      className="stylefont1"
                                      align="center"
                                      height={18}
                                      valign="bottom"
                                    >
                                      <font color="blue">책&nbsp;번 호</font>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td
                                      width={50}
                                      className="stylefont1"
                                      align="center"
                                      height={18}
                                      valign="bottom"
                                    >
                                      <font color="blue">일련번호</font>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                            <td
                              colSpan={3}
                              className="tdbd_blue_top2left1"
                              height={20}
                              align="right"
                              valign="bottom"
                            >
                              {data.bookYear ?? ""}{" "}
                              <font color="blue">권</font>
                            </td>
                            <td
                              colSpan={4}
                              className="tdbd_blue_top2left1right2"
                              height={20}
                              align="right"
                              valign="bottom"
                            >
                              {data.serialNo ?? ""}
                              <font color="blue">호</font>
                            </td>
                          </tr>
                          <tr>
                            {code7Arr.map((d, idx) => (
                              <td
                                key={`blue-code-${idx}`}
                                width={15}
                                height={20}
                                className={
                                  idx === code7Arr.length - 1
                                    ? "tdbd_blue_top1left1right2bottom1"
                                    : "tdbd_blue_top1left1bottom1"
                                }
                              >
                                &nbsp;{d}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      {/* 공급자 / 공급받는자 정보 (내용 동일) */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr>
                            <td
                              className="tdbd_blue_top1left2bottom1"
                              rowSpan={4}
                              align="center"
                              height={25}
                              width={15}
                            >
                              <font color="blue">
                                공<br />
                                <br />
                                급<br />
                                <br />
                                자
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">등록번호</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              colSpan={3}
                              height={32}
                              align="center"
                            >
                              <b>{data.supplierBizNo}</b>
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              rowSpan={4}
                              height={32}
                              align="center"
                              width={15}
                            >
                              <font color="blue">
                                공
                                <br />
                                급
                                <br />
                                받
                                <br />
                                는
                                <br />
                                자
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">등록번호</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              colSpan={3}
                              align="center"
                              height={32}
                            >
                              <b>{data.buyerBizNo}</b>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                상&nbsp;&nbsp;호
                                <br /> (법인명)
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              width={87}
                            >
                              {data.supplierName}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                성 명
                                <br /> (대표자)
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              width={87}
                              align="center"
                            >
                              {data.supplierCeo}
                              <font color="blue">(인)</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                상&nbsp;&nbsp;호
                                <br /> (법인명)
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              width={87}
                            >
                              {data.buyerName}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                성&nbsp;&nbsp;명
                                <br /> (대표자)
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              height={32}
                              width={87}
                              align="center"
                            >
                              {data.buyerCeo}
                              <font color="blue">(인)</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                사업장
                                <br />
                                주 &nbsp;&nbsp;소
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              colSpan={3}
                              height={32}
                              width={238}
                            >
                              {data.supplierAddr}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">
                                사업장
                                <br />
                                주 &nbsp;&nbsp;소
                              </font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              colSpan={3}
                              height={32}
                              width={237}
                            >
                              {data.buyerAddr}
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">업&nbsp;&nbsp;태</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.supplierBizType}
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">종 목</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.supplierBizItem}
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">업&nbsp;&nbsp;태</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              width={87}
                            >
                              {data.buyerBizType}
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              height={32}
                              align="center"
                              width={50}
                            >
                              <font color="blue">종 목</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2bottom1"
                              height={32}
                              width={87}
                            >
                              {data.buyerBizItem}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 작성 / 공급가액 / 세액 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center" valign="bottom">
                            <td
                              colSpan={3}
                              className="tdbd_blue_top1left2"
                              height={20}
                            >
                              <font color="blue">작&nbsp;&nbsp;성</font>
                            </td>
                            <td
                              colSpan={12}
                              className="tdbd_blue_top1left1"
                              height={20}
                            >
                              <font color="blue">
                                공&nbsp;급 &nbsp;가 &nbsp;액
                              </font>
                            </td>
                            <td
                              colSpan={11}
                              className="tdbd_blue_top1left1"
                              height={20}
                            >
                              <font color="blue">세&nbsp;&nbsp;액</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              height={20}
                              width={125}
                            >
                              <font color="blue">비 고</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              width={40}
                              className="tdbd_blue_top1left2"
                              align="center"
                              valign="bottom"
                            >
                              <font color="blue">년</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              align="center"
                              width={20}
                              valign="bottom"
                            >
                              <font color="blue">월</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={20}
                              align="center"
                              valign="bottom"
                            >
                              <font color="blue">일</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={36}
                              align="center"
                              valign="bottom"
                            >
                              <font color="blue">공란수</font>
                            </td>
                            {/* 공급가액 11칸 헤더 */}
                            {supplyLabels.map((label, idx) => (
                              <td
                                key={`blue-slabel-${idx}`}
                                className="tdbd_blue_top1left1"
                                width={13}
                                align="center"
                                valign="bottom"
                              >
                                <font color="blue">{label}</font>
                              </td>
                            ))}
                            {/* 세액 11칸 헤더 */}
                            {taxLabels.map((label, idx) => (
                              <td
                                key={`blue-tlabel-${idx}`}
                                className="tdbd_blue_top1left1"
                                width={13}
                                align="center"
                                valign="bottom"
                              >
                                <font color="blue">{label}</font>
                              </td>
                            ))}
                            <td
                              rowSpan={2}
                              className="tdbd_blue_top1left1right2bottom1"
                            >
                              &nbsp;
                            </td>
                          </tr>
                          <tr>
                            <td
                              width={40}
                              className="tdbd_blue_top1left2bottom1"
                              align="center"
                              height={30}
                            >
                              &nbsp;{issue.year}
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom1"
                              align="center"
                              width={20}
                              height={30}
                            >
                              &nbsp;{issue.month}
                            </td>
                            <td
                              width={20}
                              className="tdbd_blue_top1left1bottom1"
                              align="center"
                              height={30}
                            >
                              &nbsp;{issue.day}
                            </td>
                            <td
                              width={36}
                              className="tdbd_blue_top1left1bottom1"
                              align="center"
                              height={30}
                            >
                              {data.emptyLines}
                            </td>
                            {/* 공급가액 11칸 값 */}
                            {supplyDigits.map((d, idx) => (
                              <td
                                key={`blue-sval-${idx}`}
                                width={13}
                                className="tdbd_blue_top1left1bottom1"
                                align="center"
                                height={30}
                              >
                                {d || "\u00A0"}
                              </td>
                            ))}
                            {/* 세액 11칸 값 */}
                            {taxDigits.map((d, idx) => (
                              <td
                                key={`blue-tval-${idx}`}
                                width={13}
                                className="tdbd_blue_top1left1bottom1"
                                align="center"
                                height={30}
                              >
                                {d || "\u00A0"}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      {/* 품목 표 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center" valign="bottom">
                            <td
                              className="tdbd_blue_top1left2"
                              height={25}
                              width={20}
                            >
                              <font color="blue">월</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={20}
                            >
                              <font color="blue">일</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={123}
                            >
                              <font color="blue">품 목</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={70}
                            >
                              <font color="blue">규 격</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={30}
                              noWrap
                            >
                              <font color="blue">수 량</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="blue">단 가</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="blue">공급가액</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                            >
                              <font color="blue">세 액</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              height={25}
                              width={109}
                            >
                              <font color="blue">비 고</font>
                            </td>
                          </tr>

                          {/* 1행 – 실제 데이터 (동일) */}
                          <tr>
                            <td
                              className="tdbd_blue_top1left2"
                              height={25}
                              width={20}
                              align="center"
                            >
                              {data.itemMonth}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={20}
                              align="center"
                            >
                              {data.itemDay}
                            </td>
                            <td
                              width={123}
                              height={25}
                              align="center"
                              className="tdbd_blue_top1left1"
                            >
                              {data.itemName}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={70}
                            >
                              {data.itemSpec || "\u00A0"}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={30}
                              align="center"
                            >
                              {data.itemQty}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemUnitPrice)}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemSupply)}
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              height={25}
                              width={75}
                              align="right"
                            >
                              {formatAmount(data.itemTax)}
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2"
                              height={25}
                              width={109}
                            >
                              {data.itemRemark || "\u00A0"}
                            </td>
                          </tr>

                          {/* 나머지 5행 – 빈 행 */}
                          {Array.from({ length: 5 }).map((_, rowIdx) => (
                            <tr key={`blue-empty-${rowIdx}`}>
                              <td
                                className="tdbd_blue_top1left2"
                                height={25}
                                width={20}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={20}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                width={123}
                                height={25}
                                align="center"
                                className="tdbd_blue_top1left1"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={70}
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={30}
                                align="center"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1"
                                height={25}
                                width={75}
                                align="right"
                              >
                                &nbsp;
                              </td>
                              <td
                                className="tdbd_blue_top1left1right2"
                                height={25}
                                width={109}
                              >
                                &nbsp;
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* 합계 금액 */}
                      <table
                        width={605}
                        border={0}
                        cellSpacing={0}
                        cellPadding={1}
                      >
                        <tbody>
                          <tr align="center">
                            <td
                              className="tdbd_blue_top1left2"
                              width={124}
                              valign="bottom"
                              height={20}
                            >
                              <font color="blue">합 계 금 액</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="blue">현 금</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="blue">수 표</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="blue">어 음</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1"
                              width={90}
                              valign="bottom"
                              height={20}
                            >
                              <font color="blue">외상미수금</font>
                            </td>
                            <td
                              className="tdbd_blue_top1left1right2bottom2"
                              rowSpan={2}
                              valign="middle"
                              width={109}
                            >
                              <font color="blue">위 금액을 영수함.</font>
                            </td>
                          </tr>
                          <tr>
                            <td
                              className="tdbd_blue_top1left2bottom2"
                              width={124}
                              height={30}
                              align="right"
                            >
                              {formatAmount(data.totalAmount)}
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                            <td
                              className="tdbd_blue_top1left1bottom2"
                              width={90}
                              height={30}
                              align="right"
                            >
                              &nbsp;
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td width={5} height={2}>
                      &nbsp;
                    </td>
                  </tr>
                  <tr>
                    <td height={2} width={1}>
                      &nbsp;
                    </td>
                    <td className="stylefont5" height={2}>
                      <font color="blue">
                        22226-28131일 &apos;96.2.27.승인
                      </font>
                    </td>
                    <td className="stylefont5" height={2} align="right">
                      <font color="blue">
                        182mm x128mm 인쇄용지(특급)
                      </font>
                    </td>
                    <td height={2}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
              {/* 세금계산서 용지 끝 */}
            </td>
          </tr>
        </tbody>
      </table>

        <div style={{ textAlign: "right", margin: "8px 0 12px" }}>
        <button
          id="print-button"
          type="button"
          onClick={() => window.print()}
          style={{
            padding: "6px 14px",
            fontSize: "12px",
            border: "1px solid #888",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          인쇄
        </button>
      </div>
      {/* ====== 스타일 정의 ====== */}
      <style jsx>{`
        .stylefont1 {
          font-size: 9pt;
          color: #000000;
          font-family: "굴림";
          text-decoration: none;
        }
        .stylefont2 {
          font-size: 9pt;
          color: #000000;
          line-height: 15px;
          font-family: "굴림";
          text-decoration: none;
        }
        .stylefont3 {
          font-size: 9pt;
          color: #000000;
          line-height: 18px;
          font-family: "굴림";
          text-decoration: none;
        }
        .stylefont4 {
          font-size: 9pt;
          color: #000000;
          line-height: 22px;
          font-family: "굴림";
          text-decoration: none;
        }
        .stylefont5 {
          font-size: 8pt;
          color: #000000;
          font-family: "굴림";
          text-decoration: none;
        }

        /* === RED BORDER CLASSES === */
        .tdbd_red_top2left2bottom1 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 2px solid;
          font-size: 9pt;
          border-left: #ac0000 2px solid;
          color: #000000;
          border-bottom: #ac0000 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top2left1 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 2px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top2left1right2 {
          border-right: #ac0000 2px solid;
          border-top: #ac0000 2px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1bottom1 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1right2bottom1 {
          border-right: #ac0000 2px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left2bottom1 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 2px solid;
          color: #000000;
          border-bottom: #ac0000 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1right2 {
          border-right: #ac0000 2px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left2 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 2px solid;
          color: #000000;
          border-bottom: #ac0000 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left2bottom2 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 2px solid;
          color: #000000;
          border-bottom: #ac0000 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1bottom2 {
          border-right: #ac0000 0px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_red_top1left1right2bottom2 {
          border-right: #ac0000 2px solid;
          border-top: #ac0000 1px solid;
          font-size: 9pt;
          border-left: #ac0000 1px solid;
          color: #000000;
          border-bottom: #ac0000 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }

        /* === BLUE BORDER CLASSES (색만 blue) === */
        .tdbd_blue_top2left2bottom1 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 2px solid;
          font-size: 9pt;
          border-left: #0033cc 2px solid;
          color: #000000;
          border-bottom: #0033cc 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top2left1 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 2px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top2left1right2 {
          border-right: #0033cc 2px solid;
          border-top: #0033cc 2px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1bottom1 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1right2bottom1 {
          border-right: #0033cc 2px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left2bottom1 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 2px solid;
          color: #000000;
          border-bottom: #0033cc 1px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1right2 {
          border-right: #0033cc 2px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left2 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 2px solid;
          color: #000000;
          border-bottom: #0033cc 0px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left2bottom2 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 2px solid;
          color: #000000;
          border-bottom: #0033cc 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1bottom2 {
          border-right: #0033cc 0px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }
        .tdbd_blue_top1left1right2bottom2 {
          border-right: #0033cc 2px solid;
          border-top: #0033cc 1px solid;
          font-size: 9pt;
          border-left: #0033cc 1px solid;
          color: #000000;
          border-bottom: #0033cc 2px solid;
          font-family: "굴림";
          text-decoration: none;
        }

      `}</style>
            {/* ③ 인쇄 시 레이아웃/메뉴 숨기기 */}
      <style jsx global>{`
        @media print {
          /* 페이지 전체를 숨기고 */
          body * {
            visibility: hidden;
          }
          /* 세금계산서 영역만 다시 보이게 */
          #tax-print-root,
          #tax-print-root * {
            visibility: visible;
          }
          /* 페이지 맨 위로 붙이기 */
          #tax-print-root {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            margin: 0;
          }
          /* 인쇄 버튼은 출력 안 함 */
          #print-button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
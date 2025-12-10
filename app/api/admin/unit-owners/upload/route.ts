// src/app/api/admin/unit-owners/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// 엑셀(xlsx/xls) 지원하려면 먼저 설치: pnpm add xlsx
import * as XLSX from "xlsx";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

type RawRow = {
  id?: string | number;
  name?: string;
  bizNo?: string;
  ceoName?: string;
  address?: string;
  bizType?: string;
  bizItem?: string;
  phone?: string;
  email?: string;
  roomInfo?: string;
  ownerType?: string;
  status?: string;
  registryNo?: string;
  contractNo?: string;
  bankName?: string;
  bankAccount?: string;
  memo?: string;
};

function normStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toOwnerType(v: unknown) {
  const s = normStr(v)?.toUpperCase();
  if (s === "INDIVIDUAL" || s === "개인") return "INDIVIDUAL" as const;
  if (s === "CORPORATION" || s === "법인") return "CORPORATION" as const;
  return null;
}

function toStatus(v: unknown) {
  const s = normStr(v)?.toUpperCase();
  if (!s) return "PENDING_PAYMENT" as const;
  if (["PENDING_PAYMENT", "입금대기"].includes(s)) return "PENDING_PAYMENT" as const;
  if (["PAID", "입금완료"].includes(s)) return "PAID" as const;
  if (["TERMINATED", "계약해지"].includes(s)) return "TERMINATED" as const;
  return "PENDING_PAYMENT" as const;
}

function parseCsv(buf: Buffer): RawRow[] {
  const text = buf.toString("utf8");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: any = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx].trim() : "";
    });
    rows.push(row);
  }
  return rows;
}

function parseExcel(buf: Buffer): RawRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  // 첫 행을 헤더로 사용하는 JSON 배열로 변환
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return J({ ok: false, error: "file_not_provided" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    const name = (file as any).name as string | undefined;
    const lowerName = (name || "").toLowerCase();

    let rawRows: RawRow[] = [];
    if (lowerName.endsWith(".csv")) {
      rawRows = parseCsv(buf);
    } else if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      rawRows = parseExcel(buf);
    } else {
      // 확장자로 못 알아내면 일단 엑셀로 시도
      try {
        rawRows = parseExcel(buf);
      } catch {
        rawRows = parseCsv(buf);
      }
    }

    if (!rawRows.length) {
      return J({ ok: false, error: "no_rows" }, 400);
    }

    let created = 0;
    let updated = 0;
    const errors: { rowIndex: number; message: string }[] = [];

    // 각 행 처리
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i] as RawRow;

      // 엑셀 헤더 이름은 페이지에서 안내한 것과 맞춰 사용:
      // id, name, bizNo, ceoName, address, bizType, bizItem, phone,
      // email, roomInfo, ownerType, status, registryNo, contractNo,
      // bankName, bankAccount, memo

      const idVal = r.id ?? (r as any).ID ?? (r as any).Id;
      const idNum =
        idVal !== undefined && idVal !== null && String(idVal).trim() !== ""
          ? Number(String(idVal).trim())
          : null;

      const data = {
        name: normStr(r.name)!,
        bizNo: normStr(r.bizNo),
        ceoName: normStr(r.ceoName),
        address: normStr(r.address),
        bizType: normStr(r.bizType),
        bizItem: normStr(r.bizItem),
        phone: normStr(r.phone),
        email: normStr(r.email),
        roomInfo: normStr(r.roomInfo),
        ownerType: toOwnerType(r.ownerType),
        status: toStatus(r.status),
        registryNo: normStr(r.registryNo),
        contractNo: normStr(r.contractNo),
        bankName: normStr(r.bankName),
        bankAccount: normStr(r.bankAccount),
        memo: normStr(r.memo),
      };

      if (!data.name) {
        errors.push({
          rowIndex: i + 2, // 헤더가 1행이라고 보고 +2
          message: "name(상호/성명)이 비어있습니다.",
        });
        continue;
      }

      try {
        if (idNum && Number.isFinite(idNum)) {
          // ID가 있으면 update 시도
          await prisma.unitOwner.update({
            where: { id: idNum },
            data,
          });
          updated += 1;
        } else {
          // ID 없으면 create
          await prisma.unitOwner.create({ data });
          created += 1;
        }
      } catch (e: any) {
        console.error("row error", i, e);
        errors.push({
          rowIndex: i + 2,
          message: e?.message || "DB 처리 중 오류",
        });
      }
    }

    return J({
      ok: true,
      created,
      updated,
      errors,
    });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
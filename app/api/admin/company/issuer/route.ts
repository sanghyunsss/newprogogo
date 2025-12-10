// src/app/api/admin/company/issuer/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const J = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const DEFAULT_ISSUER = {
  name: "모어댄 속초해변점",
  bizNo: "267-85-03121",
  ceoName: "권혜숙",
  address: "강원특별자치도 속초시 조양동 1452",
  phone: "1661-5512",
  email: "info@morethansc.co.kr",
  bankName: "국민은행",
  bankAccount: "123456-01-000000",
  bankOwner: "모어댄속초해변점",
} as const;

type IssuerPayload = {
  id?: number;
  name: string;
  bizNo: string;
  ceoName?: string;
  address?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccount?: string;
  bankOwner?: string;
};

function packMemo(p: IssuerPayload | typeof DEFAULT_ISSUER | any) {
  const bankName = p.bankName ?? DEFAULT_ISSUER.bankName;
  const bankAccount = p.bankAccount ?? DEFAULT_ISSUER.bankAccount;
  const bankOwner = p.bankOwner ?? DEFAULT_ISSUER.bankOwner;
  if (!bankName && !bankAccount && !bankOwner) return null;
  return JSON.stringify({ bankName, bankAccount, bankOwner });
}

function unpackMemo(memo: string | null) {
  if (!memo) return {};
  try {
    const obj = JSON.parse(memo);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function buildIssuerResponse(company: any) {
  const bank = unpackMemo(company.memo as string | null);
  return {
    id: company.id,
    name: company.name,
    bizNo: company.bizNo,
    ceoName: company.ceoName ?? "",
    address: company.address ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    bankName: bank.bankName ?? DEFAULT_ISSUER.bankName,
    bankAccount: bank.bankAccount ?? DEFAULT_ISSUER.bankAccount,
    bankOwner: bank.bankOwner ?? DEFAULT_ISSUER.bankOwner,
  };
}

// GET: 회사(공급받는자) 정보 조회 (없으면 기본값으로 1건 생성)
export async function GET() {
  try {
    let company = await prisma.company.findFirst({
      where: { bizNo: DEFAULT_ISSUER.bizNo },
      orderBy: { id: "asc" },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: DEFAULT_ISSUER.name,
          bizNo: DEFAULT_ISSUER.bizNo,
          ceoName: DEFAULT_ISSUER.ceoName,
          address: DEFAULT_ISSUER.address,
          bizType: "숙박업",
          bizItem: "생활형숙박시설위탁운영",
          phone: DEFAULT_ISSUER.phone,
          email: DEFAULT_ISSUER.email,
          memo: packMemo(DEFAULT_ISSUER) ?? undefined,
        },
      });
    }

    const issuer = buildIssuerResponse(company);
    return J({ ok: true, issuer });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}

// POST: 회사(공급받는자) 정보 저장/수정
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as IssuerPayload;

    if (!body.name || !body.bizNo) {
      return J({ ok: false, error: "name_and_bizNo_required" }, 400);
    }

    const memo = packMemo(body);

    let company;
    if (body.id) {
      company = await prisma.company.update({
        where: { id: body.id },
        data: {
          name: body.name,
          bizNo: body.bizNo,
          ceoName: body.ceoName ?? null,
          address: body.address ?? null,
          bizType: "숙박업",
          bizItem: "생활형숙박시설위탁운영",
          phone: body.phone ?? null,
          email: body.email ?? null,
          memo,
        },
      });
    } else {
      // bizNo 기준으로 upsert
      company = await prisma.company.upsert({
        where: { bizNo: body.bizNo },
        update: {
          name: body.name,
          ceoName: body.ceoName ?? null,
          address: body.address ?? null,
          bizType: "숙박업",
          bizItem: "생활형숙박시설위탁운영",
          phone: body.phone ?? null,
          email: body.email ?? null,
          memo,
        },
        create: {
          name: body.name,
          bizNo: body.bizNo,
          ceoName: body.ceoName ?? null,
          address: body.address ?? null,
          bizType: "숙박업",
          bizItem: "생활형숙박시설위탁운영",
          phone: body.phone ?? null,
          email: body.email ?? null,
          memo,
        },
      });
    }

    const issuer = buildIssuerResponse(company);
    return J({ ok: true, issuer });
  } catch (e) {
    console.error(e);
    return J({ ok: false, error: "server_error" }, 500);
  }
}
import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

type DbListRow = { seq: number; name: string; file: string };

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<DbListRow[]>("PRAGMA database_list;");
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL,
    database_list: rows,
  });
}
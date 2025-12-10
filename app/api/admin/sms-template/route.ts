// app/api/admin/sms-template/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Kind = "checkin" | "checkout";
type MessageType = "SMS" | "LMS";

export async function GET() {
  const rows = await prisma.smsTemplate.findMany();
  const map = Object.fromEntries(
    rows.map(r => [
      r.kind,
      {
        content: r.content,
        messageType: r.messageType as MessageType,
        templateCode: r.templateCode ?? "", // ✅ 추가
        subject: r.subject ?? null,         // LMS일 경우 제목
      }
    ])
  );
  return NextResponse.json({ ok: true, data: map });
}

export async function POST(req: NextRequest) {
  const { kind, text, messageType, templateCode, subject } = (await req.json()) as {
    kind: Kind;
    text: string;
    messageType: MessageType;
    templateCode?: string;
    subject?: string | null;
  };

  if (!kind || !text || !messageType) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const row = await prisma.smsTemplate.upsert({
    where: { kind },
    update: { content: text, messageType, templateCode: templateCode ?? null, subject: subject ?? null },
    create: { kind, content: text, messageType, templateCode: templateCode ?? null, subject: subject ?? null },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
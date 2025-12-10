// app/api/sms/templates/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Kind = "checkin" | "checkout";

export async function GET() {
  const rows = await prisma.smsTemplate.findMany();
  const map: Record<Kind, { content: string; subject?: string; templateCode?: string }> = {
    checkin: { content: "", subject: "", templateCode: "" },
    checkout: { content: "", subject: "", templateCode: "" },
  };
  for (const r of rows) {
    const k = r.kind as Kind;
    map[k] = { content: r.content, subject: r.subject ?? undefined, templateCode: r.templateCode ?? undefined };
  }
  return NextResponse.json({ ok: true, templates: map });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    kind: Kind;
    content: string;
    subject?: string;
    templateCode?: string;
  };
  if (!body?.kind || typeof body.content !== "string") {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  await prisma.smsTemplate.upsert({
    where: { kind: body.kind },
    update: {
      content: body.content,
      subject: body.subject ?? null,
      templateCode: (body.templateCode ?? "").trim() || null,
    },
    create: {
      kind: body.kind,
      content: body.content,
      subject: body.subject ?? null,
      templateCode: (body.templateCode ?? "").trim() || null,
      messageType: (new TextEncoder().encode(body.content).length <= 90 ? "SMS" : "LMS"),
    },
  });

  return NextResponse.json({ ok: true });
}
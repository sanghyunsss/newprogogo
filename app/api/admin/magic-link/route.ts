// app/api/admin/magic-link/route.ts
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { guestId } = await req.json();
    if (!guestId) {
      return NextResponse.json({ error: "missing_guestId" }, { status: 400 });
    }

    const guest = await prisma.dailyGuest.findUnique({
      where: { id: guestId },
      select: { id: true, token: true },
    });
    if (!guest) {
      return NextResponse.json({ error: "guest_not_found" }, { status: 404 });
    }

    const base = (process.env.MAGIC_LINK_BASE ?? "").replace(/\/+$/, "");
    return NextResponse.json({ url: `${base}/g/${guest.token}` });
  } catch (e) {
    console.error("magic-link error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
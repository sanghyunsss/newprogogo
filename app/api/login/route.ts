export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { serialize } from "cookie";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "admin_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "";

export async function POST(req: Request) {
  try {
    if (!SESSION_SECRET) {
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    const { email, password } = await req.json().catch(() => ({} as any));
    if (!email || !password) {
      return NextResponse.json({ error: "missing" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user?.password) {
      return NextResponse.json({ error: "invalid" }, { status: 401 });
    }

    const ok = await compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "invalid" }, { status: 401 });
    }

    const jwt = await new SignJWT({
      uid: user.id,
      email: user.email,
      role: (user as any).role ?? "admin",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode(SESSION_SECRET));

    // ✅ Domain 추가 (핵심)
    const cookie = serialize(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      domain: ".morethansc.co.kr",
    });

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Set-Cookie": cookie,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
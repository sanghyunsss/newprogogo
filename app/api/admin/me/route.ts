// app/api/admin/me/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminFromCookie } from "@/src/lib/auth-guard";
import { serialize } from "cookie";

/** 기존 쿠키 전부 삭제 */
function clearLegacyCookies(headers: Headers) {
  for (const name of [
    "admin_session",
    "admin_session_v1",
    process.env.AUTH_COOKIE_NAME ?? "admin_session_v2",
  ]) {
    // 루트 경로
    headers.append(
      "Set-Cookie",
      serialize(name, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      })
    );
    // /admin 경로
    headers.append(
      "Set-Cookie",
      serialize(name, "", {
        path: "/admin",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      })
    );
  }
}

export async function GET() {
  const headers = new Headers({ "Cache-Control": "no-store" });

  try {
    const u = await getAdminFromCookie();
    return NextResponse.json({ ok: true, user: u }, { headers });
  } catch {
    // 인증 실패 시 모든 쿠키 제거 + 401
    clearLegacyCookies(headers);
    return new NextResponse(JSON.stringify({ ok: false }), {
      status: 401,
      headers,
    });
  }
}
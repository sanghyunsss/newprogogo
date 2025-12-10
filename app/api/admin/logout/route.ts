// app/api/admin/logout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { serialize } from "cookie";
import { getAdminFromCookie } from "@/src/lib/auth-guard";

/** 모든 과거 쿠키 제거(+ 과거 도메인 쿠키 포함) */
function clearAllCookies(headers: Headers) {
  const names = [
    "admin_session",
    "admin_session_v1",
    process.env.AUTH_COOKIE_NAME ?? "admin_session_v2",
  ];
  const paths = ["/", "/admin"];
  const domains = [
    undefined,
    process.env.COOKIE_DOMAIN,
    ".morethansc.co.kr",
  ].filter(Boolean) as string[];

  for (const name of names) {
    for (const path of paths) {
      // domain 미지정
      headers.append(
        "Set-Cookie",
        serialize(name, "", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path,
          maxAge: 0,
        }),
      );
      // 과거 domain 지정 쿠키들까지 제거
      for (const domain of domains) {
        headers.append(
          "Set-Cookie",
          serialize(name, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path,
            maxAge: 0,
            domain,
          }),
        );
      }
    }
  }
}

export async function POST() {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  clearAllCookies(headers);

  try {
    const u = await getAdminFromCookie();
    if (u?.id) {
      // 이 관리자의 모든 세션 강제 종료
      await prisma.adminSession
        .deleteMany({ where: { adminId: u.id } })
        .catch(() => {});
    }
  } catch {
    // 로그인 상태가 아니어도 무시
  }

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}
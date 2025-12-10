// middleware.ts  ← 전체 교체
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 세션 쿠키 이름: 기본 sid, 필요시 AUTH_COOKIE_NAME 로 오버라이드
const COOKIE_PRIMARY = process.env.AUTH_COOKIE_NAME || "sid";
// 과거 호환 쿠키들
const COOKIE_FALLBACKS = ["admin_session_v3", "admin_session"];

const LOCAL_API_BASE = process.env.INTERNAL_BASE_URL || "http://127.0.0.1:3000";

/** 차단 IP 여부 확인 */
async function isBanned(req: NextRequest) {
  try {
    const r = await fetch(new URL("/api/admin/security/check", LOCAL_API_BASE), {
      headers: {
        "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
        "x-real-ip": req.headers.get("x-real-ip") || "",
      },
      cache: "no-store",
    });
    return r.status === 403;
  } catch {
    return false;
  }
}

/** 세션 쿠키 추출: sid 우선, 없으면 폴백들에서 탐색 */
function readSessionCookie(req: NextRequest): string {
  return (
    req.cookies.get(COOKIE_PRIMARY)?.value ||
    COOKIE_FALLBACKS.map((k) => req.cookies.get(k)?.value || "").find(Boolean) ||
    ""
  );
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 적용 대상 경로
  const isAdminArea = pathname.startsWith("/admin");
  const isCleaningApi = pathname.startsWith("/api/cleaning");
  const isWorkerPage = pathname === "/worker/cleaning";

  // 작업자 토큰 페이지는 공개 (토큰 검증은 API에서 수행)
  if (isWorkerPage) {
    // 비차단 로깅
    fetch(new URL("/api/admin/security/log", LOCAL_API_BASE), {
      method: "POST",
      headers: {
        "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
        "x-real-ip": req.headers.get("x-real-ip") || "",
        "user-agent": req.headers.get("user-agent") || "",
        "x-path": pathname,
      },
      cache: "no-store",
    }).catch(() => {});
    return NextResponse.next();
  }

  // ───────────────────────────────────────────────────────────────
  // 작업자용 청소 API 예외(토큰 인증 사용): 공개 허용
  //   GET/POST /api/cleaning/worker-tasks
  //   POST     /api/cleaning/worker-upload
  //   (필요 시 여기에 추가)
  // ───────────────────────────────────────────────────────────────
  const publicCleaningApis = [
    "/api/cleaning/worker-tasks",
    "/api/cleaning/worker-upload",
    "/api/cleaning/link",
  ];
  const isPublicCleaningApi = publicCleaningApis.some((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );
  if (isCleaningApi && isPublicCleaningApi) {
    return NextResponse.next();
  }

  // 그 외 경로는 통과
  if (!(isAdminArea || isCleaningApi)) {
    return NextResponse.next();
  }

  const session = readSessionCookie(req);
  const isLoginPage = pathname === "/admin/login";

  // 1) 차단 IP 즉시 로그아웃
  if (await isBanned(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("blocked", "1");
    const res = NextResponse.redirect(url);
    // 모든 후보 쿠키 제거
    [COOKIE_PRIMARY, ...COOKIE_FALLBACKS].forEach((k) =>
      res.cookies.set(k, "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 })
    );
    return res;
  }

  // 2) 인증 요구 리소스에서 미로그인 처리
  const authRequired = isCleaningApi || (isAdminArea && !isLoginPage);
  if (authRequired && !session) {
    if (isCleaningApi) {
      return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(url);
  }

  // 3) 접근 로깅(비차단)
  fetch(new URL("/api/admin/security/log", LOCAL_API_BASE), {
    method: "POST",
    headers: {
      "x-forwarded-for": req.headers.get("x-forwarded-for") || "",
      "x-real-ip": req.headers.get("x-real-ip") || "",
      "user-agent": req.headers.get("user-agent") || "",
      "x-path": pathname,
    },
    cache: "no-store",
  }).catch(() => {});

  return NextResponse.next();
}

// middleware 적용 경로
export const config = {
  matcher: [
    "/admin/:path*",        // 관리자 화면
    "/api/cleaning/:path*", // 청소 관련 API
    "/worker/cleaning",     // 작업자 토큰 페이지
  ],
};
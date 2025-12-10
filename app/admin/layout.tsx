"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren, useEffect, useState } from "react";

/** 활성화 상태 표시용 링크 */
const NavLink = ({ href, children }: PropsWithChildren<{ href: string }>) => {
  const pathname = usePathname();
  const isRoot = href === "/admin";
  const active = isRoot
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        textDecoration: "none",
        color: active ? "#fff" : "#333",
        background: active ? "#a4825f" : "transparent",
        fontWeight: active ? 700 : 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  // 인증 체크
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    if (isLogin) {
      if (alive) {
        setAuthed(false);
        setReady(true);
      }
      return () => {
        alive = false;
        ac.abort();
      };
    }

    (async () => {
      try {
        const r = await fetch("/api/admin/me", {
          cache: "no-store",
          credentials: "same-origin",
          signal: ac.signal,
        });
        if (!r.ok) {
          if (r.status === 401) {
            const next = encodeURIComponent(pathname || "/admin");
            location.href = `/admin/login?next=${next}`;
            return;
          }
          if (alive) setAuthed(false);
        } else {
          if (alive) setAuthed(true);
        }
      } catch {
        if (alive) setAuthed(false);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [isLogin, pathname]);

  if (isLogin) return <main style={{ minHeight: "100vh" }}>{children}</main>;
  if (!ready || !authed) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* 상단 가로 네비게이션 */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "#fff",
          borderBottom: "1px solid #eee",
        }}
      >
        <nav
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "10px 16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, marginRight: 8 }}>관리자</div>

          {/* 메뉴들 */}
          <NavLink href="/admin">날짜별 손님 명부</NavLink>
          <NavLink href="/admin/rooms">호실 관리</NavLink>
          <NavLink href="/admin/cleaning-dashboard">청소 관리</NavLink>
          <NavLink href="/admin/cleaning-stats">청소금액관리</NavLink>
          <NavLink href="/admin/sms">문자 발송</NavLink>
          <NavLink href="/admin/sms-reservations">예약 문자</NavLink>
          <NavLink href="/admin/events">이벤트 로그</NavLink>
          <NavLink href="/admin/device-logs">기기제어 로그</NavLink>
          <NavLink href="/admin/parking">주차등록 로그</NavLink>

          {/* 새로 추가: 구분소유자 / 세금계산서 */}
          <NavLink href="/admin/unit-owners">구분소유자 관리</NavLink>
          <NavLink href="/admin/tax-invoices">세금계산서 관리</NavLink>

          <NavLink href="/admin/security">관리자 페이지 접속현황</NavLink>
          <NavLink href="/admin/account">관리자 관리</NavLink>
          <NavLink href="/admin/receipt">영수증 생성기</NavLink>


          {/* 우측 영역 */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              className="btn"
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                location.href = "/admin/login";
              }}
              style={{
                background: "#f4f4f4",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #e6e6e6",
              }}
            >
              로그아웃
            </button>
          </div>
        </nav>
      </header>

      {/* 본문 */}
      <main style={{ padding: 20, flex: 1 }}>{children}</main>
    </div>
  );
}
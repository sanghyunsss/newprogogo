// app/admin/sms-reservations/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";

type TargetRow = {
  to: string;
  name?: string | null;
  var2?: string | null; // 호실
  resultCode?: string | null;
  resultDesc?: string | null;
};

type Row = {
  id: number;
  createdAt: string;          // 예약 생성 시간
  scheduledAt: string | null; // 예약 발송 시각(있으면 예약건)
  messageKey: string | null;
  type: string;
  content: string;
  status: string;             // requested / success / partial / failed / canceled ...
  targets: TargetRow[];
};

type Res = { ok: boolean; page: number; totalPages: number; total: number; list: Row[] };

export default function ReservationPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [take, setTake] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // 24시간 HH:mm 입력값
  const pad = (n: number) => String(n).padStart(2, "0");
  const [reserveTime, setReserveTime] = useState<string>(() => {
    const now = new Date();
    return `${pad(now.getHours())}:00`;
  });

  const load = useCallback(async (p: number, t: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/sms-reservations?take=${t}&page=${p}`, { cache: "no-store" });
      const j: Res = await r.json();
      setRows(j.list || []);
      setPage(j.page || 1);
      setTotalPages(j.totalPages || 1);
      setTotal(j.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setPage(1); }, [take]);
  useEffect(() => { void load(page, take); }, [load, page, take]);

  // 예약 취소
  const cancelOne = async (messageKey: string | null) => {
    if (!messageKey) return alert("messageKey 없음");
    if (!confirm("이 예약 문자를 취소할까요?")) return;

    const r = await fetch("/api/admin/sms-reservations/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageKey }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (r.ok && j.ok) {
      alert("취소 완료");
      void load(page, take);
    } else {
      alert(j?.error || "취소 실패");
    }
  };

  // 당일 전체 예약 전송(시간 지정)
  const autoReserve = async (mode: "checkin" | "checkout") => {
    if (!reserveTime) return alert("시간을 입력해주세요 (예: 14:00)");
    if (!/^\d{2}:\d{2}$/.test(reserveTime)) return alert("시간 형식은 HH:mm 이어야 합니다.");

    // 오늘 날짜 + 시간(로컬) → "YYYY-MM-DDTHH:mm:00"
    const now = new Date();
    const y = now.getFullYear();
    const m = pad(now.getMonth() + 1);
    const d = pad(now.getDate());
    const sendTime = `${y}-${m}-${d}T${reserveTime}:00`;

    if (!confirm(`당일 ${mode === "checkin" ? "입실" : "퇴실"} 전체 고객에게 ${reserveTime} 예약 전송을 생성할까요?`)) return;

    const r = await fetch(`/api/sms/auto-reserve?mode=${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendTime }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean; reserved?: boolean; count?: number; error?: string;
    };

    if (r.ok && j.ok) {
      alert(
        j.reserved
          ? `예약 생성 완료 (총 ${j.count ?? 0}건)`
          : `3분 이내여서 즉시 발송 처리되었습니다. (총 ${j.count ?? 0}건)`
      );
      void load(page, take);
    } else {
      alert(j.error || "실패");
    }
  };

  // 즉시 발송(전체)
  const autoSendNow = async (mode: "checkin" | "checkout") => {
    if (!confirm(`당일 ${mode === "checkin" ? "입실" : "퇴실"} 고객 전체에게 지금 즉시 발송할까요?`)) return;
    const r = await fetch(`/api/sms/auto-send-now?mode=${mode}`, { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean; sent?: number; fallback?: number; failed?: number; error?: string;
    };
    if (r.ok) {
      alert(`즉시 발송 요청 완료 (성공:${j.sent ?? 0}, 카카오실패→LMS:${j.fallback ?? 0}, 실패:${j.failed ?? 0})`);
      void load(page, take);
    } else {
      alert(j.error || "실패");
    }
  };

  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ margin: "6px 0 12px" }}>예약 문자</h2>

      {/* 당일 전체 예약 전송 섹션 */}
      <section style={{ border: "1px solid #eee", padding: 16, borderRadius: 8, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, marginBottom: 8 }}>당일 전체 예약 전송</h3>
        <p style={{ color: "#666", marginTop: 0, marginBottom: 12, fontSize: 13 }}>
          지정한 시간에 당일 입실/퇴실 고객 전체에게 예약 문자를 전송합니다.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13 }}>발송 시간:</span>
          <input
            type="time"
            value={reserveTime}
            onChange={(e) => setReserveTime(e.target.value)}
            className="input"
            style={{ width: 120 }}
            step={60}
            lang="en-GB"   // 24시간제 표시 강제
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn btn-brown" onClick={() => void autoReserve("checkin")}>
            당일 입실 전체 고객 전송
          </button>
          <button className="btn btn-brown" onClick={() => void autoReserve("checkout")}>
            당일 퇴실 전체 고객 전송
          </button>
          <button className="btn" onClick={() => void autoSendNow("checkin")}>
            당일 입실 즉시 발송
          </button>
          <button className="btn" onClick={() => void autoSendNow("checkout")}>
            당일 퇴실 즉시 발송
          </button>
        </div>
      </section>

      {/* 표시 줄수/건수 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: "#666", fontSize: 13 }}>표시 줄수</span>
        <select className="input" value={take} onChange={(e) => setTake(Number(e.target.value))} style={{ width: 100 }}>
          <option value={50}>50줄</option>
          <option value={100}>100줄</option>
          <option value={300}>300줄</option>
          <option value={500}>500줄</option>
        </select>
        <div style={{ marginLeft: "auto", color: "#666", fontSize: 13 }}>
          총 {total.toLocaleString()}건 · {page}/{totalPages}페이지
        </div>
      </div>

      {/* 테이블 */}
      <div className="table-scroll">
        <table className="daily-table">
          <thead>
            <tr>
              <Th>예약 생성</Th>
              <Th>예약 발송시각</Th>
              <Th>이름</Th>
              <Th>연락처</Th>
              <Th>호실</Th>
              <Th>상태</Th>
              <Th>유형</Th>
              <Th>내용</Th>
              <Th>대상수</Th>
              <Th>실패사유(있을 때)</Th>
              <Th>취소</Th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", padding: 16, color: "#777" }}>
                  대기 중인 예약이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((m) => {
              const t = m.targets?.[0];
              const firstFail = m.targets?.find((x) => x.resultCode && x.resultCode !== "1000");
              const canCancel = !!m.messageKey && m.status === "requested";
              return (
                <tr key={m.id}>
                  <Td>{new Date(m.createdAt).toLocaleString()}</Td>
                  <Td>{m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : "—"}</Td>
                  <Td>{t?.name ?? "—"}</Td>
                  <Td>{t?.to ?? "—"}</Td>
                  <Td>{t?.var2 ?? "—"}</Td>
                  <Td><StatusBadge status={m.status} /></Td>
                  <Td>{m.type}</Td>
                  <Td
                    title={m.content}
                    style={{ maxWidth: 360, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                  >
                    {m.content}
                  </Td>
                  <Td>{m.targets?.length ?? 0}</Td>
                  <Td title={firstFail?.resultDesc ?? ""} style={{ color: firstFail ? "#b91c1c" : "#444" }}>
                    {firstFail ? `${firstFail.resultCode ?? ""} ${firstFail.resultDesc ?? ""}` : "—"}
                  </Td>
                  <Td>
                    <button className="btn" disabled={!canCancel} onClick={() => void cancelOne(m.messageKey)}>
                      예약 취소
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
        <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ◀ 이전
        </button>
        <div style={{ alignSelf: "center", color: "#666" }}>
          {page} / {totalPages}
        </div>
        <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          다음 ▶
        </button>
      </div>
    </div>
  );
}

/* ===== 보조 컴포넌트 ===== */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending:   { bg: "#f3f4f6", fg: "#374151", label: "대기" },     // 발송 전 우리가 먼저 넣은 상태
    requested: { bg: "#e0f2fe", fg: "#075985", label: "접수됨" },   // 푸리오에 접수 완료(콜백에서 갱신)
    success:   { bg: "#ecfdf5", fg: "#065f46", label: "성공" },
    partial:   { bg: "#fef9c3", fg: "#854d0e", label: "부분성공" },
    failed:    { bg: "#fee2e2", fg: "#991b1b", label: "실패" },
    canceled:  { bg: "#e5e7eb", fg: "#374151", label: "취소" },
  };
  const s = map[status] ?? { bg: "#eef2ff", fg: "#3730a3", label: status };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 8px",
        borderBottom: "1px solid #eee",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  title,
  style,
}: {
  children: React.ReactNode;
  mono?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      title={title}
      style={{
        padding: "10px 8px",
        verticalAlign: "top",
        fontFamily: mono
          ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
          : undefined,
        ...(style || {}),
      }}
    >
      {children}
    </td>
  );
}
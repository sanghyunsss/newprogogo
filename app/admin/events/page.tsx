// app/admin/events/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type EventRow = {
  id: number;
  room: string;
  type: "checkin" | "checkout";
  ts: string;
  verified: boolean;
};

type ErrorJson = { error?: string };
const isErrorJson = (v: unknown): v is ErrorJson => !!v && typeof v === "object" && "error" in v;
async function errorText(r: Response) {
  try {
    const j = (await r.json()) as unknown;
    if (isErrorJson(j) && typeof j.error === "string") return `HTTP ${r.status} - ${j.error}`;
  } catch {}
  return `HTTP ${r.status}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 기본 50
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = useCallback(
    async (p: number, ps: number) => {
      try {
        const r = await fetch(`/api/admin/events?page=${p}&pageSize=${ps}`, { cache: "no-store" });
        if (!r.ok) throw new Error(await errorText(r));
        const d = (await r.json()) as { rows: EventRow[]; total: number; page: number };
        setEvents(d.rows || []);
        setTotal(d.total || 0);
        setPage(d.page || 1);
      } catch {
        console.warn("이벤트 로드 실패");
      }
    },
    []
  );

  useEffect(() => {
    void load(1, pageSize);
  }, [load, pageSize]);

  return (
    <div className="card">
      <h2 className="section-title">이벤트 로그</h2>

      <div className="admin-filters" style={{ justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
        <label className="muted" htmlFor="ps">표시 줄수</label>
        <select
          id="ps"
          className="input"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{ width: 120 }}
        >
          {[50, 100, 200, 500].map((n) => (
            <option key={n} value={n}>
              {n}줄
            </option>
          ))}
        </select>
      </div>

      <table className="daily-table">
        <thead>
          <tr>
            <th style={{ width: 80 }}>ID</th>
            <th style={{ width: 100 }}>호실</th>
            <th style={{ width: 110 }}>유형</th>
            <th>시간</th>
            <th style={{ width: 100 }}>검증</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.id}</td>
              <td>{e.room}</td>
              <td>{e.type}</td>
              <td>{new Date(e.ts).toLocaleString("ko-KR")}</td>
              <td>{e.verified ? "일치" : "불일치"}</td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: "center" }}>
                데이터 없음
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
        <button
          className="btn"
          disabled={page <= 1}
          onClick={() => {
            const p = Math.max(1, page - 1);
            setPage(p);
            void load(p, pageSize);
          }}
        >
          이전
        </button>
        <span className="muted">
          {page} / {totalPages}
        </span>
        <button
          className="btn"
          disabled={page >= totalPages}
          onClick={() => {
            const p = Math.min(totalPages, page + 1);
            setPage(p);
            void load(p, pageSize);
          }}
        >
          다음
        </button>
      </div>
    </div>
  );
}
// app/admin/device-log/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Log = {
  id: number;
  createdAt: string;
  controlType: string;
  status: "success" | "fail";
  message?: string | null;
  roomNumber?: string | null;
  roomId?: number | null;
  guestId?: number | null;
  actor?: "admin" | "guest" | "system";
  actorName?: string | null;
};

export default function DeviceLogPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const load = useCallback(async (p: number, ps: number) => {
    const r = await fetch(`/api/device-logs?page=${p}&pageSize=${ps}`, { cache: "no-store" });
    const j = await r.json();
    setRows(j.rows || []);
    setTotal(j.total || 0);
    setPage(p); // 요청한 p를 그대로 반영
  }, []);

  // ✅ 최초 1회 + pageSize 변경 시에만 1페이지 로드
  useEffect(() => { void load(1, pageSize); }, [pageSize, load]);
  return (
    <div className="admin-wrap">
      <section className="card">
        <h2 className="section-title">기기제어 로그</h2>

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
              <option key={n} value={n}>{n}줄</option>
            ))}
          </select>
        </div>

        <div className="table-scroll">
          <table className="daily-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>방</th>
                <th>타입</th>
                <th>상태</th>
                <th>요청자</th>
                <th>메시지</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                  <td>{r.roomNumber ?? (r.roomId ?? "")}</td>
                  <td>{r.controlType}</td>
                  <td style={{ color: r.status === "success" ? "#1a7f37" : "#b42318" }}>{r.status}</td>
                  <td>
                    {r.actor === "admin" ? "관리자" : r.actor === "guest" ? "사용자" : "시스템"}
                    {r.actorName ? ` (${r.actorName})` : ""}
                  </td>
                  <td style={{ textAlign: "left" }}>{r.message ?? ""}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>로그가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", justifyContent: "center" }}>
          <button
            className="btn"
            disabled={page <= 1}
            onClick={() => { const p = Math.max(1, page - 1); void load(p, pageSize); }}
          >
            이전
          </button>
          <span className="muted">{page} / {totalPages}</span>
          <button
            className="btn"
            disabled={page >= totalPages}
            onClick={() => { const p = Math.min(totalPages, page + 1); void load(p, pageSize); }}
          >
            다음
          </button>
        </div>
      </section>
    </div>
  );
}
// app/admin/parking/ParkingClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LogRow = {
  id: number;
  createdAtISO: string;
  createdAtYmd: string;
  checkinAt: string;
  checkoutAt: string;
  room: string;
  name: string;
  contact: string;
  carNo: string;
  source: string;
  note: string;
};
type ListResp = { rows: LogRow[]; total: number; page: number; pageSize: number };

async function fetchJSON<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const r = await fetch(input, { cache: "no-store", ...init });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status}${t ? ` - ${t}` : ""}`);
  }
  return (await r.json()) as T;
}
const pad = (n: number) => String(n).padStart(2, "0");
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const digits = (s: string) => (s || "").replace(/\D+/g, "");

export default function ParkingClient() {
  const [range, setRange] = useState({ start: todayYmd(), end: todayYmd() });
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const [autoMin, setAutoMin] = useState<number>(5);
  const [regLoadingId, setRegLoadingId] = useState<number | null>(null);

  const pageRef = useRef(page);
  const pageSizeRef = useRef(pageSize);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

  async function load(p = page, ps = pageSize) {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (range.start) qs.set("start", range.start);
      if (range.end) qs.set("end", range.end);
      qs.set("page", String(p));
      qs.set("pageSize", String(ps));
      const d = await fetchJSON<ListResp>(`/api/admin/parking?${qs}`);
      setRows(d.rows || []);
      setTotal(d.total || 0);
      setPage(d.page || 1);
    } catch (e) {
      alert("조회 실패: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(1, pageSize); }, [pageSize]);
  useEffect(() => { void load(1, pageSize); }, [range.start, range.end]);

  useEffect(() => {
    const timer = setInterval(() => { void load(pageRef.current, pageSizeRef.current); }, autoMin * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoMin]);

  async function onDelete(id: number) {
    if (!confirm(`이 로그(id=${id})를 삭제할까요?`)) return;
    try {
      const r = await fetch(`/api/admin/parking?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      const nextPage = rows.length === 1 && page > 1 ? page - 1 : page;
      await load(nextPage, pageSize);
    } catch (e) {
      alert("삭제 실패: " + (e as Error).message);
    }
  }

  async function onManualRegister(row: LogRow) {
    const carNoTrimmed = (row.carNo || "").trim();
    const contactDigits = digits(row.contact || "");
    if (!carNoTrimmed || carNoTrimmed === "차량없음" || contactDigits.length < 8 || !row.checkinAt || !row.checkoutAt) {
      alert("차량번호/연락처/입퇴실 시간이 유효하지 않습니다. 연락처는 숫자 8자리 이상이어야 합니다.");
      return;
    }
    if (!confirm(`[수동등록]\n차량: ${row.carNo}\n연락처: ${contactDigits}\n이름: ${row.name || "-"}\n진행할까요?`)) return;

    setRegLoadingId(row.id);
    try {
      const body = {
        id: row.id,                         // ✅ 서버에 id 전달
        carNo: carNoTrimmed,
        contact: contactDigits,
        name: (row.name || "").trim(),
        checkinAt: row.checkinAt,
        checkoutAt: row.checkoutAt,
      };
      const r = await fetch("/api/admin/humax/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      if (!r.ok) {
        alert(`휴맥스 등록 실패\nHTTP ${r.status}\n${text}`);
        return;
      }
      alert("휴맥스 등록 성공\n" + text);
      await load(page, pageSize);
    } catch (e) {
      alert("수동 등록 실패: " + (e as Error).message);
    } finally {
      setRegLoadingId(null);
    }
  }

  const downloadCSV = () => {
    const header = ["등록시간","입실 시간","퇴실 시간","객실","이름","연락처","차량번호","출처","비고"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const line = [
        r.createdAtYmd,r.checkinAt,r.checkoutAt,r.room,r.name,r.contact,r.carNo,r.source,r.note ?? ""
      ].map((v) => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(",");
      lines.push(line);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `parking-logs_${range.start}_${range.end}_p${page}_ps${pageSize}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-wrap">
      <section className="card">
        <h2 className="section-title">주차등록 로그</h2>
        <div className="row-1">
          <span className="lbl wide">기간</span>
          <input className="input grow" type="date" value={range.start} onChange={(e) => setRange((v) => ({ ...v, start: e.target.value }))} />
          <span className="dash">~</span>
          <input className="input grow" type="date" value={range.end} onChange={(e) => setRange((v) => ({ ...v, end: e.target.value }))} />
          <button className="btn primary sm" onClick={() => void load(1, pageSize)} disabled={loading}>조회</button>
        </div>
        <div className="row-2">
          <div className="right">
            <label className="lbl">표시 줄수</label>
            <select className="input sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[50, 100, 200, 500].map((n) => (<option key={n} value={n}>{n}줄</option>))}
            </select>
            <label className="lbl">자동 새로고침</label>
            <select className="input sm" value={autoMin} onChange={(e) => setAutoMin(Number(e.target.value))}>
              {[1, 3, 5, 10, 30].map((m) => (<option key={m} value={m}>{m}분</option>))}
            </select>
            <button className="btn sm" onClick={downloadCSV} disabled={rows.length === 0}>CSV 다운로드</button>
          </div>
        </div>
        <div className="muted stat">총 {total}건</div>
        <div className="table-box">
          <table className="daily-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th>등록시간</th>
                <th>입실 시간</th>
                <th>퇴실 시간</th>
                <th>객실</th>
                <th>이름</th>
                <th>연락처</th>
                <th>차량번호</th>
                <th>출처</th>
                <th>비고</th>
                <th style={{ width: 110 }}>수동 등록</th>
                <th style={{ width: 90 }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="muted" style={{ textAlign: "center" }}>데이터가 없습니다.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.createdAtYmd}</td>
                  <td>{r.checkinAt}</td>
                  <td>{r.checkoutAt}</td>
                  <td>{r.room}</td>
                  <td>{r.name}</td>
                  <td>{r.contact}</td>
                  <td>{r.carNo}</td>
                  <td>{r.source}</td>
                  <td>{r.note ?? ""}</td>
                  <td>
                    <button className="btn primary sm" disabled={regLoadingId === r.id} onClick={() => void onManualRegister(r)} title="이 행을 즉시 휴맥스에 등록">
                      {regLoadingId === r.id ? "등록중..." : "수동 등록"}
                    </button>
                  </td>
                  <td>
                    <button className="btn danger sm" onClick={() => void onDelete(r.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagenav">
          <button className="btn sm" disabled={page <= 1 || loading} onClick={() => { const p = Math.max(1, page - 1); setPage(p); void load(p, pageSize); }}>이전</button>
          <span className="muted">{page} / {totalPages}</span>
          <button className="btn sm" disabled={page >= totalPages || loading} onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); void load(p, pageSize); }}>다음</button>
        </div>
      </section>

      <style jsx>{`
        .row-1 { display: grid; grid-template-columns: 56px 1fr auto 1fr auto; gap: 10px; align-items: center; margin-bottom: 8px; }
        .row-2 { display: grid; grid-template-columns: 1fr; }
        .right { display: inline-flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }
        .lbl { color: #666; font-size: 14px; white-space: nowrap; }
        .lbl.wide { width: 56px; text-align: left; }
        .dash { color: #999; padding: 0 4px; }
        .input { height: 34px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
        .input.grow { width: 100%; }
        .input.sm { height: 30px; padding: 2px 8px; min-width: 84px; width: 92px; }
        .btn { height: 34px; padding: 0 12px; border-radius: 6px; border: 1px solid #ddd; background: #fafafa; }
        .btn.sm { height: 30px; padding: 0 10px; }
        .btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .btn.danger { background: #ef4444; border-color: #ef4444; color: #fff; }
        .stat { margin: 6px 0; }
        .table-box { margin-top: 8px; border: 1px solid #eee; border-radius: 8px; overflow: auto; max-height: 60vh; }
        .daily-table { min-width: 1300px; width: 100%; border-collapse: separate; border-spacing: 0; }
        .daily-table th, .daily-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
        .daily-table thead th { position: sticky; top: 0; background: #fafafa; z-index: 1; border-bottom: 1px solid #e5e5e5; }
        .pagenav { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: 12px; }
        @media (max-width: 920px) { .row-1 { grid-template-columns: 56px 1fr auto 1fr; } }
        @media (max-width: 560px) { .row-1 { grid-template-columns: 56px 1fr; } .dash { display: none; } }
      `}</style>
    </div>
  );
}
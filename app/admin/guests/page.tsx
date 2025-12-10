"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BookingRow = {
  id: number;
  roomType: string | null;
  assignedRoom: string;
  checkIn: string;   // ISO
  checkOut: string;  // ISO
  guestName: string;
  phone: string;
};

type ByDateResponse =
  | { ok: true; count: number; rows: BookingRow[] }
  | { ok: false; error: string };

type UploadResponse =
  | { ok: true; total: number; created: number; updated: number; byDate: Record<string, number> }
  | { ok: false; error: string };

function fmt(dt: string) {
  const d = new Date(dt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${da} ${hh}:${mm}`;
}

export default function GuestsPage() {
  const todayKST = useMemo(() => {
    const now = new Date();
    const kstOffsetMin = 9 * 60;
    const localOffsetMin = -now.getTimezoneOffset();
    const deltaMin = kstOffsetMin - localOffsetMin;
    const kst = new Date(now.getTime() + deltaMin * 60 * 1000);
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, "0");
    const d = String(kst.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const [date, setDate] = useState<string>(todayKST);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [log, setLog] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/by-date?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const data = (await res.json()) as ByDateResponse;
      if ("ok" in data && data.ok) setRows(data.rows);
      else setRows([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setUploading(true);
    setLog("");
    try {
      const res = await fetch("/api/bookings/upload", { method: "POST", body: form });
      const data = (await res.json()) as UploadResponse;
      setLog(JSON.stringify(data, null, 2));
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLog(msg);
    } finally {
      setUploading(false);
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>날짜별 손님명부</h1>
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button
          type="button"
          onClick={() => void load()}
          style={{ marginLeft: "auto", fontSize: 13, textDecoration: "underline" }}
        >
          새로고침
        </button>
      </header>

      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <form onSubmit={onUpload} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
          <button
            type="submit"
            disabled={uploading}
            style={{ padding: "8px 12px", borderRadius: 8, background: "#111", color: "#fff", fontWeight: 700 }}
          >
            {uploading ? "업로드 중" : "엑셀 업로드"}
          </button>
          <a
            href="/guest_upload_sample.xlsx"
            style={{ marginLeft: 8, fontSize: 13, textDecoration: "underline" }}
          >
            샘플 엑셀 받기
          </a>
        </form>

        {log && (
          <pre style={{ marginTop: 10, padding: 10, background: "#f7f7f8", borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap" }}>
            {log}
          </pre>
        )}
      </section>

      <section>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
          {loading ? "불러오는 중" : `총 ${rows.length}건`}
        </div>
        <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>객실타입</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>호실</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>입실</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>퇴실</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>예약자명</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>연락처</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, textAlign: "center", color: "#888" }}>
                    데이터 없음
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 10 }}>{r.roomType ?? "-"}</td>
                    <td style={{ padding: 10 }}>{r.assignedRoom}</td>
                    <td style={{ padding: 10, lineHeight: 1.35 }}>{fmt(r.checkIn)}</td>
                    <td style={{ padding: 10, lineHeight: 1.35 }}>{fmt(r.checkOut)}</td>
                    <td style={{ padding: 10 }}>{r.guestName}</td>
                    <td style={{ padding: 10 }}>{r.phone}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
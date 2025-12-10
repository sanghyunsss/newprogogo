"use client";

import { useEffect, useState } from "react";

type AdminRow = { id: number; email: string; createdAt: string; updatedAt: string };

async function j<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const r = await fetch(input, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
  return (await r.json()) as T;
}

export default function AdminAccountPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d = await j<{ rows: AdminRow[] }>("/api/admin/users");
    setRows(d.rows || []);
  };

  useEffect(() => {
    (async () => {
      try { await j("/api/admin/me"); } catch { location.href = `/admin/login?next=${encodeURIComponent("/admin/account")}`; return; }
      await load();
    })();
  }, []);

  const add = async () => {
    if (!email || !pw) return alert("이메일/비밀번호를 입력하세요.");
    setBusy(true);
    try {
      await j("/api/admin/users", { method: "POST", body: JSON.stringify({ email, password: pw }) });
      setEmail(""); setPw("");
      await load();
      alert("추가되었습니다.");
    } catch (e) {
      alert("추가 실패: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const resetPw = async (id: number) => {
    const npw = prompt("새 비밀번호 입력");
    if (!npw) return;
    setBusy(true);
    try {
      await j(`/api/admin/users/${id}/password`, { method: "PUT", body: JSON.stringify({ password: npw }) });
      alert("변경되었습니다.");
    } catch (e) {
      alert("변경 실패: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  const del = async (id: number) => {
    if (!confirm("정말 삭제할까요?")) return;
    setBusy(true);
    try {
      await j(`/api/admin/users/${id}`, { method: "DELETE" });
      await load();
      alert("삭제되었습니다.");
    } catch (e) {
      alert("삭제 실패: " + (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-wrap">
      <section className="card">
        <h2 className="section-title">마이페이지 · 관리자 관리</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input className="input" placeholder="이메일" value={email} onChange={(e)=>setEmail(e.target.value)} style={{ minWidth: 260 }} />
          <input className="input" placeholder="비밀번호" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} style={{ minWidth: 220 }} />
          <button className="btn btn-brown" onClick={add} disabled={busy}>관리자 추가</button>
          <button className="btn" onClick={()=>void load()} disabled={busy}>새로고침</button>
        </div>

        <div className="table-scroll">
          <table className="daily-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>ID</th>
                <th style={{ width: 320 }}>Email</th>
                <th>Created</th>
                <th>Updated</th>
                <th style={{ width: 240 }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: "center" }}>데이터 없음</td></tr>}
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.email}</td>
                  <td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                  <td>{new Date(r.updatedAt).toLocaleString("ko-KR")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn" onClick={()=>resetPw(r.id)} disabled={busy}>비밀번호 변경</button>
                      <button className="btn danger" onClick={()=>del(r.id)} disabled={busy}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .input{height:34px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;background:#fff}
        .btn{height:34px;padding:0 12px;border-radius:6px;border:1px solid #ddd;background:#fafafa}
        .btn.btn-brown{background:#6b4e3d;color:#fff;border-color:#6b4e3d}
        .btn.danger{background:#ef4444;border-color:#ef4444;color:#fff}
        .table-scroll{border:1px solid #eee;border-radius:8px;overflow:auto;max-height:65vh}
        .daily-table{width:100%;border-collapse:separate;border-spacing:0}
        .daily-table th,.daily-table td{padding:10px 12px;border-bottom:1px solid #f0f0f0}
        .daily-table thead th{position:sticky;top:0;background:#fafafa;z-index:1;border-bottom:1px solid #e5e5e5}
      `}</style>
    </div>
  );
}
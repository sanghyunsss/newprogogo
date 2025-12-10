// app/admin/security/page.tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type ActiveRow = {
  ip: string;
  who?: string | null;
  lastSeen: string;
  count: number;
  lastPath?: string;
  lastUA?: string;
};

type BannedRow = {
  id: number;
  ip: string;
  reason?: string | null;
  until?: string | null; // null = 영구
  createdAt: string;
};

export default function SecurityPage() {
  const [tab, setTab] = useState<"active" | "banned">("active");
  const [rows, setRows] = useState<ActiveRow[]>([]);
  const [banned, setBanned] = useState<BannedRow[]>([]);
  const [mins, setMins] = useState(5);
  const [autoSec, setAutoSec] = useState(5);

  async function j<T>(url: string, init?: RequestInit) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()) as T;
  }

  const load = async () => {
    if (tab === "active") {
      const d = await j<{ rows: ActiveRow[] }>(`/api/admin/security/active?minutes=${mins}`);
      setRows(d.rows || []);
    } else {
      const d = await j<{ rows: BannedRow[] }>("/api/admin/security/banned");
      setBanned(d.rows || []);
    }
  };

  useEffect(() => { void load(); }, [tab, mins]);
  useEffect(() => {
    if (autoSec <= 0) return;
    const t = setInterval(() => { void load(); }, autoSec * 1000);
    return () => clearInterval(t);
  }, [autoSec, tab, mins]);

  const ban = async (ip: string) => {
    const minutes = Number(prompt("차단 시간(분). 0 = 영구", "0") || "0");
    const reason = prompt("차단 사유", "suspicious") || "";
    await j("/api/admin/security/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, minutes, reason }),
    });
    await load();
  };

  const unban = async (ip: string) => {
    await j(`/api/admin/security/ban?ip=${encodeURIComponent(ip)}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="admin-wrap">
      <section className="card">
        <div className="flex-between">
          <h2 className="section-title">보안 모니터링</h2>
          <div className="tab-links">
            <Link href="/admin/sessions" className="btn primary">로그인된 기기 보기</Link>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "active" ? "on" : ""}`} onClick={() => setTab("active")}>최근 접속</button>
          <button className={`tab ${tab === "banned" ? "on" : ""}`} onClick={() => setTab("banned")}>차단된 IP</button>
        </div>

        <div className="toolbar">
          <div className="left">
            {tab === "active" && (
              <>
                <label>최근</label>
                <select className="input sm" value={mins} onChange={(e) => setMins(Number(e.target.value))}>
                  {[1,3,5,10,30,60].map(m=><option key={m} value={m}>{m}분</option>)}
                </select>
                <button className="btn sm primary" onClick={() => void load()}>새로고침</button>
              </>
            )}
            {tab === "banned" && (
              <button className="btn sm primary" onClick={() => void load()}>새로고침</button>
            )}
          </div>
          <div className="right">
            <label>자동 새로고침</label>
            <select className="input sm" value={autoSec} onChange={(e) => setAutoSec(Number(e.target.value))}>
              {[0,3,5,10,30].map(s=><option key={s} value={s}>{s===0?"끄기":`${s}초`}</option>)}
            </select>
          </div>
        </div>

        {tab === "active" ? (
          <div className="table-scroll">
            <table className="daily-table" style={{minWidth:960}}>
              <thead><tr><th>IP</th><th>사용자</th><th>최근 시각</th><th>요청수</th><th>최근 경로</th><th>액션</th></tr></thead>
              <tbody>
                {rows.length===0 && <tr><td colSpan={6} style={{textAlign:"center"}}>데이터 없음</td></tr>}
                {rows.map(r=>(
                  <tr key={r.ip}>
                    <td>{r.ip}</td>
                    <td>{r.who ?? "-"}</td>
                    <td>{new Date(r.lastSeen).toLocaleString("ko-KR")}</td>
                    <td>{r.count}</td>
                    <td>{r.lastPath ?? "-"}</td>
                    <td><button className="btn sm danger" onClick={()=>ban(r.ip)}>차단</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="daily-table" style={{minWidth:860}}>
              <thead><tr><th>IP</th><th>사유</th><th>만료</th><th>생성</th><th>액션</th></tr></thead>
              <tbody>
                {banned.length===0 && <tr><td colSpan={5} style={{textAlign:"center"}}>차단된 IP 없음</td></tr>}
                {banned.map(b=>{
                  const isPermanent = !b.until;
                  return (
                    <tr key={b.id} style={isPermanent?{color:"#b91c1c",fontWeight:600}:undefined}>
                      <td>{b.ip}</td>
                      <td>{b.reason ?? "-"}</td>
                      <td>{isPermanent?"영구 차단":new Date(b.until!).toLocaleString("ko-KR")}</td>
                      <td>{new Date(b.createdAt).toLocaleString("ko-KR")}</td>
                      <td><button className="btn sm" onClick={()=>unban(b.ip)}>해제</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .flex-between{display:flex;align-items:center;justify-content:space-between;}
        .tab-links{display:flex;gap:8px;}
        .tabs{display:flex;gap:8px;margin-top:10px;}
        .tab{padding:6px 12px;border:1px solid #ccc;border-radius:6px;background:#f8f8f8;}
        .tab.on{background:#a4825f;color:#fff;border-color:#a4825f;}
        .toolbar{display:flex;justify-content:space-between;align-items:center;margin:10px 0;}
        .btn{height:32px;padding:0 10px;border-radius:6px;border:1px solid #ccc;background:#f8f8f8;}
        .btn.sm{height:28px;}
        .btn.primary{background:#2563eb;color:#fff;border-color:#2563eb;}
        .btn.danger{background:#ef4444;color:#fff;border-color:#ef4444;}
        .input.sm{height:28px;padding:0 6px;}
        .table-scroll{border:1px solid #eee;border-radius:8px;overflow:auto;max-height:65vh;}
        .daily-table{width:100%;border-collapse:collapse;}
        th,td{padding:8px 10px;border-bottom:1px solid #f0f0f0;}
        thead th{background:#fafafa;position:sticky;top:0;}
      `}</style>
    </div>
  );
}
"use client";
import { useEffect, useState } from "react";

type Row = { id:number; ip?:string|null; ua?:string|null; createdAt:string; expiresAt:string;
  admin:{ id:number; email:string } };

export default function SessionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => { const r = await fetch("/api/admin/sessions",{cache:"no-store"}); const d = await r.json(); setRows(d.rows||[]); };
  const kill = async (id:number) => { if(!confirm("이 세션을 강제 로그아웃할까요?")) return; await fetch(`/api/admin/sessions/${id}`,{method:"DELETE"}); await load(); };
  useEffect(()=>{ void load(); },[]);
  return (
    <div className="admin-wrap">
      <section className="card">
        <h2 className="section-title">로그인된 기기</h2>
        <button className="btn" onClick={load}>새로고침</button>
        <div className="table-scroll" style={{marginTop:8}}>
          <table className="daily-table" style={{minWidth:900}}>
            <thead><tr><th>ID</th><th>Email</th><th>IP</th><th>UA</th><th>로그인</th><th>만료</th><th>액션</th></tr></thead>
            <tbody>
              {rows.length===0 && <tr><td colSpan={7} className="muted" style={{textAlign:"center"}}>세션 없음</td></tr>}
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>{r.id}</td><td>{r.admin.email}</td><td>{r.ip||"-"}</td>
                  <td style={{maxWidth:420, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.ua||"-"}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{new Date(r.expiresAt).toLocaleString()}</td>
                  <td><button className="btn danger" onClick={()=>kill(r.id)}>강제 로그아웃</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
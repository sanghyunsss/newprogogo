"use client";

import { useEffect, useState } from "react";

type Row = { workerId:number; name:string; count:number; amount:number };

async function jget<T>(url:string){
  const r = await fetch(url, { cache:"no-store", credentials:"include" });
  if(!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

const pad2 = (n:number)=>String(n).padStart(2,"0");
const today = ()=>{ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };

export default function CleaningStats(){
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState<"day"|"week"|"month">("month");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  const reload = async ()=>{
    setErr("");
    try{
      const d = await jget<{rows:Row[]}>(`/api/cleaning/stats?date=${date}&period=${period}`);
      setRows(d.rows||[]);
    }catch(e:any){ setErr(String(e?.message||e)); setRows([]); }
  };

  useEffect(()=>{ void reload(); },[date,period]);

  const total = rows.reduce((s,r)=>s+r.amount,0);

  return (
    <div style={{display:"grid",gap:12}}>
      <h1 style={{fontSize:22,fontWeight:800}}>청소 정산 통계</h1>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)}/>
        <select className="input" value={period} onChange={e=>setPeriod(e.target.value as any)}>
          <option value="day">일간</option>
          <option value="week">주간</option>
          <option value="month">월간</option>
        </select>
        <button className="btn" onClick={()=>void reload()}>새로고침</button>
        <div style={{marginLeft:"auto"}} />
        <b>합계: {total.toLocaleString()}원</b>
      </div>
      {err && <div style={{color:"#b00"}}>{err}</div>}

      <div className="table-scroll">
        <table className="table" style={{minWidth:720}}>
          <thead>
            <tr><th style={{width:100}}>작업자ID</th><th>이름</th><th style={{width:120}}>건수</th><th style={{width:160}}>금액</th></tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.workerId}>
                <td>{r.workerId}</td>
                <td>{r.name}</td>
                <td>{r.count.toLocaleString()}</td>
                <td>{r.amount.toLocaleString()}원</td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={4} className="muted" style={{textAlign:"center"}}>데이터 없음</td></tr>}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { border-bottom:1px solid #f0f0f0; padding:8px; text-align:left; }
        .table-scroll { overflow:auto; }
        .input { border:1px solid #ddd; border-radius:8px; padding:8px 10px; min-height:36px; }
        .btn { border:1px solid #ddd; border-radius:10px; padding:8px 12px; background:#f7f7f7; }
        .muted { color:#888; }
      `}</style>
    </div>
  );
}
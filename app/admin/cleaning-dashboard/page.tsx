// app/admin/cleaning-dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ===================== Types ===================== */
type Worker = { id: number; name: string; phone: string; isActive: boolean };
type Room   = { id: number; number: string; roomType?: string | null };
type Photo  = { id:number; url:string; uploadedAt:string };
type Task   = {
  id: number; roomId: number; date: string; checkoutTime?: string | null;
  status: "PENDING"|"DOING"|"DONE"|"HOLD";
  memo?: string|null; worker?: Worker|null; room?: Room|null; guest?: { id:number }|null;
  photos?: Photo[];
};
type DailyRow = {
  id: number;
  roomId: number | null;
  room: { number: string } | null;
  roomType?: string;
  startDate: string; endDate: string;
  startTime?: string; endTime?: string;
};

/* ===================== Utils ===================== */
const pad2 = (n:number)=>String(n).padStart(2,"0");
const today = ()=>{ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };

async function jget<T>(url: string){
  const r = await fetch(url,{ cache:"no-store", credentials:"include" });
  const t = await r.text(); if(!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}
async function jpost<T>(url: string, body:any){
  const r = await fetch(url,{
    method:"POST", headers:{ "content-type":"application/json" },
    body: JSON.stringify(body), cache:"no-store", credentials:"include",
  });
  const t = await r.text(); if(!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}
async function jpatch<T>(url: string, body:any){
  const r = await fetch(url,{
    method:"PATCH", headers:{ "content-type":"application/json" },
    body: JSON.stringify(body), cache:"no-store", credentials:"include",
  });
  const t = await r.text(); if(!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}
async function jdel<T>(url: string){
  const r = await fetch(url,{ method:"DELETE", cache:"no-store", credentials:"include" });
  const t = await r.text(); if(!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}

function StatusPill({s}:{s:Task["status"]}) {
  const map: Record<Task["status"], {bg:string;label:string}> = {
    PENDING:{bg:"#f5e8c8",label:"대기"},
    DOING:{bg:"#d9ecff",label:"작업중"},
    DONE:{bg:"#d5f5d5",label:"완료"},
    HOLD:{bg:"#ffd6d6",label:"보류"},
  };
  const x=map[s];
  return <span style={{background:x.bg,border:"1px solid #ddd",padding:"2px 8px",borderRadius:12,fontSize:12}}>{x.label}</span>;
}

/* ===================== Sorting / Filtering Helpers ===================== */
type SortDir = "asc"|"desc";
type AutoSortKey = "room"|"roomType";
type TaskSortKey = "room"|"roomType";

const numFromRoom = (roomNo?: string|null) => {
  if (!roomNo) return Number.POSITIVE_INFINITY;
  const m = String(roomNo).match(/\d+/g);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m.join(""));
};

const cmp = (a:number|string, b:number|string, dir:SortDir) => {
  const base = typeof a === "number" && typeof b === "number"
    ? (a - b)
    : String(a).localeCompare(String(b), "ko", { numeric:true, sensitivity:"base" });
  return dir === "asc" ? base : -base;
};

/* ===================== Page ===================== */
export default function CleaningDashboard(){
  const [date,setDate] = useState(today());
  const [workers,setWorkers]=useState<Worker[]>([]);
  const [rooms,setRooms]=useState<Room[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [autoList,setAutoList]=useState<DailyRow[]>([]);
  const [err,setErr]=useState("");
  const [loading, setLoading] = useState(false);

  // 링크 표시 상태
  const [linkForWorker, setLinkForWorker] = useState<{workerId:number, url:string} | null>(null);

  // modals
  const [showWorker, setShowWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name:"", phone:"" });
  const [rateMap, setRateMap] = useState<Record<string, number>>({});
  const [manageWorkers, setManageWorkers] = useState(false);

  const [showManual,setShowManual]=useState(false);
  const [manual,setManual]=useState<{roomId:number; date:string; time:string; workerId:number|null; memo:string}>({roomId:0,date:today(),time:"11:00",workerId:null,memo:""});

  // gallery
  const [galleryTask, setGalleryTask] = useState<Task|null>(null);

  // 정렬·필터 상태
  const [workerFilter, setWorkerFilter] = useState<number>(0);
  const [autoSortKey, setAutoSortKey] = useState<AutoSortKey>("room");
  const [autoSortDir, setAutoSortDir] = useState<SortDir>("asc");
  const [taskSortKey, setTaskSortKey] = useState<TaskSortKey>("room");
  const [taskSortDir, setTaskSortDir] = useState<SortDir>("asc");

  // 단가 편집 모달 상태
  const [rateEditorOpen, setRateEditorOpen] = useState(false);
  const [rateEditorWorker, setRateEditorWorker] = useState<{ id:number; name:string }|null>(null);
  const [rateEditor, setRateEditor] = useState<Record<string, number>>({});
  const [rateTypes, setRateTypes] = useState<string[]>([]);

  /* ===== Helpers: 로컬 상태 즉시 반영 ===== */
  const applyWorkerPatchLocal = (id:number, patch: Partial<Worker>)=>{
    setWorkers(prev => prev.map(w => w.id===id ? { ...w, ...patch } : w));
    if (patch.isActive === false && linkForWorker?.workerId === id) setLinkForWorker(null);
  };
  const removeWorkerLocal = (id:number)=>{
    setWorkers(prev => prev.filter(w => w.id !== id));
    if (linkForWorker?.workerId === id) setLinkForWorker(null);
  };

  const reload = async ()=>{
    setErr("");
    setLoading(true);
    try {
      const [w, t, r, d] = await Promise.all([
        jget<{rows:Worker[]}>("/api/cleaning/workers"),
        jget<{rows:Task[]}>(`/api/cleaning/tasks?date=${encodeURIComponent(date)}`),
        jget<{ rows: Room[] }>("/api/rooms?sort=number:asc"),
        jget<{ rows: DailyRow[] }>(`/api/cleaning/autolist?date=${encodeURIComponent(date)}`),
      ]);
      setWorkers(w.rows||[]);
      setTasks((t.rows||[]).map(x=>({...x, date})));
      setRooms(r.rows||[]);
      setAutoList(d.rows || []);

      const types = Array.from(new Set((r.rows||[]).map(x=>x.roomType).filter((v): v is string => !!v)));
      setRateMap(m=>{
        const next: Record<string, number> = {...m};
        for(const tp of types) if(!(tp in next)) next[tp] = 0;
        return next;
      });
    } catch(e:any) {
      setErr(String(e?.message || e));
      setWorkers([]); setTasks([]); setRooms([]); setAutoList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ void reload(); },[date]);
  useEffect(()=>{ setLinkForWorker(null); },[date]);

  const activeWorkers = useMemo(()=>workers.filter(w=>w.isActive),[workers]);

  const taskMapByRoom = useMemo(()=>{
    const m = new Map<number,Task>();
    for(const t of tasks) m.set(t.roomId, t);
    return m;
  },[tasks]);

  const assign = async (roomId:number, guestId?:number, workerId?:number|null)=>{
    await jpost("/api/cleaning/tasks",{ mode:"assign", roomId, date, workerId: workerId ?? null, guestId });
    await reload();
  };

  const updateTask = async (taskId:number, data: Partial<Task>)=>{
    await jpost("/api/cleaning/tasks",{ mode:"update", taskId, ...data });
    await reload();
  };

  const createWorker = async ()=>{
    if(!newWorker.name.trim() || !newWorker.phone.trim()){ alert("이름/전화 입력"); return; }
    const rates = Object.entries(rateMap)
      .filter(([_,amt])=>Number(amt)>0)
      .map(([roomType, amount])=>({ roomType, amount: Number(amount) | 0 }));
    try {
      await jpost("/api/cleaning/workers", { ...newWorker, rates });
      setNewWorker({name:"",phone:""}); setShowWorker(false);
      await reload();
    } catch(e:any) {
      alert("등록 실패: " + String(e?.message || e));
    }
  };

  const openManual = ()=>{ setManual({roomId:0,date, time:"11:00", workerId:null, memo:""}); setShowManual(true); };
  const submitManual = async ()=>{
    if(!manual.roomId) return alert("객실 선택");
    const checkoutTime = `${manual.date}T${manual.time}`;
    await jpost("/api/cleaning/manual-create",{ roomId: manual.roomId, date: manual.date, workerId: manual.workerId, memo: manual.memo, checkoutTime });
    setShowManual(false); await reload();
  };

  const makeLink = async (workerId:number)=>{
    if (!workerId) return;
    try{
      const r = await jpost<{ok?:boolean;url:string}>("/api/cleaning/link",{workerId,date});
      setLinkForWorker({ workerId, url: r.url });
    }catch(e:any){
      alert("링크 생성 실패: " + String(e?.message || e));
    }
  };

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    alert("복사됨: " + txt);
  };

  const smsSend = (workerId:number)=>{
    const phone = workers.find(w=>w.id===workerId)?.phone || "";
    const url = linkForWorker?.url || "";
    if (!phone || !url) return;
    const body = encodeURIComponent(`[청소작업표] ${url}`);
    window.location.href = `sms:${phone}?&body=${body}`;
  };

  const purgeOldPhotos = async ()=>{
    if(!confirm("사진을 삭제합니다. 기준: 10일 이전. 진행할까요?")) return;
    const r = await jpost<{ok:boolean;deleted:number;days:number}>("/api/cleaning/photos/purge",{ days:10 });
    alert(`삭제 완료: ${r.deleted}건 (기준 ${r.days}일)`);
    await reload();
  };

  const currentTypes = Array.from(new Set(rooms.map(x=>x.roomType).filter((v): v is string => !!v)));

  /* ===================== Derived: filtering + sorting ===================== */
  const autoView = useMemo(()=>{
    let rows = autoList;
    if (workerFilter) {
      rows = rows.filter(r => {
        const t = r.roomId ? taskMapByRoom.get(r.roomId) : undefined;
        return t?.worker?.id === workerFilter;
      });
    }
    const sorted = [...rows].sort((a,b)=>{
      if (autoSortKey === "room") {
        const na = numFromRoom(a.room?.number ?? null);
        const nb = numFromRoom(b.room?.number ?? null);
        return cmp(na, nb, autoSortDir);
      } else {
        const ta = a.roomType ?? "";
        const tb = b.roomType ?? "";
        return cmp(ta, tb, autoSortDir);
      }
    });
    return sorted;
  }, [autoList, workerFilter, autoSortKey, autoSortDir, taskMapByRoom]);

  const taskView = useMemo(()=>{
    let rows = tasks;
    if (workerFilter) rows = rows.filter(t => (t.worker?.id === workerFilter));
    const sorted = [...rows].sort((a,b)=>{
      if (taskSortKey === "room") {
        const na = numFromRoom(a.room?.number ?? String(a.roomId));
        const nb = numFromRoom(b.room?.number ?? String(b.roomId));
        return cmp(na, nb, taskSortDir);
      } else {
        const ta = a.room?.roomType ?? "";
        const tb = b.room?.roomType ?? "";
        return cmp(ta, tb, taskSortDir);
      }
    });
    return sorted;
  }, [tasks, workerFilter, taskSortKey, taskSortDir]);

  /* ===================== Rate Editor ===================== */
  const openRateEditor = async (w: Worker) => {
    const info = await jget<{rates:Record<string,number>}>(`/api/cleaning/workers/${w.id}`);
    const setTypes = Array.from(new Set([
      ...currentTypes,
      ...Object.keys(info.rates || {})
    ]));
    setRateTypes(setTypes);
    const initial: Record<string, number> = {};
    for (const tp of setTypes) initial[tp] = Number(info.rates?.[tp] ?? 0);
    setRateEditor(initial);
    setRateEditorWorker({ id:w.id, name:w.name });
    setRateEditorOpen(true);
  };

  const saveRateEditor = async () => {
    if (!rateEditorWorker) return;
    const payload = Object.entries(rateEditor)
      .filter(([,v]) => Number.isFinite(v) && Number(v) >= 0)
      .map(([roomType, amount]) => ({ roomType, amount: Math.trunc(Number(String(amount).replace(/\D/g,"")) || 0) }));
    await jpatch(`/api/cleaning/workers/${rateEditorWorker.id}`, { rates: payload });
    setRateEditorOpen(false);
    await reload();
  };

  /* ===================== UI ===================== */
  return (
    <div style={{display:"grid",gap:12}}>
      <h1 style={{fontSize:22,fontWeight:800}}>청소 배정/상태 관리</h1>

      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input type="date" className="input" value={date} onChange={(e)=>setDate(e.target.value)} />
        <button className="btn" onClick={()=>void reload()} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        <button className="btn" onClick={()=>setShowWorker(true)}>작업자 등록</button>
        <button className="btn" onClick={()=>setManageWorkers(true)}>작업자 관리</button>
        <button className="btn btn-brown" onClick={openManual}>퇴실 객실 수동 추가</button>
        <button className="btn" onClick={purgeOldPhotos}>10일 이전 사진 일괄 삭제</button>

        {/* 전역 작업자 필터 */}
        <div style={{display:"flex",gap:6,alignItems:"center", marginLeft:"auto"}}>
          <label className="muted" style={{whiteSpace:"nowrap"}}>작업자 필터</label>
          <select
            className="input"
            value={workerFilter}
            onChange={e=>setWorkerFilter(Number(e.target.value)||0)}
            >
            <option value={0}>전체</option>
            {activeWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <Link href="/admin" className="btn">← 손님 명부</Link>
      </div>

      {linkForWorker && (
        <div className="card" style={{padding:"10px 12px"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <b>작업자 링크</b>
            <input className="input" style={{minWidth:400}} readOnly value={linkForWorker.url}/>
            <button className="btn" onClick={()=>copy(linkForWorker.url)}>복사</button>
            <button className="btn" onClick={()=>smsSend(linkForWorker.workerId)}>문자 보내기</button>
            <span className="muted">작업자: {workers.find(w=>w.id===linkForWorker.workerId)?.name} / {workers.find(w=>w.id===linkForWorker.workerId)?.phone}</span>
          </div>
        </div>
      )}

      {err && <div style={{color:"#b00"}}>{err}</div>}

      {/* 자동 리스트 */}
      <section className="card">
        <div className="card-h" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <b>오늘 퇴실 객실(자동)</b>
          <div style={{marginLeft:"auto", display:"flex", gap:6, alignItems:"center"}}>
            <label className="muted">정렬</label>
            <select className="input" value={autoSortKey} onChange={e=>setAutoSortKey(e.target.value as AutoSortKey)}>
              <option value="room">호실</option>
              <option value="roomType">객실타입</option>
            </select>
            <select className="input" value={autoSortDir} onChange={e=>setAutoSortDir(e.target.value as SortDir)}>
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table" style={{minWidth:1080}}>
            <thead><tr><th>호실</th><th>객실타입</th><th>퇴실(예약)</th><th>배정</th><th>작업자</th><th>작업상태</th><th>사진</th><th>관리</th></tr></thead>
            <tbody>
              {autoView.map(row=>{
                const rid = row.roomId ?? 0;
                const t = rid ? (taskMapByRoom.get(rid) || null) : null;
                const checkOut = `${row.endDate} ${row.endTime ?? "11:00"}`;

                // 배정용 옵션: 활성만
                const opts = activeWorkers;

                return (
                  <tr key={`${rid || "noRoom"}-${row.id}`}>
                    <td>{row.room?.number ?? "-"}</td>
                    <td>{row.roomType ?? "-"}</td>
                    <td>{checkOut}</td>
                    <td>
                      {t
                        ? "있음"
                        : (
                          <div style={{display:"flex",gap:6}}>
                            <select id={`w-${rid}-${row.id}`} className="input" defaultValue={0} disabled={!rid}>
                              <option value={0}>작업자 선택</option>
                              {opts.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <button className="btn" disabled={!rid} onClick={()=>{
                              if(!rid) return alert("객실 연결이 없어 배정할 수 없습니다.");
                              const sel = document.getElementById(`w-${rid}-${row.id}`) as HTMLSelectElement|null;
                              const wid = Number(sel?.value||0) || null;
                              void assign(rid, row.id, wid);
                            }}>배정</button>
                          </div>
                        )
                      }
                    </td>
                    <td>
                      {t?.worker
                        ? <span>{t.worker.name} <small style={{color:"#888"}}>({t.worker.phone})</small></span>
                        : <i style={{color:"#aaa"}}>미배정</i>}
                    </td>
                    <td>{t ? <StatusPill s={t.status}/> : "-"}</td>
                    <td>{t ? <button className="btn" onClick={()=>setGalleryTask(t)}>{t.photos?.length ?? 0}장 보기</button> : "-"}</td>
                    <td>
                      {t && (
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <select className="input" value={t.status} onChange={(e)=>updateTask(t.id,{status:e.target.value as Task["status"]})}>
                            <option value="PENDING">대기</option>
                            <option value="DOING">작업중</option>
                            <option value="DONE">완료</option>
                            <option value="HOLD">보류</option>
                          </select>
                          <select className="input" value={t.worker?.id || 0} onChange={e=>updateTask(t.id,{workerId:Number(e.target.value)||null})}>
                            <option value={0}>작업자변경</option>
                            {activeWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                          <button className="btn" onClick={()=>makeLink(t.worker?.id || 0)} disabled={!t.worker}>작업자 링크 표시</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {autoView.length===0 && <tr><td colSpan={8} className="muted" style={{textAlign:"center"}}>오늘 퇴실 항목 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* 오늘 작업표 */}
      <section className="card">
        <div className="card-h" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <b>오늘 청소 작업표</b>
          <div style={{marginLeft:"auto", display:"flex", gap:6, alignItems:"center"}}>
            <label className="muted">정렬</label>
            <select className="input" value={taskSortKey} onChange={e=>setTaskSortKey(e.target.value as TaskSortKey)}>
              <option value="room">호실</option>
              <option value="roomType">객실타입</option>
            </select>
            <select className="input" value={taskSortDir} onChange={e=>setTaskSortDir(e.target.value as SortDir)}>
              <option value="asc">오름차순</option>
              <option value="desc">내림차순</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="table" style={{minWidth:1080}}>
            <thead><tr><th>호실</th><th>작업자</th><th>상태</th><th>퇴실시각</th><th>메모</th><th>사진</th><th>관리</th></tr></thead>
            <tbody>
              {taskView.map(t=>{
                // 배정 드롭다운: 활성 + 현재 배정(비활성이라도 1회성 표시)
                const hasInactiveAssigned = t.worker && !t.worker.isActive;
                const opts = hasInactiveAssigned
                  ? [t.worker!, ...activeWorkers.filter(w=>w.id!==t.worker!.id)]
                  : activeWorkers;
                return (
                  <tr key={t.id}>
                    <td>{t.room?.number ?? t.roomId}</td>
                    <td>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <select className="input" value={t.worker?.id || 0} onChange={e=>updateTask(t.id,{workerId:Number(e.target.value)||null})}>
                          <option value={0}>미배정</option>
                          {opts.map(w=><option key={w.id} value={w.id}>{w.name}{w.isActive? "":" (비활성)"}</option>)}
                        </select>
                        <button className="btn btn-ghost" onClick={()=>makeLink(t.worker?.id||0)} disabled={!t.worker}>링크 표시</button>
                      </div>
                    </td>
                    <td><StatusPill s={t.status}/></td>
                    <td>{t.checkoutTime ? new Date(t.checkoutTime).toLocaleString() : "-"}</td>
                    <td>
                      <input className="input" defaultValue={t.memo ?? ""} onBlur={(e)=>updateTask(t.id,{memo:e.target.value})}/>
                    </td>
                    <td>
                      <button className="btn" onClick={()=>setGalleryTask(t)}>{t.photos?.length ?? 0}장 보기</button>
                    </td>
                    <td>
                      <select className="input" value={t.status} onChange={(e)=>updateTask(t.id,{status:e.target.value as Task["status"]})}>
                        <option value="PENDING">대기</option>
                        <option value="DOING">작업중</option>
                        <option value="DONE">완료</option>
                        <option value="HOLD">보류</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {taskView.length===0 && <tr><td colSpan={7} className="muted" style={{textAlign:"center"}}>작업 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* 작업자 등록 모달 */}
      {showWorker && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>작업자 등록</h3>
            <div style={{display:"grid",gap:8}}>
              <input className="input" placeholder="이름" value={newWorker.name} onChange={e=>setNewWorker(v=>({...v,name:e.target.value}))}/>
              <input className="input" placeholder="연락처" value={newWorker.phone} onChange={e=>setNewWorker(v=>({...v,phone:e.target.value.replace(/\D/g,"")}))}/>
              <div>
                <div style={{fontWeight:700, margin:"6px 0"}}>객실타입별 단가(원)</div>
                <div style={{display:"grid", gap:6}}>
                  {currentTypes.length === 0 && <div className="muted">객실타입이 등록된 객실이 없습니다.</div>}
                  {currentTypes.map(tp=>(
                    <div key={tp} style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div style={{minWidth:140}}>{tp}</div>
                      <input
                        className="input"
                        inputMode="numeric"
                        placeholder="금액"
                        value={rateMap[tp] ?? 0}
                        onChange={e=>setRateMap(m=>({...m,[tp]: Number(e.target.value.replace(/\D/g,"")||0)}))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button className="btn" onClick={()=>setShowWorker(false)}>취소</button>
                <button className="btn btn-brown" onClick={()=>void createWorker()}>등록</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 작업자 관리 모달 */}
      {manageWorkers && (
        <div className="modal-backdrop">
          <div className="modal" style={{width:760}}>
            <h3>작업자 관리</h3>
            <div className="table-scroll" style={{maxHeight:420}}>
              <table className="table" style={{minWidth:720}}>
                <thead><tr><th style={{width:60}}>ID</th><th style={{width:180}}>이름</th><th style={{width:180}}>전화</th><th style={{width:110}}>상태</th><th style={{width:230}}>관리</th></tr></thead>
                <tbody>
                  {workers.map(w=>(
                    <tr key={w.id}>
                      <td>{w.id}</td>
                      <td>
                        <input className="input" defaultValue={w.name} onChange={(e)=>{ (w as any).__name = e.target.value; }} />
                      </td>
                      <td>
                        <input className="input" defaultValue={w.phone} onChange={(e)=>{ (w as any).__phone = e.target.value.replace(/\D/g,""); }} />
                      </td>
                      <td>
                        <select
                          className="input"
                          defaultValue={w.isActive ? "1" : "0"}
                          onChange={(e)=>{ (w as any).__isActive = e.target.value==="1"; }}
                        >
                          <option value="1">활성</option>
                          <option value="0">비활성</option>
                        </select>
                      </td>
                      <td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button className="btn" onClick={async ()=>{
                          const payload:any = {};
                          if ((w as any).__name !== undefined) payload.name = (w as any).__name;
                          if ((w as any).__phone !== undefined) payload.phone = (w as any).__phone;
                          if ((w as any).__isActive !== undefined) payload.isActive = (w as any).__isActive;

                          if (Object.keys(payload).length===0) return alert("변경 사항이 없습니다.");
                          await jpatch(`/api/cleaning/workers/${w.id}`, payload);
                          // 로컬 즉시 반영
                          applyWorkerPatchLocal(w.id, payload);
                        }}>저장</button>

                        <button className="btn" onClick={()=>openRateEditor(w)}>단가 편집</button>

                        <button className="btn" onClick={async ()=>{
                          if(!confirm("삭제할까요? 할당된 작업에서 연결이 해제됩니다.")) return;
                          try{
                            await jdel(`/api/cleaning/workers/${w.id}`);
                            removeWorkerLocal(w.id); // 즉시 제거
                          }catch(e:any){
                            alert("삭제 실패: " + String(e?.message || e));
                          }
                        }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                  {workers.length===0 && <tr><td colSpan={5} className="muted" style={{textAlign:"center"}}>작업자 없음</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
              <button className="btn" onClick={()=>setManageWorkers(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 단가 편집 모달 */}
      {rateEditorOpen && rateEditorWorker && (
        <div className="modal-backdrop" onClick={()=>setRateEditorOpen(false)}>
          <div className="modal" style={{width:560}} onClick={e=>e.stopPropagation()}>
            <h3>단가 편집 — {rateEditorWorker.name}</h3>
            <div className="table-scroll" style={{maxHeight:420}}>
              <table className="table" style={{minWidth:520}}>
                <thead>
                  <tr><th style={{width:"60%"}}>객실타입</th><th style={{width:"40%"}}>단가(원)</th></tr>
                </thead>
                <tbody>
                  {rateTypes.map(tp=>(
                    <tr key={tp}>
                      <td>{tp}</td>
                      <td>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={rateEditor[tp] ?? 0}
                          onChange={e=>{
                            const v = Number(e.target.value.replace(/\D/g,"")||0);
                            setRateEditor(prev=>({...prev,[tp]: v}));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {rateTypes.length===0 && <tr><td colSpan={2} className="muted">표시할 객실타입이 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>

            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
              <input
                className="input"
                placeholder="새 객실타입 입력"
                onKeyDown={e=>{
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (!val) return;
                    if (!rateTypes.includes(val)) {
                      setRateTypes(tps=>[...tps, val]);
                      setRateEditor(prev=>({ ...prev, [val]: 0 }));
                    }
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
              <span className="muted">Enter로 추가</span>
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
              <button className="btn" onClick={()=>setRateEditorOpen(false)}>취소</button>
              <button className="btn btn-brown" onClick={()=>void saveRateEditor()}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 수동 추가 모달 */}
      {showManual && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>퇴실 객실 수동 추가</h3>
            <div style={{display:"grid",gap:8}}>
              <select className="input" value={manual.roomId} onChange={e=>setManual(v=>({...v,roomId:Number(e.target.value)}))}>
                <option value={0}>호실 선택</option>
                {rooms.map(r=><option key={r.id} value={r.id}>{r.number} {r.roomType?`(${r.roomType})`:""}</option>)}
              </select>
              <div style={{display:"flex",gap:8}}>
                <input type="date" className="input" value={manual.date} onChange={e=>setManual(v=>({...v,date:e.target.value}))}/>
                <input type="time" className="input" value={manual.time} onChange={e=>setManual(v=>({...v,time:e.target.value}))}/>
              </div>
              <select className="input" value={manual.workerId ?? 0} onChange={e=>setManual(v=>({...v,workerId:Number(e.target.value)||null}))}>
                <option value={0}>작업자 선택(선택)</option>
                {activeWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <textarea className="input" placeholder="메모" value={manual.memo} onChange={e=>setManual(v=>({...v,memo:e.target.value}))}/>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button className="btn" onClick={()=>setShowManual(false)}>취소</button>
                <button className="btn btn-brown" onClick={()=>void submitManual()}>추가</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 사진 갤러리 모달 */}
      {galleryTask && (
        <div className="modal-backdrop" onClick={()=>setGalleryTask(null)}>
          <div className="modal" style={{width:900}} onClick={e=>e.stopPropagation()}>
            <h3>사진 보기 — {galleryTask.room?.number ?? galleryTask.roomId}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(180px,1fr))",gap:10, maxHeight:500, overflow:"auto"}}>
              {(galleryTask.photos||[]).map(p=>(
                <figure key={p.id} style={{border:"1px solid #eee",borderRadius:8,padding:8}}>
                  <img src={p.url} alt="" style={{width:"100%",height:140,objectFit:"cover",borderRadius:6}}/>
                  <figcaption style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,fontSize:12,color:"#666"}}>
                    <span>{new Date(p.uploadedAt).toLocaleString()}</span>
                    <button className="btn" onClick={async ()=>{
                      if(!confirm("사진을 삭제할까요?")) return;
                      await jdel(`/api/cleaning/photos/${p.id}`);
                      await reload();
                      const t = (await jget<{rows:Task[]}>(`/api/cleaning/tasks?date=${encodeURIComponent(date)}`)).rows.find(x=>x.id===galleryTask.id) || null;
                      setGalleryTask(t);
                    }}>삭제</button>
                  </figcaption>
                </figure>
              ))}
              {(!galleryTask.photos || galleryTask.photos.length===0) && <div className="muted">사진이 없습니다.</div>}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
              <button className="btn" onClick={()=>setGalleryTask(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 스타일 */}
      <style jsx>{`
        .card { border:1px solid #eee; border-radius:10px; background:#fff; }
        .card-h { padding:10px 12px; border-bottom:1px solid #eee; background:#fafafa; }
        .table-scroll { overflow:auto; }
        .table { width:100%; border-collapse:collapse; }
        .table th, .table td { padding:8px; border-bottom:1px solid #f0f0f0; text-align:left; }
        .input { border:1px solid #ddd; border-radius:8px; padding:8px 10px; min-height:36px; }
        .btn { border:1px solid #ddd; border-radius:10px; padding:8px 12px; background:#f7f7f7; }
        .btn-brown { background:#a4825f; color:#fff; border-color:#a4825f; }
        .btn-ghost { background:transparent; }
        .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.3); display:flex; align-items:center; justify-content:center; z-index:50; }
        .modal { background:#fff; border-radius:12px; padding:16px; width:420px; max-width:95vw; }
        .muted { color:#888; }
      `}</style>
    </div>
  );
}
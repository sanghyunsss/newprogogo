// app/worker/cleaning/page.client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Task = {
  id: number;
  room: { number: string; roomType?: string | null } | null;
  roomId: number;
  status: "PENDING" | "DOING" | "DONE" | "HOLD";
  memo?: string | null;
  checkoutTime?: string | null;
  photos?: { id: number; url: string }[];
};

async function jget<T>(url: string) {
  const r = await fetch(url, { cache: "no-store", credentials: "include" });
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}
async function jpost<T>(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  try { return JSON.parse(t) as T; } catch { return {} as T; }
}

function fmtKST(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function WorkerCleaningClient() {
  const sp = useSearchParams();
  const token = sp.get("token") || "";

  const [date, setDate] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workerId, setWorkerId] = useState(0);
  const [workerName, setWorkerName] = useState("");
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [uploadingTask, setUploadingTask] = useState<number | null>(null);
  const formRefs = useRef<Record<number, HTMLFormElement | null>>({});
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollYRef = useRef<number>(0);

  const reload = async () => {
    if (!token) return;
    setBusy(true); setErr("");
    if (listRef.current) scrollYRef.current = listRef.current.scrollTop;
    try {
      const d = await jget<{
        rows: Task[]; workerId: number; workerName: string; date: string;
        todayTotal: number; monthTotal: number;
      }>(`/api/cleaning/worker-tasks?token=${encodeURIComponent(token)}`);
      setTasks(d.rows || []);
      setWorkerId(d.workerId);
      setWorkerName(d.workerName || `#${d.workerId}`);
      setDate(d.date);
      setTodayTotal(d.todayTotal || 0);
      setMonthTotal(d.monthTotal || 0);
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = scrollYRef.current;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setTasks([]);
    } finally {
      setBusy(false);
    }
  };

  const update = async (taskId: number, data: Partial<Task>) => {
    await jpost("/api/cleaning/worker-tasks", { token, taskId, ...data });
    await reload();
  };

  const uploadPhoto = async (taskId: number, file: File) => {
    const fd = new FormData();
    fd.append("token", token);
    fd.append("taskId", String(taskId));
    fd.append("file", file);
    setUploadingTask(taskId);
    try {
      const r = await fetch("/api/cleaning/worker-upload", {
        method: "POST", body: fd, cache: "no-store", credentials: "include",
      });
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      await reload();
    } catch (e: any) {
      alert("업로드 실패: " + String(e?.message || e));
    } finally {
      setUploadingTask(null);
      const f = formRefs.current[taskId]; if (f) f.reset();
    }
  };

  useEffect(() => { void reload(); }, [token]);

  useEffect(() => {
    let h: number | undefined;
    const tick = () => { if (!document.hidden) void reload(); };
    h = window.setInterval(tick, 15000);
    const onVis = () => { if (!document.hidden) void reload(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (h) clearInterval(h);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [token]);

  if (!token) return <div style={{ padding: 20 }}>토큰이 없습니다.</div>;

  return (
    <div className="wrap">
      <header className="hdr">
        <div className="hdr-top">
          <h2>[{workerName}] 오늘 청소 작업표</h2>
          <button className="btn btn-primary" onClick={() => void reload()}>새로고침</button>
        </div>
        <div className="hdr-sub">
          <span className="date">{date}</span>
          <span className="tot"><b>오늘:</b> {todayTotal.toLocaleString()}원</span>
          <span className="tot"><b>이번달:</b> {monthTotal.toLocaleString()}원</span>
        </div>
      </header>

      {err && <div className="err">{err}</div>}

      {/* 모바일 카드 리스트 */}
      <div className="mobile-list" ref={listRef}>
        {tasks.map((t) => (
          <section key={t.id} className="card">
            <div className="card-h">
              <div className="room">
                <span className="num">{t.room?.number ?? t.roomId}</span>
                {t.room?.roomType ? <span className="type">({t.room.roomType})</span> : null}
              </div>
              <select
                className="input sel"
                value={t.status}
                onChange={(e) => update(t.id, { status: e.target.value as Task["status"] })}
              >
                <option value="PENDING">대기</option>
                <option value="DOING">작업중</option>
                <option value="DONE">완료</option>
                <option value="HOLD">보류</option>
              </select>
            </div>

            <div className="row">
              <label>메모</label>
              <input
                className="input"
                defaultValue={t.memo ?? ""}
                onBlur={(e) => update(t.id, { memo: e.target.value })}
                placeholder="메모 입력"
              />
            </div>

            <div className="row">
              <label>실퇴실</label>
              <div className="value">{fmtKST(t.checkoutTime)}</div>
            </div>

            <div className="row">
              <label>사진 추가</label>
              <form
                onSubmit={async (ev: any) => {
                  ev.preventDefault();
                  const url = ev.currentTarget.photo?.value?.trim?.() || "";
                  if (!url) return;
                  await jpost("/api/cleaning/worker-tasks", { token, taskId: t.id, photoUrl: url });
                  ev.currentTarget.reset();
                  await reload();
                }}
                className="grid"
              >
                <input name="photo" className="input" placeholder="https:// 이미지 URL" />
                <button className="btn" type="submit">추가</button>
              </form>

              <form
                ref={(el)=>{ formRefs.current[t.id]=el; }}
                onSubmit={(e)=>e.preventDefault()}
                className="grid"
              >
                <label className="filebtn">
                  {uploadingTask===t.id ? "업로드 중..." : "사진 촬영/앨범에서 선택"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.currentTarget.files?.[0];
                      if (f) void uploadPhoto(t.id, f);
                    }}
                    disabled={uploadingTask===t.id}
                    style={{ display:"none" }}
                  />
                </label>
              </form>

              <div className="thumbs">
                {t.photos?.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="thumb">{p.url}</a>
                ))}
              </div>
            </div>
          </section>
        ))}

        {tasks.length === 0 && <div className="muted center">오늘 맡은 작업이 없습니다.</div>}
      </div>

      {/* 데스크톱 테이블 */}
      <div className="table-wrap" ref={listRef}>
        <table className="table">
          <thead>
            <tr>
              <th>호실</th>
              <th>상태</th>
              <th>메모</th>
              <th>실퇴실</th>
              <th>사진 추가</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td className="bold">
                  {t.room?.number ?? t.roomId}
                  {t.room?.roomType ? <small className="muted">({t.room.roomType})</small> : null}
                </td>
                <td>
                  <select
                    className="input"
                    value={t.status}
                    onChange={(e) => update(t.id, { status: e.target.value as Task["status"] })}
                  >
                    <option value="PENDING">대기</option>
                    <option value="DOING">작업중</option>
                    <option value="DONE">완료</option>
                    <option value="HOLD">보류</option>
                  </select>
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={t.memo ?? ""}
                    onBlur={(e) => update(t.id, { memo: e.target.value })}
                  />
                </td>
                <td>{fmtKST(t.checkoutTime)}</td>
                <td>
                  <form
                    onSubmit={async (ev: any) => {
                      ev.preventDefault();
                      const url = ev.currentTarget.photo?.value?.trim?.() || "";
                      if (!url) return;
                      await jpost("/api/cleaning/worker-tasks", { token, taskId: t.id, photoUrl: url });
                      ev.currentTarget.reset();
                      await reload();
                    }}
                    style={{ display:"grid", gap:6 }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <input name="photo" className="input" placeholder="https:// 이미지 URL" />
                      <button className="btn" type="submit">추가</button>
                    </div>
                  </form>
                  <form
                    ref={(el)=>{ formRefs.current[t.id]=el; }}
                    onSubmit={(e)=>e.preventDefault()}
                    style={{ display:"grid", gap:6, marginTop:6 }}
                  >
                    <label className="filebtn">
                      {uploadingTask===t.id ? "업로드 중..." : "사진 촬영/앨범에서 선택"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const f = e.currentTarget.files?.[0];
                          if (f) void uploadPhoto(t.id, f);
                        }}
                        disabled={uploadingTask===t.id}
                        style={{ display:"none" }}
                      />
                    </label>
                  </form>
                  <div className="thumbs">
                    {t.photos?.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="thumb">{p.url}</a>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="muted center">오늘 맡은 작업이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {busy && <div className="muted">불러오는 중…</div>}

      <style jsx>{`
        .wrap { padding: 12px; display: grid; gap: 12px; }
        .hdr { position: sticky; top: 0; z-index: 5; background: #fff; border-bottom: 1px solid #eee; padding: 8px 0; }
        .hdr-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .hdr-top h2 { font-size: 18px; margin: 0; }
        .hdr-sub { display: flex; gap: 10px; align-items: center; color: #555; font-size: 14px; margin-top: 4px; }
        .hdr-sub .date { color: #888; }
        .tot { background: #faf8f4; border: 1px solid #eee; border-radius: 8px; padding: 4px 8px; }

        .err { color: #b00; white-space: pre-wrap; }

        /* 모바일 카드 UI */
        .mobile-list { display: none; }
        .card { border: 1px solid #eee; border-radius: 12px; padding: 12px; background: #fff; }
        .card-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
        .room { font-weight: 800; font-size: 18px; display: flex; align-items: center; gap: 6px; }
        .room .num { letter-spacing: 0.5px; }
        .room .type { color: #888; font-weight: 600; }
        .row { display: grid; gap: 6px; margin-top: 10px; }
        .row label { font-size: 12px; color: #666; }
        .grid { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        .thumbs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }

        /* 데스크톱 테이블 */
        .table-wrap { overflow: auto; max-height: calc(100vh - 180px); }
        .table { width: 100%; border-collapse: collapse; min-width: 960px; }
        .table th, .table td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
        .bold { font-weight: 700; }
        .center { text-align: center; }

        /* 공통 입력 요소 */
        .input { border: 1px solid #ddd; border-radius: 10px; min-height: 42px; padding: 8px 12px; font-size: 16px; }
        .sel { min-width: 128px; }
        .btn { border: 1px solid #ddd; border-radius: 12px; padding: 10px 14px; background: #f7f7f7; font-size: 16px; }
        .btn-primary { background: #2b6cb0; color: #fff; border-color: #2b6cb0; }

        .muted { color: #888; }
        .thumb { font-size: 12px; color: #3366cc; text-decoration: underline; word-break: break-all; }
        .filebtn { display: inline-block; border: 1px dashed #bbb; border-radius: 12px; padding: 10px 12px; font-size: 16px; color: #333; background: #fcfcfc; cursor: pointer; }
        .filebtn:has(input:disabled) { opacity: .6; cursor: default; }

        /* 반응형 */
        @media (max-width: 768px) {
          .mobile-list { display: grid; gap: 10px; }
          .table-wrap { display: none; }
          .hdr-top h2 { font-size: 16px; }
          .input, .btn { min-height: 44px; font-size: 16px; }
        }
        @media (min-width: 769px) {
          .mobile-list { display: none; }
          .table-wrap { display: block; }
        }
      `}</style>
    </div>
  );
}
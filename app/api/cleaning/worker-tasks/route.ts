// app/api/cleaning/worker-tasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyCleaningToken } from "@/lib/cleaning";

/** "YYYY-MM-DD" → UTC 자정 Date */
const asDateAt00UTC = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;

const jerr = (e: unknown, code = 500) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[worker-tasks]", msg);
  return NextResponse.json({ ok:false, error:"internal", message:msg }, { status:code });
};

export async function GET(req: Request) {
  try {
    if (!prisma || !(prisma as any).cleaningTask) throw new Error("prisma not initialized");

    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    const p = await verifyCleaningToken(token);
    if (!p) return NextResponse.json({ ok:false, error:"unauth" }, { status:401 });

    const alive = await prisma.cleaningToken.findUnique({ where: { token } });
    if (!alive?.valid) return NextResponse.json({ ok:false, error:"expired" }, { status:401 });

    const curDate  = asDateAt00UTC(p.date);
    const nextDate = new Date(curDate.getTime() + 24*3600*1000);
    const monthStart = new Date(Date.UTC(curDate.getUTCFullYear(), curDate.getUTCMonth(), 1));
    const monthEnd   = new Date(Date.UTC(curDate.getUTCFullYear(), curDate.getUTCMonth()+1, 1));

    const rows = await prisma.cleaningTask.findMany({
      where: { workerId: p.workerId, date: { gte: curDate, lt: nextDate } },
      include: { room: true, photos: { select:{ id:true, url:true }, orderBy:{ id:"desc" } } },
      orderBy: { roomId: "asc" },
    });

    // ▼ 여기
    const workerRates = await prisma.cleaningRate.findMany({ where: { workerId: p.workerId } });
    const rmap = new Map(workerRates.map(r => [r.roomType, r.amount] as const));

    const todayDone = await prisma.cleaningTask.findMany({
      where: { workerId: p.workerId, date: { gte: curDate, lt: nextDate }, status: "DONE" },
      include: { room: true },
    });
    const monthDone = await prisma.cleaningTask.findMany({
      where: { workerId: p.workerId, date: { gte: monthStart, lt: monthEnd }, status: "DONE" },
      include: { room: true },
    });
    const sum = (list: typeof todayDone) => list.reduce((acc, t) => acc + (rmap.get(t.room?.roomType || "") || 0), 0);

    const worker = await prisma.cleaningWorker.findUnique({ where: { id: p.workerId } });

    return NextResponse.json({
      ok: true,
      rows,
      workerId: p.workerId,
      workerName: worker?.name || `#${p.workerId}`,
      date: ymd(curDate),
      todayTotal: sum(todayDone),
      monthTotal: sum(monthDone),
    });
  } catch (e) {
    return jerr(e);
  }
}

export async function POST(req: Request) {
  try {
    if (!prisma || !(prisma as any).cleaningTask) throw new Error("prisma not initialized");

    const j = await req.json().catch(() => ({}));
    const token = String(j.token || "");

    const p = await verifyCleaningToken(token);
    if (!p) return NextResponse.json({ ok:false, error:"unauth" }, { status:401 });

    const alive = await prisma.cleaningToken.findUnique({ where: { token } });
    if (!alive?.valid) return NextResponse.json({ ok:false, error:"expired" }, { status:401 });

    const taskId = Number(j.taskId || 0);
    if (!taskId) return NextResponse.json({ ok:false, error:"bad_params" }, { status:400 });

    if (j.status || j.memo !== undefined) {
      await prisma.cleaningTask.update({
        where: { id: taskId },
        data: { status: j.status ?? undefined, memo: j.memo ?? undefined },
      });
    }

    if (j.photoUrl) {
      await prisma.cleaningTaskPhoto.create({ data: { taskId, url: String(j.photoUrl) } });
    }

    return NextResponse.json({ ok:true });
  } catch (e) {
    return jerr(e);
  }
}
// app/api/cleaning/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { monthBoundsKST, kstMidnight, weekBoundsKST } from "@/lib/cleaning";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
  const period = (url.searchParams.get("period") || "month") as "day"|"week"|"month";

  let gte: Date, lt: Date;
  if (period === "day") {
    gte = kstMidnight(date);
    lt = new Date(gte); lt.setUTCDate(lt.getUTCDate() + 1);
  } else if (period === "week") {
    const wb = weekBoundsKST(date);
    gte = wb.gte; lt = wb.lt;
  } else {
    const mb = monthBoundsKST(date.slice(0,7))!;
    gte = mb.gte; lt = mb.lt;
  }

  const tasks = await prisma.cleaningTask.findMany({
    where: { date: { gte, lt }, workerId: { not: null } },
    include: { room: true, worker: true },
  });

  const workerIds = [...new Set(tasks.map(t => t.workerId!))];

  // ▼ 여기
  const rates = await prisma.cleaningRate.findMany({ where: { workerId: { in: workerIds } }});
  const priceMap = new Map<string, number>(); // `${workerId}|${roomType}` -> amount
  for (const r of rates) priceMap.set(`${r.workerId}|${r.roomType}`, r.amount);

  const sumByWorker = new Map<number, { name: string; count: number; amount: number }>();
  const slot = (wid:number, name:string) => {
    let v = sumByWorker.get(wid);
    if (!v) { v = { name, count:0, amount:0 }; sumByWorker.set(wid, v); }
    return v;
  };

  for (const t of tasks) {
    const v = slot(t.workerId!, t.worker?.name || `#${t.workerId}`);
    v.count += 1;
    const price = priceMap.get(`${t.workerId}|${t.room?.roomType ?? ""}`) || 0;
    v.amount += price;
  }

  const rows = [...sumByWorker.entries()].map(([workerId, v]) => ({ workerId, ...v }))
    .sort((a,b)=>a.workerId-b.workerId);

  return NextResponse.json({ period, from: gte.toISOString(), to: lt.toISOString(), rows });
}
// app/api/cleaning/worker-upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { verifyCleaningToken } from "@/lib/cleaning";

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json({ error: "bad_content_type" }, { status: 400 });
    }
    const form = await req.formData();
    const token = String(form.get("token") || "");
    const taskId = Number(form.get("taskId") || 0);
    const file = form.get("file") as File | null;

    const p = await verifyCleaningToken(token);
    if (!p) return NextResponse.json({ error: "unauth" }, { status: 401 });
    if (!taskId || !file) {
      return NextResponse.json({ error: "bad_params" }, { status: 400 });
    }

    // task 소유 확인
    const task = await prisma.cleaningTask.findUnique({ where: { id: taskId } });
    if (!task || task.workerId !== p.workerId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 저장 경로
    const ymd = p.date.slice(0, 10).replaceAll("-", "");
    const root = "/var/www/hotel-app/uploads";
    const dir = path.join(root, "cleaning", ymd);
    await mkdir(dir, { recursive: true });

    // 파일 저장
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const ts = Date.now();
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ext.length <= 5 ? ext : "jpg";
    const fname = `${taskId}_${ts}.${safeExt}`;
    const fpath = path.join(dir, fname);
    await writeFile(fpath, buf);

    // 외부 URL (nginx: /uploads → /var/www/hotel-app/uploads)
    const url = `/uploads/cleaning/${ymd}/${fname}`;

    await prisma.cleaningTaskPhoto.create({
      data: { taskId, url },
    });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("worker-upload error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
// src/lib/cleaning.ts
import prisma from "@/lib/prisma";
import crypto from "crypto";

/** "YYYY-MM-DD" → UTC 고정 자정 Date(저장/비교용 로컬자정 개념) */
export function asDateAt00UTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** KST 자정 Date(UTC 기준). "YYYY-MM-DD" 입력 */
export function kstMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -9, 0, 0));
}

/** 해당 날짜(KST) 하루 경계 [gte, lt) */
export function dayBoundsKST(dateStr: string) {
  const gte = kstMidnight(dateStr);
  const lt = new Date(gte); lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

/** 주간(KST) 경계 */
export function weekBoundsKST(dateStr: string) {
  const base = kstMidnight(dateStr);
  const dow = base.getUTCDay();
  const gte = new Date(base); gte.setUTCDate(gte.getUTCDate() - dow);
  const lt = new Date(gte); lt.setUTCDate(lt.getUTCDate() + 7);
  return { gte, lt };
}

/** 월 경계(KST) [gte, lt) */
export function monthBoundsKST(ym?: string | null) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const gte = new Date(Date.UTC(y, m - 1, 1, -9, 0, 0));
  const lt  = new Date(Date.UTC(y, m,     1, -9, 0, 0));
  return { gte, lt };
}

/** 토큰 생성 또는 재사용 */
export async function signCleaningToken(workerId: number, dateStr: string): Promise<string> {
  if (!workerId || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error("bad_params");
  const d = asDateAt00UTC(dateStr);

  const exist = await prisma.cleaningToken.findFirst({
    where: { workerId, date: d, valid: true },
    orderBy: { id: "desc" },
  });
  if (exist) return exist.token;

  const token = crypto.randomUUID();
  await prisma.cleaningToken.create({ data: { workerId, date: d, token, valid: true } });
  return token;
}

/** 토큰 검증 */
export async function verifyCleaningToken(token: string) {
  if (!token) return null;
  const row = await prisma.cleaningToken.findUnique({ where: { token } });
  if (!row || !row.valid) return null;
  const ymd = row.date.toISOString().slice(0, 10);
  return { workerId: row.workerId, date: ymd };
}

/** 토큰 무효화 */
export async function revokeCleaningToken(token: string) {
  await prisma.cleaningToken.update({ where: { token }, data: { valid: false } }).catch(() => {});
}

/** 작업자 합계(일/월) */
export async function calcWorkerTotals(workerId: number, dateYmd: string) {
  const { gte: dGte, lt: dLt } = dayBoundsKST(dateYmd);
  const mb = monthBoundsKST(dateYmd.slice(0, 7))!;
  const { gte: mGte, lt: mLt } = mb;

  const [dayTasks, monTasks, rates] = await Promise.all([
    prisma.cleaningTask.findMany({ where: { workerId, date: { gte: dGte, lt: dLt } }, include: { room: true } }),
    prisma.cleaningTask.findMany({ where: { workerId, date: { gte: mGte, lt: mLt } }, include: { room: true } }),
    prisma.cleaningRate.findMany({ where: { workerId } }), // ▼ 여기
  ]);

  const pmap = new Map<string, number>();
  for (const r of rates) pmap.set(r.roomType, r.amount);

  const sum = (rows: typeof dayTasks) =>
    rows.reduce((acc, t) => acc + (pmap.get(t.room?.roomType ?? "") || 0), 0);

  return { todayTotal: sum(dayTasks), monthTotal: sum(monTasks) };
}
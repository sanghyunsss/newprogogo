// src/db/guest.ts
import { prisma } from "./client";

/**
 * ID로 손님(DailyGuest) 조회
 * - schema.prisma의 DailyGuest 모델을 사용
 */
export async function getGuestById(id: number) {
  return prisma.dailyGuest.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contact: true,
      carNo: true,
      startDate: true,
      endDate: true,
      token: true,
      room: { select: { number: true } },
    },
  });
}

/**
 * 토큰으로 손님(DailyGuest) 조회
 * - /g/[token] 경로용
 */
export async function getGuestByToken(token: string) {
  return prisma.dailyGuest.findUnique({
    where: { token },
    select: {
      id: true,
      name: true,
      contact: true,
      carNo: true,
      startDate: true,
      endDate: true,
      token: true,
      roomType: true,
      room: { select: { number: true } },
    },
  });
}

/**
 * 손님 이벤트(체크인/체크아웃) 조회
 * - 필요 시 같이 사용
 */
export async function getGuestEvents(guestId: number) {
  return prisma.event.findMany({
    where: { guestId },
    orderBy: { ts: "asc" },
    select: {
      id: true,
      type: true, // "checkin" | "checkout"
      ts: true,
      verified: true,
      roomId: true,
      guestId: true,
    },
  });
}
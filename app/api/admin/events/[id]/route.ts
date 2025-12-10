import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/src/lib/prisma";

/** DELETE /api/admin/events/:id
 *  - 이벤트(체크인/체크아웃 기록) 1건 무효 처리(삭제)
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // ✅ 명확한 타입, any 없음
) {
  const { id } = await context.params; // Promise 해제
  const eventId = Number(id);

  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const found = await prisma.event.findUnique({
    where: { id: eventId },
  });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id: eventId } });

  return NextResponse.json({ success: true });
}
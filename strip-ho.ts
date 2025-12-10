import { prisma } from "@/src/lib/prisma";
import { normalizeRoomNo } from "@/src/utils/normalize";

async function main() {
  const rooms = await prisma.room.findMany();
  let changed = 0;
  for (const r of rooms) {
    const fixed = normalizeRoomNo(r.number);
    if (fixed !== r.number) {
      await prisma.room.update({ where: { id: r.id }, data: { number: fixed } });
      changed++;
    }
  }
  console.log("정규화 완료:", changed, "건");
}
main().finally(() => prisma.$disconnect());
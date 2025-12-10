// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const rooms = [
    "O-1014호","W-620호","W-720호","W-822호","W-1021호","W-1223호","W-1421호","W-1723호","W-1819호",
    "P-535호","P-433호","O-405호","O-407호","O-408호","O-414호","O-418호","O-516호","O-507호",
    "O-503호","O-502호","O-604호","O-613호","O-702호","O-707호","O-804호","O-904호","O-911호",
    "O-914호","O-1014호","O-1212호","O-1211호","O-1311호","O-1304호","O-1403호","O-1402호",
    "O-1504호","O-1502호","O-1604호","O-1613호","O-1616호","O-1715호","O-1815호","O-1908호",
    "O-1916호","W-320호","O-302호",
  ];

  for (const num of rooms) {
    await prisma.room.upsert({
      where: { number: num },
      update: {},                 // 이미 존재하면 변경 없음
      create: { number: num },    // 없으면 생성
    });
  }

  console.log("✅ 호실 등록 완료!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
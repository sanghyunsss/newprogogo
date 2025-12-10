// scripts/seed-admins.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const seeds = [
    { email: "info@eucom.co.kr", password: "dldb1207!@!" },       // Root
    { email: "info@morethansc.co.kr", password: "ahdjeos1234!" },  // 추가 ID
  ];

  for (const s of seeds) {
    const hash = await bcrypt.hash(s.password, 10);
    await prisma.adminUser.upsert({
      where: { email: s.email },
      update: { password: hash },
      create: { email: s.email, password: hash },
    });
    console.log(`✔ upsert admin: ${s.email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
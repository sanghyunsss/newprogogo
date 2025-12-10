const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rooms = await p.room.findMany({ select: { id: true, number: true } });
  for (const r of rooms) {
    const m = r.number ? r.number.match(/\d+/) : null;
    const n = m ? parseInt(m[0], 10) : null;
    await p.room.update({ where: { id: r.id }, data: { numberSort: n } });
  }
  console.log('done');
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});

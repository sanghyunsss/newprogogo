// scripts/set-device-ids.ts
import { prisma } from "@/src/lib/prisma";

const MAP: Record<string, string> = {
  "O-1014호": "NPgQLswkp5z7Jxddts4y7g==",  // ✅ 올바른 값만 남김
  "W-620호": "gbMM7lKXgRK6/nBigaduxw==",
  "W-720호": "DsypAKVNy+hYpZeBWXywgg==",
  "W-822호": "GNK4maDsFmoRNA+6qZWpeQ==",
  "W-1021호": "HsYkyg5JDr8oGAsfNkkwwg==",
  "W-1223호": "c1RX3pMdjHyNu7+A9tEZzA==",
  "W-1421호": "kLR+AJKb18+Ppu8X7OLT7A==",
  "W-1723호": "6b2VPROdx62Psme3mGzzrA==",
  "W-1819호": "dVZ51GvTCMHKJ3x2YeYeqQ==",
  "P-535호": "KyV5jQUXyvwwHD0wHtMhnQ==",
  "P-433호": "UDE3fVbsrHybSkaUdFUx9A==",
  "O-405호": "7jm/pmMw8os5zdIulLtMFg==",
  "O-407호": "fI2biAfh4cCMQTGhv9uthg==",
  "O-408호": "ej4znbOKB915tsnyZabGTg==",
  "O-414호": "pm68fGFqHajXj0Fc/4qB6g==",
  "O-418호": "WTGIPUDWxhsUk1//iW3mGg==",
  "O-516호": "NJ/mQbAMujHM4Y14L2E63A==",
  "O-507호": "S8IoExqsiNwtwU/jrXpepA==",
  "O-503호": "7nR43S8iMYjZ9BJcHi3Blw==",
  "O-502호": "QEtSIsciVLlCGvld+1mNyA==",
  "O-604호": "SZU9P93FQ9+2FOqWhflK9A==",
  "O-613호": "3Vwb29MdI+mjLCjZBv6T6g==",
  "O-702호": "m2gO0KvQ5XVDW4bkwncj1A==",
  "O-707호": "pI7omY3SVJtYV92fGXm5jQ==",
  "O-804호": "Vgh1bx7l8wk0+whDVpuSPA==",
  "O-904호": "PzgAnm04v1MfqQ5o8bMRNA==",
  "O-911호": "2Vc3jtbSTcoDMnFLpG44Fg==",
  "O-914호": "VGMvv6hekWFmOYc84+C/TQ==",
  "O-1212호": "PfcAywptgwVXMtJ3hhqx+g==",
  "O-1211호": "pwmaU8X9uTHHr1QQ8ecLzw==",
  "O-1311호": "BJGv1uorPdVNteVch9pLXQ==",
  "O-1304호": "HXmDYZCibD8EMlNyXrg81A==",
  "O-1403호": "5qCfUExHqWb0QdmSCBHJXQ==",
  "O-1402호": "FxWJKuPij5+oxC2DQNCMDA==",
  "O-1504호": "BsypD+WsO5+lrxTeXyZP6A==",
  "O-1502호": "LVTNOAKxg0J+hVDHgUlhxA==",
  "O-1604호": "wdiY/8TzMCSOOvUwrX0+YQ==",
  "O-1613호": "93e/taEudl92rB8jLka9Cw==",
  "O-1616호": "C1RJ98FHD67fcYGoP4nT0A==",
  "O-1715호": "xFtSh4Qr7E6G5wE0Ym+LLw==",
  "O-1815호": "s6C/4sCIcwGrGFqjQSdiAA==",
  "O-1908호": "2C4xm3wYZt68BcU2nFYIMw==",
  "O-1916호": "9c++u/YErsIhShNSri1QLw==",
  "W-320호": "pV3acAVCVPbVnkOIDaxC3w==",
  "O-302호": "L6shtjpmZ0u9LXSiqF0yOg==",
};

async function main() {
  let ok = 0, miss = 0;
  for (const [number, deviceId] of Object.entries(MAP)) {
    const room = await prisma.room.findUnique({ where: { number } });
    if (!room) { 
      console.warn(`⚠️ 없음: ${number}`); 
      miss++; 
      continue; 
    }
    await prisma.room.update({
      where: { id: room.id },
      data: { deviceId },
    });
    ok++;
    console.log(`✅ 업데이트: ${number} -> ${deviceId}`);
  }
  console.log(`\n완료: ${ok}건 업데이트, ${miss}건 누락`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

type G = typeof globalThis & { __prisma?: PrismaClient };

const g = globalThis as G;

const prisma = g.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "production" ? [] : ["error", "warn"],
});

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export default prisma;          // ✅ default export
export { prisma };              // ✅ named export도 제공 (혼용 대비)
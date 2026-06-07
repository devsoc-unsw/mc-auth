import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./dev.db" })
  return new PrismaClient({ adapter })
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

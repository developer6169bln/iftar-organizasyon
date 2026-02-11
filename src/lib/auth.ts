import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createUser(email: string, name: string, password: string) {
  try {
    const hashedPassword = await hashPassword(password)
    return await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    })
  } catch (error) {
    console.error('createUser error:', error)
    throw error
  }
}

/** Holt User für Login. Bei Schema-Fehler (fehlende Spalten) Fallback per Raw-Query mit Basis-Spalten. */
export async function getUserByEmail(email: string) {
  try {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        editionId: true,
        editionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const isSchemaError =
      /editionId|editionExpiresAt|mainUserCategoryId|does not exist|column.*not exist/i.test(msg) ||
      (e as { code?: string }).code === 'P2021'
    if (!isSchemaError) throw e

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string; name: string; password: string; role: string; createdAt: Date; updatedAt: Date }>
    >('SELECT id, email, name, password, role, "createdAt", "updatedAt" FROM users WHERE email = $1 LIMIT 1', email)
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      password: row.password,
      role: row.role,
      editionId: null,
      editionExpiresAt: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

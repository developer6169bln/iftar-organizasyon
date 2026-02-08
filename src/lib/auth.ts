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

/** Holt User für Login – nur Felder, die garantiert existieren (ohne mainUserCategoryId), damit Login auch ohne Migration funktioniert. */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
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
}

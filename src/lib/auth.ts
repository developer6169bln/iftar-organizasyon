import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createUser(email: string, name: string, password: string) {
  const hashedPassword = await hashPassword(password)
  return prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
    },
  })
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  })
}

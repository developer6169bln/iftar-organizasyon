import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequest } from '@/lib/auditLog'
import { isProjectOwner } from '@/lib/permissions'
import { z } from 'zod'

/** Liste: Wer darf an JotForm senden (Projekt-Mitglieder + Berechtigung) */
export async function GET(request: NextRequest) {
  const { userId } = await getUserIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId fehlt' }, { status: 400 })
  const projects = await import('@/lib/permissions').then((m) => m.getProjectsForUser(userId))
  if (!projects.some((p) => p.id === projectId)) {
    return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt' }, { status: 403 })
  }
  const owner = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, owner: { select: { id: true, name: true, email: true } } },
  })
  if (!owner) return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
  const permissions = await prisma.projectMemberJotFormPermission.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  const list = [
    { userId: owner.ownerId, user: owner.owner, canSubmitToJotform: true, isOwner: true },
    ...permissions.map((p) => ({ userId: p.userId, user: p.user, canSubmitToJotform: p.canSubmitToJotform, isOwner: false })),
  ]
  return NextResponse.json(list)
}

const updateSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  canSubmitToJotform: z.boolean(),
})

/** Berechtigung setzen. Nur Projekt-Inhaber. */
export async function PATCH(request: NextRequest) {
  const { userId: currentUserId } = await getUserIdFromRequest(request)
  if (!currentUserId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'projectId, userId und canSubmitToJotform erforderlich' }, { status: 400 })
  }
  const { projectId, userId: targetUserId, canSubmitToJotform } = parsed.data
  const owner = await isProjectOwner(projectId, currentUserId)
  if (!owner) {
    return NextResponse.json({ error: 'Nur der Projekt-Inhaber kann die JotForm-Sendeberechtigung vergeben' }, { status: 403 })
  }
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  })
  if (!member) {
    return NextResponse.json({ error: 'Der Benutzer ist kein Mitglied dieses Projekts' }, { status: 400 })
  }
  const perm = await prisma.projectMemberJotFormPermission.upsert({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    create: { projectId, userId: targetUserId, canSubmitToJotform },
    update: { canSubmitToJotform },
  })
  return NextResponse.json(perm)
}

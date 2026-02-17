import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePageAccess } from '@/lib/permissions'

/**
 * PATCH – Angerufen-Status einer Anmeldung aktualisieren.
 * Body: { called: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  const access = await requirePageAccess(request, 'guests')
  if (access instanceof NextResponse) return access

  try {
    const { registrationId } = await params
    const body = await request.json()
    const called = body?.called === true

    const registration = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { called },
    })

    return NextResponse.json({ success: true, called: registration.called })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Angerufen-Status:', error)
    return NextResponse.json(
      { error: 'Status konnte nicht aktualisiert werden.' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEventAccess } from '@/lib/permissions'

function safeParsePlanData(raw: string | null): {
  tables: unknown[]
  podiums: unknown[]
  drawings: unknown[]
} {
  if (!raw || typeof raw !== 'string') return { tables: [], podiums: [], drawings: [] }
  try {
    const parsed = JSON.parse(raw) as {
      tables?: unknown[]
      podiums?: unknown[]
      drawings?: unknown[]
    }
    return {
      tables: Array.isArray(parsed?.tables) ? parsed.tables : [],
      podiums: Array.isArray(parsed?.podiums) ? parsed.podiums : [],
      drawings: Array.isArray(parsed?.drawings) ? parsed.drawings : [],
    }
  } catch {
    return { tables: [], podiums: [], drawings: [] }
  }
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
        { status: 400 }
      )
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const plan = await prisma.tablePlan.findUnique({
      where: { eventId },
    })

    if (!plan) {
      return NextResponse.json({
        floorPlanUrl: null,
        planData: { tables: [], podiums: [], drawings: [] },
      })
    }

    return NextResponse.json({
      floorPlanUrl: plan.floorPlanUrl ?? null,
      planData: safeParsePlanData(plan.planData),
    })
  } catch (error) {
    console.error('Table plan GET error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Tischplanung', details: msg },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, floorPlanUrl, planData } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
        { status: 400 }
      )
    }
    const eventAccess = await requireEventAccess(request, eventId)
    if (eventAccess instanceof NextResponse) return eventAccess

    const eventExists = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    })
    if (!eventExists) {
      return NextResponse.json(
        { error: 'Event nicht gefunden' },
        { status: 404 }
      )
    }

    const data: { floorPlanUrl?: string | null; planData?: string | null } = {}
    if (floorPlanUrl !== undefined) data.floorPlanUrl = floorPlanUrl || null
    if (planData !== undefined) {
      try {
        data.planData =
          typeof planData === 'string' ? planData : JSON.stringify(planData || { tables: [], podiums: [], drawings: [] })
      } catch (e) {
        console.error('Table plan PUT: planData stringify failed', e)
        return NextResponse.json(
          { error: 'Ungültige planData' },
          { status: 400 }
        )
      }
    }

    const plan = await prisma.tablePlan.upsert({
      where: { eventId },
      create: { eventId, ...data },
      update: data,
    })

    return NextResponse.json({
      floorPlanUrl: plan.floorPlanUrl ?? null,
      planData: safeParsePlanData(plan.planData),
    })
  } catch (error) {
    console.error('Table plan PUT error:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Tischplanung', details: msg },
      { status: 500 }
    )
  }
}

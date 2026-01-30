import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId')
    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId erforderlich' },
        { status: 400 }
      )
    }

    let plan = await prisma.tablePlan.findUnique({
      where: { eventId },
    })

    if (!plan) {
      plan = await prisma.tablePlan.create({
        data: { eventId, floorPlanUrl: null, planData: null },
      })
    }

    return NextResponse.json({
      floorPlanUrl: plan.floorPlanUrl,
      planData: plan.planData ? JSON.parse(plan.planData) : { tables: [], podiums: [] },
    })
  } catch (error) {
    console.error('Table plan GET error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Abrufen der Tischplanung' },
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

    const data: { floorPlanUrl?: string | null; planData?: string | null } = {}
    if (floorPlanUrl !== undefined) data.floorPlanUrl = floorPlanUrl || null
    if (planData !== undefined) data.planData = typeof planData === 'string' ? planData : JSON.stringify(planData || { tables: [], podiums: [] })

    const plan = await prisma.tablePlan.upsert({
      where: { eventId },
      create: { eventId, ...data },
      update: data,
    })

    return NextResponse.json({
      floorPlanUrl: plan.floorPlanUrl,
      planData: plan.planData ? JSON.parse(plan.planData) : { tables: [], podiums: [] },
    })
  } catch (error) {
    console.error('Table plan PUT error:', error)
    return NextResponse.json(
      { error: 'Fehler beim Speichern der Tischplanung' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = process.env.CHECKIN_PUBLIC_TOKEN || 'checkin2024'
  const baseUrl = request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const publicLink = `${protocol}://${baseUrl}/checkin-public/${token}`
  
  return NextResponse.json({ link: publicLink, token })
}

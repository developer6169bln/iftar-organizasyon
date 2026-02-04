import { redirect } from 'next/navigation'

/** Weiterleitung von /invitation/decline/[token] zur API (für alte E-Mail-Links). */
export default async function InvitationDeclinePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token) redirect('/invitation/error?message=Token fehlt')
  redirect(`/api/invitations/decline/${token}`)
}

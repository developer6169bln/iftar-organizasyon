import { redirect } from 'next/navigation'

/** Weiterleitung von /invitation/accept/[token] zur API (für alte E-Mail-Links). */
export default async function InvitationAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token) redirect('/invitation/error?message=Token fehlt')
  redirect(`/api/invitations/accept/${token}`)
}

'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function InvitationErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || 'Ein Fehler ist aufgetreten'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-12 w-12 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Fehler</h1>
          <p className="text-gray-600">{message}</p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Bitte kontaktieren Sie den Veranstalter, falls das Problem
            weiterhin besteht.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function InvitationErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    }>
      <InvitationErrorContent />
    </Suspense>
  )
}

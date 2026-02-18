'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function InvitationSuccessContent() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type')
  const already = searchParams.get('already') === 'true'
  const yedek = searchParams.get('yedek') === 'true'

  const isAccepted = type === 'accepted'
  const isDeclined = type === 'declined'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        {isAccepted && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-12 w-12 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">
                {already ? 'Bereits bestätigt' : 'Vielen Dank für Ihre Teilnahme!'}
              </h1>
              <p className="text-gray-600">
                {already
                  ? 'Ihre Teilnahme wurde bereits bestätigt.'
                  : yedek
                    ? 'Yedek listesindesiniz. Yer açıldığında size onay kodunuzu e-posta veya WhatsApp yoluyla ileteceğiz.'
                    : 'Ihr Dankeschön für die Teilnahme ist bei uns angekommen. Wir freuen uns sehr, Sie bei der Veranstaltung begrüßen zu dürfen!'}
              </p>
            </div>
          </>
        )}

        {isDeclined && (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
                <svg
                  className="h-12 w-12 text-orange-600"
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
              <h1 className="mb-2 text-2xl font-bold text-gray-900">
                {already ? 'Bereits abgesagt' : 'Absage erhalten'}
              </h1>
              <p className="text-gray-600">
                {already
                  ? 'Ihre Absage wurde bereits registriert.'
                  : 'Ihre Absage wurde übermittelt. Wir bedauern, dass Sie diesmal nicht dabei sein können, und würden uns sehr freuen, Sie bei einer zukünftigen Veranstaltung begrüßen zu dürfen!'}
              </p>
            </div>
          </>
        )}

        {!isAccepted && !isDeclined && (
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Unbekannter Status
            </h1>
            <p className="text-gray-600">
              Die Antwort konnte nicht verarbeitet werden.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Sie können dieses Fenster jetzt schließen.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function InvitationSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    }>
      <InvitationSuccessContent />
    </Suspense>
  )
}

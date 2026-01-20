'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Token kontrolü yap, varsa dashboard'a yönlendir
    const token = document.cookie.split('; ').find(row => row.startsWith('auth-token='))
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg">Yönlendiriliyor...</p>
      </div>
    </div>
  )
}

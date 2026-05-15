'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) sb.auth.signInAnonymously()
    })
  }, [])

  return <>{children}</>
}
